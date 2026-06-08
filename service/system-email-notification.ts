import { createEventProcessor } from "../lib/email/processor"
import { getSystemMessage, saveSystemEmailEvent } from "./database/db"

/**
 * Standardized handler for system-related SES notification events.
 */
export const handleSystemEmailEvent = createEventProcessor({
    name: "system-events",
    lookupMessage: getSystemMessage,
    saveNotification: saveSystemEmailEvent,
})