import { prisma } from "@/lib/database"
import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"

const log = logger.child({ path: "dashboard/api/stats" })

export async function GET() {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startOfWeek = new Date(startOfToday)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const [
            totalBatches,
            totalMessages,
            totalErrors,
            totalDelivered,
            totalBounced,
            totalComplaints,
            messagesToday,
            messagesThisWeek,
            messagesThisMonth,
            recentBatches,
        ] = await Promise.all([
            prisma.newsletterBatch.count(),
            prisma.newsletterMessages.count(),
            prisma.newsletterErrors.count(),
            prisma.newsletterNotifications.count({ where: { type: "Delivery" } }),
            prisma.newsletterNotifications.count({ where: { type: "Bounce" } }),
            prisma.newsletterNotifications.count({ where: { type: "Complaint" } }),
            prisma.newsletterMessages.count({ where: { created: { gte: startOfToday } } }),
            prisma.newsletterMessages.count({ where: { created: { gte: startOfWeek } } }),
            prisma.newsletterMessages.count({ where: { created: { gte: startOfMonth } } }),
            prisma.newsletterBatch.findMany({
                orderBy: { created: "desc" },
                take: 10,
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

        const deliveryRate = totalMessages > 0
            ? ((totalDelivered / totalMessages) * 100).toFixed(1)
            : "0.0"

        return Response.json({
            overview: {
                totalBatches,
                totalMessages,
                totalErrors,
                totalDelivered,
                totalBounced,
                totalComplaints,
                deliveryRate: parseFloat(deliveryRate),
            },
            activity: {
                today: messagesToday,
                thisWeek: messagesThisWeek,
                thisMonth: messagesThisMonth,
            },
            recentBatches: recentBatches.map((b) => ({
                id: b.id,
                siteId: b.siteId,
                batchId: b.batchId,
                fromEmail: b.fromEmail,
                created: b.created,
                messageCount: b._count.NewslettersMessages,
                errorCount: b._count.NewslettersErrors,
            })),
        })
    } catch (error) {
        log.error(error, "Stats API error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
