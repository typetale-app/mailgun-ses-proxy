import { prisma } from "@/lib/database"
import { verifyPassword, createSession, setSessionCookie, ensureDefaultUser } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"

const log = logger.child({ path: "dashboard/api/login" })

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password } = body as { email?: string; password?: string }

        if (!email || !password) {
            return Response.json({ error: "Email and password are required" }, { status: 400 })
        }

        // Ensure default admin user exists on first login attempt
        await ensureDefaultUser()

        const user = await prisma.dashboardUser.findUnique({ where: { email } })
        if (!user) {
            log.warn({ email }, "Login attempt for non-existent user")
            return Response.json({ error: "Invalid credentials" }, { status: 401 })
        }

        const valid = await verifyPassword(password, user.password)
        if (!valid) {
            log.warn({ email }, "Login attempt with invalid password")
            return Response.json({ error: "Invalid credentials" }, { status: 401 })
        }

        const token = await createSession(user.id, user.email, user.name || "")
        const response = Response.json({
            ok: true,
            user: { id: user.id, email: user.email, name: user.name },
        })
        setSessionCookie(response, token)
        log.info({ email }, "Successful dashboard login")
        return response
    } catch (error) {
        log.error(error, "Login error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
