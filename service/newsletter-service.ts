import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { Message, SendMessageCommand } from "@aws-sdk/client-sqs"
import { randomUUID } from "node:crypto"
import logger from "../lib/core/logger"
import { PreparedEmail, preparePayload } from "../lib/email/events"
import { TaskQueue } from "../lib/queue"
import { safeStringify } from "../lib/utils/common"
import { MailgunMessage } from "../types/mailgun"
import { awsService, QUEUE_URL } from "./aws-service"
import { db, prisma } from "./db-service"

export class NewsletterService {
    private readonly log = logger.child({ module: "service:newsletter-service" })
    private readonly persistFormattedContents = db.shouldPersistNewsletterFormattedContents()

    /**
     * Saves a newsletter batch to the DB and enqueues it to SQS for background processing.
     */
    async addToQueue(message: MailgunMessage, siteId: string) {
        if (!message) throw new Error("Message body is empty or invalid.")

        const { id } = await db.createNewsletterBatchEntry(siteId, message)
        const response = await awsService.sqsClient().send(new SendMessageCommand({
            QueueUrl: QUEUE_URL.NEWSLETTER,
            MessageBody: String(id),
            MessageAttributes: {
                siteId: { DataType: "String", StringValue: siteId },
                from: { DataType: "String", StringValue: message.from },
            },
        }))
        this.log.info({ batchId: message["v:email-id"], messageId: response.MessageId }, "newsletter queued to SQS")
        return { batchId: message["v:email-id"], messageId: response.MessageId }
    }

    /**
     * Processes a single SQS message: validates required fields then sends all emails.
     * Resolves → worker deletes. Throws → worker retries (idempotency skips already-sent recipients).
     */
    async validateAndProcessBatch(message: Message) {
        const batchId = message.Body
        const siteId = message.MessageAttributes?.["siteId"]?.StringValue
        const from = message.MessageAttributes?.["from"]?.StringValue
        if (!batchId || !siteId || !from) {
            this.log.error({ message: safeStringify(message) }, "invalid or incomplete SQS message, discarding")
            return
        }
        await this.processBatch(siteId, batchId)
    }

    /** Returns newsletter send counts for a given site and time range. */
    async getUsage(input: { from: number; to: number; siteId: string }) {
        this.log.debug({ input }, "getUsage input")
        const where = {
            created: {
                gte: new Date(input.from),
                lte: new Date(input.to),
            },
            newsletterBatch: { siteId: input.siteId },
        }
        const count = await prisma.newsletterMessages.count({ where })
        return {
            status: "ok",
            data: {
                forRange: { ...where.created },
                message: "newsletter usage",
                count,
                timestamp: new Date().toISOString(),
            },
        }
    }

    /**
     * Loads a newsletter batch from the DB and sends all emails via a rate-limited concurrent queue.
     * Throws if any recipients fail, so the SQS message is kept for retry.
     */
    private async processBatch(siteId: string, newsletterBatchId: string) {
        const contents = await db.getNewsletterContent(newsletterBatchId)
        if (!contents) {
            // Permanent — batch is always written before the SQS message is enqueued.
            this.log.error({ newsletterBatchId }, "Newsletter batch not found in DB — discarding message")
            return
        }

        const emails = preparePayload(contents, siteId)
        const emailBatchId = contents["v:email-id"]

        this.log.info({ emailCount: emails.length, emailBatchId }, "processing newsletter batch")

        const rateLimit = Number(process.env.RATE_LIMIT) || 20
        const maxConcurrent = Number(process.env.MAX_CONCURRENT) || 100
        const queue = new TaskQueue({ rateLimit, maxConcurrent })

        for (const prepared of emails) {
            queue.enqueue(
                () => this.sendSingleEmail(prepared, newsletterBatchId, siteId, emailBatchId),
                emailBatchId
            )
        }

        const results = await queue.waitUntilFinished()
        this.log.info({
            sent: results.settledCount - results.failedCount,
            failed: results.failedCount,
            durationMs: Math.round(results.totalDuration),
        }, "newsletter batch completed")

        if (results.failedCount > 0) {
            throw new Error(`${results.failedCount}/${emails.length} emails failed in batch ${emailBatchId}`)
        }
    }

    /**
     * Sends a single email: checks idempotency, delivers via SES, records in DB.
     * Throws on failure so TaskQueue can track and the batch can retry.
     */
    private async sendSingleEmail(
        prepared: PreparedEmail,
        newsletterBatchId: string,
        siteId: string,
        emailBatchId: string
    ) {
        const { request, recipientVariables } = prepared
        const toEmail = request.Destination?.ToAddresses?.join() ?? ""
        const recipientData = JSON.stringify({ toEmail, variables: recipientVariables })
        const formattedContents = this.persistFormattedContents ? safeStringify(request) : ""

        if (toEmail && await db.checkNewsletterAlreadySent(newsletterBatchId, toEmail)) {
            this.log.info({ toEmail, newsletterBatchId }, "skipping already-sent recipient")
            return
        }

        const messageId = await this.sendViaSes({ request, toEmail, siteId, emailBatchId, recipientData, formattedContents })
        await this.recordSent({ messageId, newsletterBatchId, toEmail, siteId, recipientData, formattedContents })
        this.log.info({ messageId, toEmail, siteId }, "email sent")
    }

    /** Delivers the email via SES. On failure, logs the error to DB (best-effort) then re-throws. */
    private async sendViaSes({ request, toEmail, siteId, emailBatchId, recipientData, formattedContents }: {
        request: PreparedEmail["request"]
        toEmail: string
        siteId: string
        emailBatchId: string
        recipientData: string
        formattedContents: string
    }): Promise<string> {
        try {
            const { MessageId } = await awsService.sesNewsletterClient().send(new SendEmailCommand(request))
            return MessageId as string
        } catch (sesError) {
            const errorId = randomUUID()
            this.log.error({ err: sesError, errorId, toEmail, siteId }, "SES send failed")
            db.createNewsletterErrorEntry(errorId, String(sesError), emailBatchId, toEmail, recipientData, formattedContents)
                .catch(dbErr => this.log.error({ err: dbErr, errorId, toEmail }, "Failed to persist SES error to DB"))
            throw sesError
        }
    }

    /**
     * Writes the sent record to DB for idempotency.
     * Note: if this fails after SES delivery, the next retry will re-send to this recipient.
     */
    private async recordSent({ messageId, newsletterBatchId, toEmail, siteId, recipientData, formattedContents }: {
        messageId: string
        newsletterBatchId: string
        toEmail: string
        siteId: string
        recipientData: string
        formattedContents: string
    }) {
        try {
            await db.createNewsletterEntry(messageId, newsletterBatchId, toEmail, recipientData, formattedContents)
        } catch (dbError) {
            this.log.error(
                { err: dbError, messageId, toEmail, newsletterBatchId, siteId },
                "CRITICAL: email delivered but DB record failed — duplicate send risk on retry"
            )
            throw dbError
        }
    }
}

export const newsletterService = new NewsletterService()
