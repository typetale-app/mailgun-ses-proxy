import { MailgunMessage } from "@/types/mailgun"
import { NotificationEvent } from "../../lib/core/aws-utils"
import { safeStringify } from "../../lib/core/common"
import { prisma } from "../../lib/database"
export { prisma }

function getEnvBoolean(name: string, fallback = false) {
    const raw = process.env[name]
    if (!raw) return fallback
    return ["1", "true", "yes", "on"].includes(raw.toLowerCase())
}

const PERSIST_NEWSLETTER_FORMATTED_CONTENTS = getEnvBoolean("PERSIST_NEWSLETTER_FORMATTED_CONTENTS", false)

export async function createNewsletterBatchEntry(siteId: string, message: MailgunMessage) {
    const batchId = message["v:email-id"] || "no-batch-id-provided"
    const contents = safeStringify(message)
    const fromEmail = message.from
    return prisma.newsletterBatch.create({
        select: { id: true },
        data: {
            siteId,
            batchId,
            contents,
            fromEmail,
        },
    })
}

export async function createNewsletterEntry(
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

export async function createNewsletterErrorEntry(
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
            messageId: messageId,
            formatedContents,
            recipientData,
            toEmail
        },
    })
}

export function shouldPersistNewsletterFormattedContents() {
    return PERSIST_NEWSLETTER_FORMATTED_CONTENTS
}

export function saveNewsletterNotification(event: NotificationEvent) {
    return prisma.newsletterNotifications.create({
        data: {
            messageId: event.messageId,
            rawEvent: event.raw,
            type: event.type,
            notificationId: event.notificationId,
            timestamp: event.timestamp,
        },
    })
}

export async function getNewsletterContent(id: string) {
    const result = await prisma.newsletterBatch.findUnique({
        where: { id },
        select: { contents: true }
    })
    return result && result.contents ? JSON.parse(result.contents) : null
}

export async function saveSystemEmailEvent(event: NotificationEvent) {
    return prisma.newsletterNotifications.create({
        data: {
            messageId: event.messageId,
            rawEvent: event.raw,
            type: event.type,
            notificationId: event.notificationId,
            timestamp: event.timestamp,
        },
    })
}

export async function getNewsletterMessage(messageId: string) {
    return prisma.newsletterMessages.findUnique({
        where: { messageId }
    })
}
