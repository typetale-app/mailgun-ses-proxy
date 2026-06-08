import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { Message, SendMessageCommand } from "@aws-sdk/client-sqs"
import { randomUUID } from "node:crypto"
import { PreparedEmail, preparePayload } from "../lib/core/aws-utils"
import { safeStringify } from "../lib/core/common"
import logger from "../lib/core/logger"
import { TaskQueue } from "../lib/task-queue"
import { MailgunMessage } from "../types/mailgun"
import { QUEUE_URL, sesNewsletterClient, sqsClient } from "./aws/awsHelper"
import {
    checkNewsletterAlreadySent,
    createNewsletterBatchEntry,
    createNewsletterEntry,
    createNewsletterErrorEntry,
    getNewsletterContent,
    shouldPersistNewsletterFormattedContents,
} from "./database/db"

const log = logger.child({ module: "service:newsletter-service" })
const PERSIST_FORMATTED_CONTENTS = shouldPersistNewsletterFormattedContents()

// ─── Public API ──────────────────────────────────────────────

/**
 * Saves a newsletter batch to the DB and enqueues it to SQS for background processing.
 */
export async function addNewsletterToQueue(message: MailgunMessage, siteId: string) {
    if (!message) throw new Error("Message body is empty or invalid.")

    const { id } = await createNewsletterBatchEntry(siteId, message)
    const response = await sqsClient().send(new SendMessageCommand({
        QueueUrl: QUEUE_URL.NEWSLETTER,
        MessageBody: String(id),
        MessageAttributes: {
            siteId: { DataType: "String", StringValue: siteId },
            from: { DataType: "String", StringValue: message.from },
        },
    }))

    log.info({ batchId: message["v:email-id"], messageId: response.MessageId }, "newsletter queued to SQS")
    return { batchId: message["v:email-id"], messageId: response.MessageId }
}

/**
 * Processes a single SQS message: validates required fields then sends all emails.
 * Resolves → worker deletes. Throws → worker retries (idempotency skips already-sent recipients).
 */
export async function validateAndSend(message: Message) {
    const batchId = message.Body
    const siteId = message.MessageAttributes?.["siteId"]?.StringValue
    const from = message.MessageAttributes?.["from"]?.StringValue

    if (!batchId || !siteId || !from) {
        log.error({ message: safeStringify(message) }, "invalid or incomplete SQS message, discarding")
        return
    }

    await processBatch(siteId, batchId)
}

// ─── Internal: Batch Processing ──────────────────────────────

/**
 * Loads a newsletter batch from the DB and sends all emails via a rate-limited concurrent queue.
 * Throws if any recipients fail, so the SQS message is kept for retry.
 */
async function processBatch(siteId: string, newsletterBatchId: string) {
    const contents = await getNewsletterContent(newsletterBatchId)
    if (!contents) {
        // Permanent — batch is always written before the SQS message is enqueued.
        log.error({ newsletterBatchId }, "Newsletter batch not found in DB — discarding message")
        return
    }

    const emails = preparePayload(contents, siteId)
    const emailBatchId = contents["v:email-id"]

    log.info({ emailCount: emails.length, emailBatchId }, "processing newsletter batch")

    const rateLimit = Number(process.env.RATE_LIMIT) || 20
    const maxConcurrent = Number(process.env.MAX_CONCURRENT) || 100
    const queue = new TaskQueue({ rateLimit, maxConcurrent })

    for (const prepared of emails) {
        queue.enqueue(
            () => sendSingleEmail(prepared, newsletterBatchId, siteId, emailBatchId),
            emailBatchId
        )
    }

    const results = await queue.waitUntilFinished()
    log.info({
        sent: results.settledCount - results.failedCount,
        failed: results.failedCount,
        durationMs: Math.round(results.totalDuration),
    }, "newsletter batch completed")

    if (results.failedCount > 0) {
        throw new Error(`${results.failedCount}/${emails.length} emails failed in batch ${emailBatchId}`)
    }
}

// ─── Internal: Single Email ──────────────────────────────────

/**
 * Sends a single email via SES.
 * Skips already-sent recipients (idempotency). Records result in DB. Throws on failure.
 */
async function sendSingleEmail(
    prepared: PreparedEmail,
    newsletterBatchId: string,
    siteId: string,
    emailBatchId: string
) {
    const { request, recipientVariables } = prepared
    const toEmail = request.Destination?.ToAddresses?.join() || ""
    const recipientData = JSON.stringify({ toEmail, variables: recipientVariables })
    const formattedContents = PERSIST_FORMATTED_CONTENTS ? safeStringify(request) : ""

    // Skip if already sent in a previous attempt.
    if (toEmail && await checkNewsletterAlreadySent(newsletterBatchId, toEmail)) {
        log.info({ toEmail, newsletterBatchId }, "skipping already-sent recipient")
        return
    }

    // ── Step 1: Send via SES ─────────────────────────────────────────────
    let messageId: string
    try {
        const resp = await sesNewsletterClient().send(new SendEmailCommand(request))
        messageId = resp.MessageId as string
    } catch (sesError) {
        // SES send failed — record in DB and re-throw for TaskQueue tracking.
        const errorId = randomUUID()
        log.error({ err: sesError, errorId, toEmail, siteId }, "SES send failed")
        try {
            await createNewsletterErrorEntry(errorId, String(sesError), emailBatchId, toEmail, recipientData, formattedContents)
        } catch (dbErr) {
            log.error({ err: dbErr, errorId, toEmail }, "Failed to persist SES error entry to DB")
        }
        throw sesError
    }

    // ── Step 2: Record in DB ─────────────────────────────────────────────
    // The email has already been delivered at this point. If the DB write
    // fails, the idempotency guard (checkNewsletterAlreadySent) won't find
    // this recipient on retry, causing a duplicate send. We log at CRITICAL
    // severity so this can be caught by alerting and reconciled manually.
    try {
        await createNewsletterEntry(messageId, newsletterBatchId, toEmail, recipientData, formattedContents)
    } catch (dbError) {
        log.error(
            { err: dbError, messageId, toEmail, newsletterBatchId, siteId },
            "CRITICAL: Email sent via SES but DB record failed — potential duplicate on retry"
        )
        throw dbError
    }

    log.info({ messageId, toEmail, siteId }, "email sent")
}


