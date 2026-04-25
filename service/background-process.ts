import { MessageSystemAttributeName, ReceiveMessageCommand } from "@aws-sdk/client-sqs"
import logger from "../lib/core/logger"
import { QUEUE_URL, sqsClient } from "./aws/awsHelper"
import { processNewsletterEmailEvents } from "./events-service"
import { validateAndSend } from "./newsletter-service"
import { processSystemEmailEvents } from "./system-email-notification"

const log = logger.child({ service: "backgroundProcess" })

/**
 *  This method process all the newsletter messages in the queue
 */
export async function processNewsletterQueue() {
    log.info("[processNewsletterQueue] Processing newsletter queue")
    const client = sqsClient() // Fatal if SQS_REGION is missing — let it propagate
    const input = {
        MessageAttributeNames: ["All"],
        MessageSystemAttributeNames: [MessageSystemAttributeName.SentTimestamp,
        MessageSystemAttributeName.ApproximateReceiveCount],
        QueueUrl: QUEUE_URL.NEWSLETTER,
        VisibilityTimeout: 900,
        WaitTimeSeconds: 20,
    }
    const command = new ReceiveMessageCommand(input)
    while (true) {
        try {
            const { Messages } = await client.send(command)
            if (Messages && Messages.length > 0) {
                for (const message of Messages) {
                    try {
                        await validateAndSend(message)
                    } catch (e) {
                        log.error(e, `[processNewsletterQueue] Failed to process message ${message.MessageId}`)
                    }
                }
            }
        } catch (e) {
            log.error(e, "[processNewsletterQueue] Error polling SQS, will retry")
        }
    }
}

/**
 * This process newsletter email events
 */
export async function processNewsletterEventsQueue() {
    log.info("[background] Processing newsletter events queue")
    const client = sqsClient() // Fatal if SQS_REGION is missing — let it propagate
    const input = {
        MessageAttributeNames: ["All"],
        MessageSystemAttributeNames: [
            MessageSystemAttributeName.SentTimestamp,
            MessageSystemAttributeName.ApproximateReceiveCount
        ],
        QueueUrl: QUEUE_URL.NEWSLETTER_NOTIFICATION,
        VisibilityTimeout: 30,
        WaitTimeSeconds: 20,
    }
    const command = new ReceiveMessageCommand(input)
    while (true) {
        try {
            let response = await client.send(command)
            if (response.Messages) await processNewsletterEmailEvents(response)
        } catch (e) {
            log.error(e, "[processNewsletterEventsQueue] Error processing newsletter events")
        }
    }
}

/**
 * This process system email events
 */
export async function processSystemEventsQueue() {
    log.info("[background] Processing system events queue")
    const client = sqsClient() // Fatal if SQS_REGION is missing — let it propagate
    const input = {
        MessageAttributeNames: ["All"],
        MessageSystemAttributeNames: [MessageSystemAttributeName.SentTimestamp],
        QueueUrl: QUEUE_URL.SYSTEM_NOTIFICATION,
        VisibilityTimeout: 30,
        WaitTimeSeconds: 20,
    }
    const command = new ReceiveMessageCommand(input)
    while (true) {
        try {
            let response = await client.send(command)
            if (response.Messages) await processSystemEmailEvents(response)
        } catch (e) {
            log.error(e, "[processSystemEventsQueue] Error processing system events")
        }
    }
}

