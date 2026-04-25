import { TaskQueue } from "@/lib/task-queue"
import { MailgunMessage } from "@/types/mailgun"
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { DeleteMessageCommand, Message, SendMessageCommand } from "@aws-sdk/client-sqs"
import { randomUUID } from "node:crypto"
import { PreparedEmail, preparePayload } from "../lib/core/aws-utils"
import { safeStringify } from "../lib/core/common"
import logger from "../lib/core/logger"
import { TaskQueue } from "../lib/task-queue"
import { QUEUE_URL, sesNewsletterClient, sqsClient } from "./aws/awsHelper"
import {
    checkNewsletterAlreadySent,
    createNewsletterBatchEntry,
    createNewsletterEntry,
    createNewsletterErrorEntry,
    getNewsletterContent,
    shouldPersistNewsletterFormattedContents,
} from "./database/db"

const log = logger.child({ service: "service:newsletter-service" })
const PERSIST_FORMATTED_CONTENTS = shouldPersistNewsletterFormattedContents()
const MAX_RECEIVE_COUNT = 3

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
 * Processes a single SQS message: validates, sends all emails, handles retries.
 *
 * Retry strategy:
 *  - On success → message is deleted from SQS
 *  - On partial failure → message stays in SQS for re-delivery;
 *    already-sent recipients are skipped via idempotency check
 *  - After MAX_RECEIVE_COUNT retries → message is deleted to prevent infinite loops
 */
export async function validateAndSend(message: Message) {
    const batchId = message.Body
    const siteId = message.MessageAttributes?.["siteId"]?.StringValue
    const from = message.MessageAttributes?.["from"]?.StringValue

    if (!batchId || !siteId || !from) {
        log.error({ message: safeStringify(message) }, "invalid or incomplete SQS message, discarding")
        await deleteFromQueue(message.ReceiptHandle)
        return
    }

    const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || "0")
    if (receiveCount > MAX_RECEIVE_COUNT) {
        log.error({ batchId, receiveCount }, "batch exceeded max retries, discarding")
        await deleteFromQueue(message.ReceiptHandle)
        return
    }

    try {
        await processBatch(siteId, batchId)
        await deleteFromQueue(message.ReceiptHandle)
    } catch (e) {
        // Leave the message in SQS — it will be re-delivered after the visibility timeout.
        // On retry, already-sent recipients are skipped via the idempotency check.
        log.error({ err: e, batchId, receiveCount }, "batch processing failed, will retry")
    }
}

// ─── Internal: Batch Processing ──────────────────────────────

/**
 * Loads a newsletter batch from the DB and sends all emails via a rate-limited concurrent queue.
 * Throws if any recipients fail, so the SQS message is kept for retry.
 */
async function processBatch(siteId: string, newsletterBatchId: string) {
    const contents = await getNewsletterContent(newsletterBatchId)
    if (!contents) {
        throw new Error(`Newsletter batch not found: ${newsletterBatchId}`)
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
 * Sends a single email via SES with idempotency protection.
 * - Checks if the recipient was already sent in this batch (prevents duplicates on retry)
 * - On success, records in `newsletterMessages`
 * - On failure, records in `newsletterErrors` and re-throws for the queue to track
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

    // Idempotency: skip if this recipient was already sent in a previous attempt
    if (toEmail && await checkNewsletterAlreadySent(newsletterBatchId, toEmail)) {
        log.info({ toEmail, newsletterBatchId }, "skipping already-sent recipient")
        return
    }

    try {
        const resp = await sesNewsletterClient().send(new SendEmailCommand(request))
        const messageId = resp.MessageId as string
        await createNewsletterEntry(messageId, newsletterBatchId, toEmail, recipientData, formattedContents)
        log.info({ messageId, toEmail, siteId }, "email sent")
    } catch (e) {
        const errorId = randomUUID()
        log.error({ err: e, errorId, toEmail, siteId }, "SES send failed")
        await createNewsletterErrorEntry(errorId, String(e), emailBatchId, toEmail, recipientData, formattedContents)
        throw e // Re-throw so the queue tracks this as a failure
    }
}

// ─── Internal: SQS Helpers ───────────────────────────────────

async function deleteFromQueue(receiptHandle?: string) {
    if (!receiptHandle) return
    await sqsClient().send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL.NEWSLETTER,
        ReceiptHandle: receiptHandle,
    }))
}
