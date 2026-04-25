import { prisma } from "@/lib/database"
import { getSessionFromCookies } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"

const log = logger.child({ path: "dashboard/api/settings" })

// Settings that can be managed via the dashboard
const MANAGED_SETTINGS = [
    { key: "NEWSLETTER_QUEUE_URL", label: "Newsletter Queue URL", type: "text" },
    { key: "NEWSLETTER_NOTIFICATION_QUEUE_URL", label: "Newsletter Notification Queue URL", type: "text" },
    { key: "SYSTEM_EMAIL_NOTIFICATION", label: "System Email Notification Queue URL", type: "text" },
    { key: "AWS_DEFAULT_REGION", label: "AWS Default Region", type: "text" },
    { key: "AWS_NEWSLETTER_CONFIGURATION_SET_NAME", label: "Newsletter Configuration Set", type: "text" },
    { key: "AWS_TRANSACTIONAL_CONFIGURATION_SET_NAME", label: "Transactional Configuration Set", type: "text" },
    { key: "PERSIST_NEWSLETTER_FORMATTED_CONTENTS", label: "Persist Newsletter Formatted Contents", type: "boolean" },
    { key: "SYSTEM_FROM_ADDRESS", label: "System From Address", type: "text" },
] as const

export async function GET() {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const dbSettings = await prisma.dashboardSettings.findMany()
        const settingsMap = new Map(dbSettings.map((s) => [s.key, s.value]))

        const settings = MANAGED_SETTINGS.map((def) => ({
            ...def,
            value: settingsMap.get(def.key) ?? process.env[def.key] ?? "",
            source: settingsMap.has(def.key) ? "database" as const : "environment" as const,
        }))

        return Response.json({ settings })
    } catch (error) {
        log.error(error, "Settings GET error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return Response.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { settings } = body as { settings: { key: string; value: string }[] }

        if (!Array.isArray(settings)) {
            return Response.json({ error: "Invalid settings format" }, { status: 400 })
        }

        const validKeys: Set<string> = new Set(MANAGED_SETTINGS.map((s) => s.key))

        const operations = settings
            .filter((s) => validKeys.has(s.key))
            .map((s) =>
                prisma.dashboardSettings.upsert({
                    where: { key: s.key },
                    update: { value: s.value },
                    create: { key: s.key, value: s.value },
                })
            )

        await Promise.all(operations)
        log.info({ count: operations.length, user: session.email }, "Settings updated")

        return Response.json({ ok: true, updated: operations.length })
    } catch (error) {
        log.error(error, "Settings PUT error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
