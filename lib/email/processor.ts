import { Message } from "@aws-sdk/client-sqs"
import { NotificationEvent, parseNotificationEvent } from "./events"
import logger from "../core/logger"

const log = logger.child({ module: "email/processor" })

interface EventProcessorConfig {
    name: string
    lookupMessage: (messageId: string) => Promise<any>
    saveNotification: (event: NotificationEvent) => Promise<any>
}

/**
 * Creates a standardised SES notification handler.
 * Returns (resolves) → worker deletes. Throws → worker retries.
 */
export function createEventProcessor(config: EventProcessorConfig) {
    const { name, lookupMessage, saveNotification } = config

    return async (message: Message) => {
        if (!message.Body || !message.MessageId) {
            log.warn({ name }, "Empty SQS message — discarding")
            return
        }

        const result = parseNotificationEvent(message.MessageId, message.Body)

        if (!result.isNewsletterEmailEvent && !result.isTransactionalEmailEvent) {
            log.warn({ name, messageId: result.messageId }, "Untracked event — discarding")
            return
        }

        const dbMessage = await lookupMessage(result.messageId)
        if (!dbMessage) {
            // Possible race condition — throw to trigger a retry.
            throw new Error(`Message ${result.messageId} not found in DB, will retry`)
        }

        await saveNotification(result) // upsert — idempotent

        log.info({
            name,
            messageId: result.messageId,
            type: result.type,
            notificationId: result.notificationId
        }, "Processed event successfully")
    }
}
