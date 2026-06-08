import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"
import { prisma } from "@/lib/database"
import { parsePaginationParams } from "@/lib/utils"
import { NextRequest } from "next/server"

const log = logger.child({ module: "dashboard/api/transactional" })

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = req.nextUrl.searchParams
        const { page, limit } = parsePaginationParams(searchParams)
        const search = searchParams.get("search") || ""
        const statusFilter = searchParams.get("status") || ""
        const sortBy = searchParams.get("sortBy") || "created"
        const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc"

        const where: Record<string, unknown> = {}
        if (search) {
            where.OR = [
                { messageId: { contains: search } },
                { toEmail: { contains: search } },
                { fromEmail: { contains: search } },
                { subject: { contains: search } },
            ]
        }
        if (statusFilter) {
            where.status = statusFilter
        }

        const [total, mails] = await Promise.all([
            prisma.systemMails.count({ where }),
            prisma.systemMails.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    messageId: true,
                    fromEmail: true,
                    toEmail: true,
                    subject: true,
                    status: true,
                    created: true,
                    updated: true,
                    _count: {
                        select: {
                            SystemMailNotifications: true,
                        },
                    },
                    SystemMailNotifications: {
                        orderBy: { timestamp: "desc" },
                        take: 1,
                        select: { type: true, timestamp: true },
                    },
                },
            }),
        ])

        return Response.json({
            data: mails.map((m) => ({
                id: m.id,
                messageId: m.messageId,
                fromEmail: m.fromEmail,
                toEmail: m.toEmail,
                subject: m.subject,
                status: m.status,
                created: m.created,
                updated: m.updated,
                eventCount: m._count.SystemMailNotifications,
                lastEventType: m.SystemMailNotifications[0]?.type || null,
                lastEventAt: m.SystemMailNotifications[0]?.timestamp || null,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        log.error(error, "Transactional emails API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
