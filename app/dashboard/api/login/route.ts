import { prisma } from "@/lib/database"
import { verifyPassword, createSession, setSessionCookie, ensureDefaultUser, hashPassword } from "@/lib/dashboard/auth"
import logger from "@/lib/core/logger"

const log = logger.child({ path: "dashboard/api/login" })

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, newEmail, newPassword } = body as { email?: string; password?: string; newEmail?: string; newPassword?: string }

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

        if (user.email === "admin@localhost" && (!newEmail || !newPassword)) {
            return Response.json({
                requireUpdate: true,
                message: "Please update your default credentials",
            })
        }

        let finalUserId = user.id
        let finalEmail = user.email

        if (user.email === "admin@localhost" && newEmail && newPassword) {
            const hash = await hashPassword(newPassword)
            const updated = await prisma.dashboardUser.update({
                where: { id: user.id },
                data: { email: newEmail, password: hash }
            })
            finalUserId = updated.id
            finalEmail = updated.email
            log.info({ oldEmail: email, newEmail }, "Default credentials updated")
        }

        const token = await createSession(finalUserId, finalEmail, user.name || "")
        const response = Response.json({
            ok: true,
            user: { id: finalUserId, email: finalEmail, name: user.name },
        })
        setSessionCookie(response, token)
        log.info({ email: finalEmail }, "Successful dashboard login")
        return response
    } catch (error) {
        log.error(error, "Login error")
        return Response.json({ error: "Internal server error" }, { status: 500 })
    }
}
