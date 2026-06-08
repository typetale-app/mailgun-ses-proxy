import { NotificationEvent } from "../../lib/core/aws-utils"
import { safeStringify } from "../../lib/core/common"
import { prisma } from "../../lib/database"
import { MailgunMessage } from "../../types/mailgun"
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

function prepareNotificationData(event: NotificationEvent) {
    return {
        messageId: event.messageId,
        rawEvent: event.raw,
        type: event.type,
        notificationId: event.notificationId,
        timestamp: event.timestamp,
    }
}

export function saveNewsletterNotification(event: NotificationEvent) {
    const data = prepareNotificationData(event)
    return prisma.newsletterNotifications.upsert({
        where: { notificationId: event.notificationId },
        create: data,
        update: data,
    })
}

export async function checkNewsletterAlreadySent(batchId: string, toEmail: string) {
    const existing = await prisma.newsletterMessages.findFirst({
        where: {
            newsletterBatchId: batchId,
            toEmail,
        },
        select: { id: true },
    })
    return !!existing
}

export async function getNewsletterContent(newsletterBatchId: string) {
    const result = await prisma.newsletterBatch.findUnique({
        where: { id: newsletterBatchId },
        select: { contents: true }
    })

    if (!result || !result.contents) return null

    try {
        return JSON.parse(result.contents)
    } catch (err) {
        throw new Error(
            `Failed to parse newsletter batch contents (batchId=${newsletterBatchId}): ${err instanceof Error ? err.message : err}`
        )
    }
}

export function saveSystemEmailEvent(event: NotificationEvent) {
    const data = prepareNotificationData(event)
    return prisma.systemMailNotifications.upsert({
        where: { notificationId: event.notificationId },
        create: data,
        update: data,
    })
}

export async function getNewsletterMessage(messageId: string) {
    return prisma.newsletterMessages.findUnique({
        where: { messageId }
    })
}

export async function getSystemMessage(messageId: string) {
    return prisma.systemMails.findUnique({
        where: { messageId }
    })
}
