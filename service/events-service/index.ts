import { createEventProcessor } from "@/lib/core/event-processor"
import { getNewsletterMessage, saveNewsletterNotification } from "../database/db"

/**
 * Standardized handler for newsletter-related SES notification events.
 */
export const handleNewsletterEmailEvent = createEventProcessor({
    name: "newsletter-events",
    lookupMessage: getNewsletterMessage,
    saveNotification: saveNewsletterNotification,
    maxRetries: 3
})