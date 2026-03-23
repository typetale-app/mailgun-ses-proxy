import { EventsProps, QueryParams } from "@/types/default"
import { getNewsletterMessage, prisma, saveNewsletterNotification } from "./database/db"
import { formatAsMailgunEvent, parseNotificationEvent } from "../lib/core/aws-utils"
import { DeleteMessageCommand, ReceiveMessageCommandOutput } from "@aws-sdk/client-sqs"
import logger from "../lib/core/logger"
import { QUEUE_URL, sqsClient } from "./aws/awsHelper"

function upsertStartParam(url: string, startVal: number) {
    url = url.slice(0, url.lastIndexOf("?"))
    const urlObject = new URL(`${url}/next`)
    const params = new URLSearchParams()
    params.set("start", String(startVal))
    urlObject.search = params.toString()
    return urlObject.toString()
}

export async function getEmailEvents(params: EventsProps) {
    let skip = params.start || 0
    let take = params.limit || 300

    let type = [params.type]
    if (params.type.includes("OR")) {
        type = params.type.split("OR").map((s) => s.trim().toLocaleLowerCase())
    }

    const range = { gt: new Date(params.begin * 1000), lt: new Date(params.end * 1000) }

    const result = await prisma.newsletterNotifications.findMany({
        skip: skip,
        take: take,
        orderBy: { id: params.order },
        include: { newsletter: { include: { newsletterBatch: true } } },
        where: {
            type: { in: type },
            newsletter: { newsletterBatch: { siteId: params.siteId } },
            created: range,
        },
    })

    const next = upsertStartParam(params.url, skip + take)
    const output = await formatAsMailgunEvent(result, next)
    return output
}

export function validateQueryParams(searchParams: URLSearchParams): QueryParams {
    const exception = (missingParam: string) => {
        throw `Missing query param (${missingParam})`
    }

    const event = searchParams.get("event") || exception("event")
    const begin = searchParams.get("begin") || exception("begin")
    const end = searchParams.get("end") || exception("end")

    const queryParams = {
        start: parseInt(searchParams.get("start") || "0"),
        limit: parseInt(searchParams.get("limit") || "300"),
        event: event,
        begin: parseInt(begin),
        end: parseInt(end),
        order: searchParams.get("ascending") ? "asc" : "desc",
    } as QueryParams

    return queryParams
}

export async function fetchAnalyticsEvents(queryParams: QueryParams, siteId: string, url: string) {
    const response = await getEmailEvents({
        siteId,
        type: queryParams.event,
        begin: queryParams.begin,
        end: queryParams.end,
        order: queryParams.order,
        limit: queryParams.limit,
        start: queryParams.start,
        url,
    })
    return response
}


export async function processNewsletterEmailEvents(response: ReceiveMessageCommandOutput) {
    const log = logger.child({ service: "processEmailEvents" })
    if (!response.Messages || response.Messages.length == 0)
        throw new Error("No messages found")
    for (const msg of response.Messages) {
        if (msg.Body && msg.MessageId) {
            try {
                const result = parseNotificationEvent(msg.MessageId, msg.Body)
                const message = await getNewsletterMessage(msg.MessageId)
                if (message) {
                    await saveNewsletterNotification(result)
                }
                const command = new DeleteMessageCommand({
                    QueueUrl: QUEUE_URL.NEWSLETTER_NOTIFICATION,
                    ReceiptHandle: msg.ReceiptHandle,
                })
                await sqsClient().send(command)
            } catch (e) {
                log.error(e, `[processNewsletterEmailEvents] Failed to process message ${msg.MessageId}`)
            }
        }
    }
}