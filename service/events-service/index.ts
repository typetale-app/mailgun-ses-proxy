import { DeleteMessageCommand, ReceiveMessageCommandOutput } from "@aws-sdk/client-sqs"
import { parseNotificationEvent } from "../../lib/core/aws-utils"
import logger from "../../lib/core/logger"
import { QUEUE_URL, sqsClient } from "../aws/awsHelper"
import { getNewsletterMessage, saveNewsletterNotification } from "../database/db"

const log = logger.child({ service: "processEmailEvents" })

export async function processNewsletterEmailEvents(response: ReceiveMessageCommandOutput) {
    if (!response.Messages || response.Messages.length == 0)
        throw new Error("No messages found")
    for (const msg of response.Messages) {
        if (msg.Body && msg.MessageId) {
            try {
                const receiveCount = parseInt(msg.Attributes?.ApproximateReceiveCount || "0")
                if (receiveCount > 3) {
                    log.error({ messageId: msg.MessageId, receiveCount }, "event exceeded max retries, deleting from queue")
                    await sqsClient().send(new DeleteMessageCommand({
                        QueueUrl: QUEUE_URL.NEWSLETTER_NOTIFICATION,
                        ReceiptHandle: msg.ReceiptHandle,
                    }))
                    continue
                }

                const result = parseNotificationEvent(msg.MessageId, msg.Body)
                const message = await getNewsletterMessage(result.messageId)
                if (!message) {
                    throw new Error(`Message ${result.messageId} not found in DB, skipping deletion to retry later`)
                } else {
                    await saveNewsletterNotification(result)
                }
                const command = new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL.NEWSLETTER_NOTIFICATION,
                    ReceiptHandle: msg.ReceiptHandle,
                })
                await sqsClient().send(command)
            } catch (e) {
                log.error(e, `[processNewsletterEmailEvents] Failed to process message ${msg.MessageId}`)
            }
        }
    }
}