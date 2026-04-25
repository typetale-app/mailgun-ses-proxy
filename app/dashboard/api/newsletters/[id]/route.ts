import { prisma } from "@/lib/database"
import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"
import { NextRequest } from "next/server"

const log = logger.child({ path: "dashboard/api/newsletters/[id]" })

type PathParam = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: PathParam) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await params
        const searchParams = req.nextUrl.searchParams
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))

        const batch = await prisma.newsletterBatch.findUnique({
            where: { id },
            select: {
                id: true,
                siteId: true,
                batchId: true,
                fromEmail: true,
                created: true,
            },
        })

        if (!batch) {
            return Response.json({ error: "Batch not found" }, { status: 404 })
        }

        const [totalMessages, messages, totalErrors, errors] = await Promise.all([
            prisma.newsletterMessages.count({ where: { newsletterBatchId: id } }),
            prisma.newsletterMessages.findMany({
                where: { newsletterBatchId: id },
                orderBy: { created: "desc" },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    messageId: true,
                    toEmail: true,
                    created: true,
                    _count: {
                        select: { notificationEvents: true },
                    },
                },
            }),
            prisma.newsletterErrors.count({ where: { newsletterBatchId: id } }),
            prisma.newsletterErrors.findMany({
                where: { newsletterBatchId: id },
                orderBy: { created: "desc" },
                take: 50,
                select: {
                    id: true,
                    toEmail: true,
                    error: true,
                    created: true,
                    messageId: true,
                },
            }),
        ])

        return Response.json({
            batch,
            messages: {
                data: messages.map((m) => ({
                    id: m.id,
                    messageId: m.messageId,
                    toEmail: m.toEmail,
                    created: m.created,
                    eventCount: m._count.notificationEvents,
                })),
                pagination: {
                    page,
                    limit,
                    total: totalMessages,
                    totalPages: Math.ceil(totalMessages / limit),
                },
            },
            errors: {
                data: errors,
                total: totalErrors,
            },
        })
    } catch (error) {
        log.error(error, "Newsletter detail API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
