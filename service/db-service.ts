import { prisma } from "../lib/database"
import { NotificationEvent } from "../lib/email/events"
import { safeStringify } from "../lib/utils/common"
import { MailgunMessage } from "../types/mailgun"
export { prisma }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnvBoolean(name: string, fallback = false): boolean {
    const raw = process.env[name]
    if (!raw) return fallback
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase())
}

function prepareNotificationData(event: NotificationEvent) {
    return {
        messageId: event.messageId,
        rawEvent: event.raw,
        type: event.type,
        notificationId: event.notificationId,
        timestamp: event.timestamp,
    }
}

// ---------------------------------------------------------------------------
// DatabaseService — centralised Prisma operations with built-in idempotency
// ---------------------------------------------------------------------------

export class DatabaseService {
    private readonly persistFormattedContents: boolean

    constructor() {
        this.persistFormattedContents = getEnvBoolean(
            "PERSIST_NEWSLETTER_FORMATTED_CONTENTS",
            false
        )
    }

    // -----------------------------------------------------------------------
    // Newsletter batch
    // -----------------------------------------------------------------------

    createNewsletterBatchEntry(siteId: string, message: MailgunMessage) {
        const batchId = message["v:email-id"] || "no-batch-id-provided"
        const contents = safeStringify(message)
        const fromEmail = message.from
        return prisma.newsletterBatch.create({
            select: { id: true },
            data: { siteId, batchId, contents, fromEmail },
        })
    }

    getNewsletterContent(newsletterBatchId: string) {
        return prisma.newsletterBatch
            .findUnique({
                where: { id: newsletterBatchId },
                select: { contents: true },
            })
            .then((result) => {
                if (!result?.contents) return null
                try {
                    return JSON.parse(result.contents)
                } catch (err) {
                    throw new Error(
                        `Failed to parse newsletter batch contents (batchId=${newsletterBatchId}): ${err instanceof Error ? err.message : err
                        }`
                    )
                }
            })
    }

    // -----------------------------------------------------------------------
    // Newsletter messages
    // -----------------------------------------------------------------------

    createNewsletterEntry(
        messageId: string,
        batchId: string,
        toEmail: string,
        recipientData: string,
        formatedContents = ""
    ) {
        return prisma.newsletterMessages.create({
            data: {
                newsletterBatchId: batchId,
                formatedContents,
                recipientData,
                toEmail,
                messageId,
            },
        })
    }

    async checkNewsletterAlreadySent(batchId: string, toEmail: string): Promise<boolean> {
        const existing = await prisma.newsletterMessages.findFirst({
            where: { newsletterBatchId: batchId, toEmail },
            select: { id: true },
        })
        return !!existing
    }

    getNewsletterMessage(messageId: string) {
        return prisma.newsletterMessages.findUnique({ where: { messageId } })
    }

    // -----------------------------------------------------------------------
    // Newsletter errors
    // -----------------------------------------------------------------------

    createNewsletterErrorEntry(
        messageId: string,
        errorMessage: string,
        batchId: string,
        toEmail: string,
        recipientData: string,
        formatedContents = ""
    ) {
        return prisma.newsletterErrors.create({
            data: {
                error: errorMessage,
                newsletterBatchId: batchId,
                messageId,
                formatedContents,
                recipientData,
                toEmail,
            },
        })
    }

    // -----------------------------------------------------------------------
    // Newsletter notifications (idempotent upsert)
    // -----------------------------------------------------------------------

    saveNewsletterNotification(event: NotificationEvent) {
        const data = prepareNotificationData(event)
        return prisma.newsletterNotifications.upsert({
            where: { notificationId: event.notificationId },
            create: data,
            update: data,
        })
    }

    // -----------------------------------------------------------------------
    // System email notifications (idempotent upsert)
    // -----------------------------------------------------------------------

    saveSystemEmailEvent(event: NotificationEvent) {
        const data = prepareNotificationData(event)
        return prisma.systemMailNotifications.upsert({
            where: { notificationId: event.notificationId },
            create: data,
            update: data,
        })
    }

    getSystemMessage(messageId: string) {
        return prisma.systemMails.findUnique({ where: { messageId } })
    }

    // -----------------------------------------------------------------------
    // Config helpers
    // -----------------------------------------------------------------------

    shouldPersistNewsletterFormattedContents(): boolean {
        return this.persistFormattedContents
    }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

export const db = new DatabaseService()
