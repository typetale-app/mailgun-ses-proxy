import { startWorker } from "@/lib/core/sqs-worker"
import { QUEUE_URL } from "./aws/awsHelper"
import { handleNewsletterEmailEvent } from "./events-service"
import { validateAndSend } from "./newsletter-service"
import { handleSystemEmailEvent } from "./system-email-notification"

/**
 * Processes the newsletter queue (Ghost CMS batches).
 * Uses a long visibility timeout (15m) to handle large batch sends.
 */
export async function processNewsletterQueue() {
    await startWorker({
        name: "newsletter-sender",
        queueUrl: QUEUE_URL.NEWSLETTER!,
        visibilityTimeout: 900, // 15 minutes for processing batches
        handler: validateAndSend
    })
}

/**
 * Processes delivery/bounce events for newsletter emails.
 */
export async function processNewsletterEventsQueue() {
    await startWorker({
        name: "newsletter-events",
        queueUrl: QUEUE_URL.NEWSLETTER_NOTIFICATION!,
        handler: handleNewsletterEmailEvent
    })
}

/**
 * Processes delivery/bounce events for system/transactional emails.
 */
export async function processSystemEventsQueue() {
    await startWorker({
        name: "system-events",
        queueUrl: QUEUE_URL.SYSTEM_NOTIFICATION!,
        handler: handleSystemEmailEvent
    })
}


