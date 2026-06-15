import { formatAsMailgunEvent } from "../lib/email/events"
import { createEventProcessor } from "../lib/email/processor"
import { QueryParams } from "../types/default"
import { db, prisma } from "./db-service"


export class EventsService {

    /** Processes SES delivery/bounce notifications for newsletter emails (idempotent). */
    readonly handleNewsletterEvent = createEventProcessor({
        name: "newsletter-events",
        lookupMessage: db.getNewsletterMessage.bind(db),
        saveNotification: db.saveNewsletterNotification.bind(db),
    })

    /**
     * Validates and parses Mailgun-compatible query parameters from a URL search string.
     * Throws if any required parameter is missing.
     */
    parseEventQuery(searchParams: URLSearchParams): QueryParams {
        const require = (key: string) => {
            const value = searchParams.get(key)
            if (!value) throw new Error(`Missing required query parameter: ${key}`)
            return value
        }
        return {
            start: parseInt(searchParams.get("start") ?? "0"),
            limit: parseInt(searchParams.get("limit") ?? "300"),
            event: require("event"),
            begin: parseInt(require("begin")),
            end: parseInt(require("end")),
            order: searchParams.get("ascending") ? "asc" : "desc",
        }
    }

    /**
     * Fetches newsletter notification events from the DB and formats them
     * as Mailgun-compatible paginated events.
     */
    async getEvents(query: QueryParams, siteId: string, requestUrl: string) {
        const skip = query.start ?? 0
        const take = query.limit ?? 300

        // Mailgun sends compound types like "delivered OR opened"
        const types = query.event.includes("OR")
            ? query.event.split("OR").map(s => s.trim().toLowerCase())
            : [query.event.toLowerCase()]

        const timeRange = {
            gt: new Date(query.begin * 1000),
            lt: new Date(query.end * 1000),
        }

        const rows = await prisma.newsletterNotifications.findMany({
            skip,
            take,
            orderBy: { id: query.order },
            include: { newsletter: { include: { newsletterBatch: true } } },
            where: {
                type: { in: types },
                newsletter: { newsletterBatch: { siteId } },
                created: timeRange,
            },
        })

        const nextUrl = this.buildNextPageUrl(requestUrl, skip + take)
        return formatAsMailgunEvent(rows, nextUrl)
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private buildNextPageUrl(baseUrl: string, nextStart: number): string {
        try {
            const url = new URL(baseUrl)
            url.searchParams.set("start", String(nextStart))
            return url.toString()
        } catch {
            return `${baseUrl}?start=${nextStart}`
        }
    }
}

export const eventsService = new EventsService()
