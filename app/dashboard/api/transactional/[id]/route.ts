import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"
import { prisma } from "@/lib/database"
import { NextRequest } from "next/server"

const log = logger.child({ module: "dashboard/api/transactional/[id]" })

type PathParam = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: PathParam) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const searchParams = req.nextUrl.searchParams
        const eventsPage = Math.max(1, parseInt(searchParams.get("eventsPage") || "1"))
        const eventsLimit = Math.min(100, Math.max(1, parseInt(searchParams.get("eventsLimit") || "20")))

        const mail = await prisma.systemMails.findUnique({
            where: { id },
            select: {
                id: true,
                messageId: true,
                fromEmail: true,
                toEmail: true,
                subject: true,
                status: true,
                created: true,
                updated: true,
            },
        })

        if (!mail) {
            return Response.json({ error: "Transactional email not found" }, { status: 404 })
        }

        const [totalEvents, events] = await Promise.all([
            prisma.systemMailNotifications.count({ where: { messageId: mail.messageId } }),
            prisma.systemMailNotifications.findMany({
                where: { messageId: mail.messageId },
                orderBy: { timestamp: "desc" },
                skip: (eventsPage - 1) * eventsLimit,
                take: eventsLimit,
                select: {
                    id: true,
                    type: true,
                    notificationId: true,
                    messageId: true,
                    timestamp: true,
                    created: true,
                    rawEvent: true,
                },
            }),
        ])

        return Response.json({
            mail,
            events: {
                data: events.map((e) => ({
                    id: e.id,
                    type: e.type,
                    notificationId: e.notificationId,
                    messageId: e.messageId,
                    timestamp: e.timestamp,
                    created: e.created,
                    rawEvent: e.rawEvent,
                })),
                pagination: {
                    page: eventsPage,
                    limit: eventsLimit,
                    total: totalEvents,
                    totalPages: Math.ceil(totalEvents / eventsLimit),
                },
            },
        })
    } catch (error) {
        log.error(error, "Transactional email detail API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
