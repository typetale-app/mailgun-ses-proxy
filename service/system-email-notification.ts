import { createEventProcessor } from "../lib/email/processor"
import { db } from "./db-service"

/**
 * Standardized handler for system-related SES notification events.
 */
export const handleSystemEmailEvent = createEventProcessor({
    name: "system-events",
    lookupMessage: db.getSystemMessage,
    saveNotification: db.saveSystemEmailEvent,
})