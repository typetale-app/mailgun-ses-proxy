import { preparePayload, PreparedEmail } from "../lib/core/aws-utils"
import { safeStringify } from "../lib/core/common"
import { SendEmailCommand } from "@aws-sdk/client-sesv2"
import { DeleteMessageCommand, Message, SendMessageCommand } from "@aws-sdk/client-sqs"
import {
    createNewsletterBatchEntry,
    createNewsletterEntry,
    createNewsletterErrorEntry,
    getNewsletterContent,
    shouldPersistNewsletterFormattedContents,
} from "./database/db"
import { QUEUE_URL, sesNewsletterClient, sqsClient } from "./aws/awsHelper"
import logger from "../lib/core/logger"
// @ts-ignore
import { randomUUID } from "node:crypto"

const log = logger.child({ service: "service:newsletter-service" })
const PERSIST_NEWSLETTER_FORMATTED_CONTENTS = shouldPersistNewsletterFormattedContents()

export async function addNewsletterToQueue(message: any, siteId: string, auth: any) {
    if (!message) throw new Error("Message body is empty or invalid.")
    log.debug({ message }, "sending message body to SQS")

    const result = await createNewsletterBatchEntry(siteId, message)
    const params = {
        QueueUrl: QUEUE_URL.NEWSLETTER,
        MessageBody: String(result.id),
        MessageAttributes: {
            siteId: {
                DataType: "String",
                StringValue: siteId,
            },
            from: {
                DataType: "String",
                StringValue: message.from,
            },
        },
    }
    const command = new SendMessageCommand(params)
    const response = await sqsClient().send(command)
    return { batchId: message["v:email-id"], messageId: response.MessageId }
}

async function sendSingleMail(prepared: PreparedEmail, dbId: string, siteId: string, batchId: string) {
    const { request, recipientVariables } = prepared
    const toEmail = request.Destination?.ToAddresses?.join("") || ""
    const recipientData = JSON.stringify({ toEmail, variables: recipientVariables })
    const formatedContents = PERSIST_NEWSLETTER_FORMATTED_CONTENTS ? safeStringify(request) : ""
    try {
        const cmd = new SendEmailCommand(request)
        const resp = await sesNewsletterClient().send(cmd)
        const messageId = resp.MessageId as string
        await createNewsletterEntry(messageId, dbId, toEmail, recipientData, formatedContents)
        log.info({ messageId, siteId }, "email sent")
    } catch (e) {
        const tempMessageId = randomUUID()
        log.error({ err: e, tempMessageId, siteId }, "SES send failed, recording error entry")
        await createNewsletterErrorEntry(tempMessageId, String(e), batchId, toEmail, recipientData, formatedContents)
        return { errorMessage: e }
    }
}

async function sendMail(siteId: string, dbId: string) {
    const contents = await getNewsletterContent(dbId)
    const sendEmailRequests = preparePayload(contents, siteId)
    const batchId = contents["v:email-id"]
    for (const prepared of sendEmailRequests) {
        const result = await sendSingleMail(prepared, dbId, siteId, batchId)
        if (result?.errorMessage) {
            return result
        }
    }
    return { batchId }
}

export async function validateAndSend(message: Message) {
    if (!message.MessageAttributes || !message.Body) {
        log.error({ message: safeStringify(message) }, "invalid message")
        return
    }

    const siteId = message.MessageAttributes["siteId"]?.StringValue
    const from = message.MessageAttributes["from"]?.StringValue

    if (!siteId || !from) {
        log.error({ message: safeStringify(message) }, "missing required message attributes")
        return
    }

    try {
        const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || "0")
        if (receiveCount > 5) {
            await sqsClient().send(
                new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL.NEWSLETTER,
                    ReceiptHandle: message.ReceiptHandle,
                })
            )
            throw new Error("Message has been received more than 5 times, skipping it.")
        }

        const result = await sendMail(siteId, message.Body)

        if (result.batchId) {
            await sqsClient().send(
                new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL.NEWSLETTER,
                    ReceiptHandle: message.ReceiptHandle,
                })
            )
        }
    } catch (e) {
        log.error({ err: e, batchId: message.Body }, "error occurred at validateAndSend")
    }
}
