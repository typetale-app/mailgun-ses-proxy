import { QUEUE_URL, sqsClient } from "./aws/awsHelper"
import { saveSystemEmailEvent } from "./database/db"
import logger from "../lib/core/logger"
import { parseNotificationEvent } from "../lib/core/aws-utils"
import { DeleteMessageCommand, ReceiveMessageCommandOutput } from "@aws-sdk/client-sqs"

export async function processSystemEmailEvents(response: ReceiveMessageCommandOutput) {
    const log = logger.child({ service: "processSystemEmailEvents" })
    if (!response.Messages || response.Messages.length == 0)
        throw new Error("No messages found")
    for (const msg of response.Messages) {
        if (msg.Body && msg.MessageId) {
            try {
                const result = parseNotificationEvent(msg.MessageId, msg.Body)
                await saveSystemEmailEvent(result)
                const command = new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL.SYSTEM_NOTIFICATION,
                    ReceiptHandle: msg.ReceiptHandle,
                })
                await sqsClient().send(command)
            } catch (e) {
                log.error(e, `[processSystemEmailEvents] Failed to process message ${msg.MessageId}`)
            }
        }
    }
}