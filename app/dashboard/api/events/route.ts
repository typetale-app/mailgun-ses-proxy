import { prisma } from "@/lib/database"
import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"
import { NextRequest } from "next/server"

const log = logger.child({ path: "dashboard/api/events" })

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = req.nextUrl.searchParams
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
        const type = searchParams.get("type") || ""
        const search = searchParams.get("search") || ""
        const sortBy = searchParams.get("sortBy") || "timestamp"
        const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc"

        const where: Record<string, unknown> = {}
        if (type) {
            where.type = type
        }
        if (search) {
            where.OR = [
                { messageId: { contains: search } },
                { notificationId: { contains: search } },
            ]
        }

        const [total, events] = await Promise.all([
            prisma.newsletterNotifications.count({ where }),
            prisma.newsletterNotifications.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    type: true,
                    notificationId: true,
                    messageId: true,
                    timestamp: true,
                    created: true,
                    newsletter: {
                        select: {
                            toEmail: true,
                        },
                    },
                },
            }),
        ])

        // Get distinct event types for the filter dropdown
        const eventTypes = await prisma.newsletterNotifications.findMany({
            distinct: ["type"],
            select: { type: true },
        })

        return Response.json({
            data: events.map((e) => ({
                id: e.id,
                type: e.type,
                notificationId: e.notificationId,
                messageId: e.messageId,
                toEmail: e.newsletter?.toEmail || "N/A",
                timestamp: e.timestamp,
                created: e.created,
            })),
            eventTypes: eventTypes.map((t) => t.type),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        log.error(error, "Events API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
