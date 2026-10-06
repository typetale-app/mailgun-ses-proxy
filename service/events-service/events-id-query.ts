import { EventsProps } from "@/types/default"
import { Prisma } from "../../lib/generated"

/** Keep upstream's UUID/id order and offset contract; do not introduce a cursor. */
export function buildAnalyticsIdPage(params: EventsProps, eventTypes: string[], skip: number, take: number) {
    const count = skip + take
    if (!Number.isSafeInteger(skip) || skip < 0 || !Number.isSafeInteger(take) || take < 1 || !Number.isSafeInteger(count)) {
        throw new Error("Invalid analytics pagination")
    }
    const types = [...new Set(eventTypes)]
    if (!types.length) throw new Error("Missing analytics event type")
    const order = params.order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`
    const perType = (type: string) => Prisma.sql`
        SELECT n.id
        FROM NewsletterNotifications AS n FORCE INDEX (idx_notifications_type_id_created)
        STRAIGHT_JOIN NewsletterMessages AS m ON m.messageId = n.messageId
        STRAIGHT_JOIN NewsletterBatch AS b ON b.id = m.newsletterBatchId
        WHERE n.type = ${type} AND b.siteId = ${params.siteId}
          AND n.created > ${new Date(params.begin * 1000)}
          AND n.created < ${new Date(params.end * 1000)}
        ORDER BY n.id ${order}
        LIMIT ${count}
    `
    // Each event has exactly one type. The first skip+take rows per type
    // suffice to reproduce the global page; duplicate requested types must
    // not duplicate events. SQL UNION also deduplicates types equivalent
    // under the DB collation (e.g. accents), unlike JavaScript Set alone.
    // Sorting these IDs avoids sorting rawEvent payloads.
    const candidates = types.length === 1
        ? perType(types[0])
        : Prisma.join(types.map(type => Prisma.sql`(${perType(type)})`), " UNION ")
    return Prisma.sql`
        SELECT page.id FROM (${candidates}) AS page
        ORDER BY page.id ${order}
        LIMIT ${take} OFFSET ${skip}
    `
}
