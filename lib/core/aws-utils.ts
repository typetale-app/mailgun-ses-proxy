import { SendEmailRequest } from "@aws-sdk/client-sesv2"
import { replaceAll } from "./common"
import { MailgunEvents, MailgunRecipientVariables } from "@/types/default"
import { Prisma } from "../generated"
import { MailgunMessage } from "@/types/mailgun"

function doSubstitution(inputText: string, substitutions: MailgunRecipientVariables[0]) {
    for (const key of Object.keys(substitutions)) {
        inputText = replaceAll(
            inputText,
            `%recipient.${key}%`,
            substitutions[key as keyof MailgunRecipientVariables[0]]
        )
    }
    return inputText
}

export interface PreparedEmail {
    request: SendEmailRequest
    recipientVariables: MailgunRecipientVariables[0]
}

export function preparePayload(input: any, siteId: string): PreparedEmail[] {
    const recepientVariables = JSON.parse(input["recipient-variables"]) as MailgunRecipientVariables
    const receivers = Array.isArray(input.to) ? input.to : [input.to]
    const result = receivers.map((receiverEmail: string | number) => ({
        request: {
            ConfigurationSetName: process.env.NEWSLETTER_CONFIGURATION_SET_NAME,
            FromEmailAddress: input.from,
            Destination: { ToAddresses: [receiverEmail] },
            ReplyToAddresses: [input["h:Reply-To"]],
            Content: {
                Simple: {
                    Subject: {
                        Data: input.subject,
                    },
                    Body: {
                        Text: {
                            Data: doSubstitution(input.text, recepientVariables[receiverEmail]),
                        },
                        Html: {
                            Data: doSubstitution(input.html, recepientVariables[receiverEmail]),
                        },
                    },
                    Headers: [
                        {
                            Name: "List-Unsubscribe-Post",
                            Value: "List-Unsubscribe=One-Click",
                        },
                        {
                            Name: "List-Unsubscribe",
                            Value: `<${recepientVariables[receiverEmail].unsubscribe_url}>`,
                        },
                    ],
                },
            },
            EmailTags: [
                {
                    Name: "siteId",
                    Value: siteId,
                },
                {
                    Name: "batchId",
                    Value: input["v:email-id"],
                },
                {
                    Name: "ghost-email",
                    Value: "true",
                },
            ],
        },
        recipientVariables: recepientVariables[receiverEmail],
    }))
    return result
}

const awsToMailgunType = {
    Reject: "Rejected",
    Bounce: "Failed",
    // None: "Stored", <- not aws type
    Complaint: "Complained",
    Subscription: "Unsubscribed",
    Click: "Clicked",
    Open: "Opened",
    RenderingFailure: "Rejected",
    Delivery: "Delivered",
    Send: "Accepted",
}

export interface NotificationEvent {
    notificationId: string
    type: string
    messageId: string
    timestamp: Date
    raw: any
}

function normalizeEventTimestamp(value: string | Date | undefined, fallback = new Date()) {
    if (!value) return fallback
    if (value instanceof Date) return value

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export function parseNotificationEvent(messageId: string, inputEvent: string): NotificationEvent {
    const event = JSON.parse(inputEvent) as {
        eventType: keyof typeof awsToMailgunType
        mail: { messageId: string, timestamp?: string | Date }
        open?: { timestamp?: string | Date }
    }
    return {
        notificationId: messageId,
        type: String(awsToMailgunType[event.eventType]).toLocaleLowerCase(),
        messageId: event.mail.messageId.replace(/^<|>$/g, "").split("@")[0],
        timestamp: normalizeEventTimestamp(event.open?.timestamp || event.mail.timestamp, new Date()),
        raw: inputEvent,
    }
}

type MailgunEventPayload = Prisma.NewsletterNotificationsGetPayload<{
    include: { newsletter: { include: { newsletterBatch: true } } }
}>

export function formatAsMailgunEvent(event: MailgunEventPayload[], url: string) {
    const format = (event: MailgunEventPayload) => {
        const eventTimestamp = (event.timestamp || event.created).getTime()
        const originalSESEvent = JSON.parse(event.rawEvent)
        const out = {
            event: event.type,
            id: `${event.id}-${event.messageId}`,
            timestamp: Math.floor(eventTimestamp / 1000),
            recipient: event.newsletter.toEmail,
            message: {
                headers: {
                    "message-id": event.newsletter.newsletterBatch.batchId,
                    "to": event.newsletter.toEmail
                },
            },
        } as MailgunEvents

        if (originalSESEvent.eventType == "Bounce") {
            out["severity"] = "permanent"
            out["reason"] = "suppress-bounce"
        }

        return out
    }

    return {
        items: event.map(format),
        paging: { next: url },
    }
}
