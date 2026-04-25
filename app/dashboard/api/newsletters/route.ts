import { prisma } from "@/lib/database"
import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"
import { NextRequest } from "next/server"

const log = logger.child({ path: "dashboard/api/newsletters" })

export async function GET(req: NextRequest) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = req.nextUrl.searchParams
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")))
        const search = searchParams.get("search") || ""
        const sortBy = searchParams.get("sortBy") || "created"
        const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc"

        const where: Record<string, unknown> = {}
        if (search) {
            where.OR = [
                { batchId: { contains: search } },
                { siteId: { contains: search } },
                { fromEmail: { contains: search } },
            ]
        }

        const [total, batches] = await Promise.all([
            prisma.newsletterBatch.count({ where }),
            prisma.newsletterBatch.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    siteId: true,
                    batchId: true,
                    fromEmail: true,
                    created: true,
                    _count: {
                        select: {
                            NewslettersMessages: true,
                            NewslettersErrors: true,
                        },
                    },
                },
            }),
        ])

        return Response.json({
            data: batches.map((b) => ({
                id: b.id,
                siteId: b.siteId,
                batchId: b.batchId,
                fromEmail: b.fromEmail,
                created: b.created,
                messageCount: b._count.NewslettersMessages,
                errorCount: b._count.NewslettersErrors,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        log.error(error, "Newsletters API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
