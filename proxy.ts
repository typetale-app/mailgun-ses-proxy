import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authentication } from "./lib/authentication";
import logger from "./lib/core/logger";

/**
 * Middleware to check for a valid API key in the request headers
 * @param request - The incoming request
 * @returns NextResponse - The response object
 */

const whitelist = [
    "/healthcheck",
]

const dashboardPublicPaths = [
    "/dashboard/login",
    "/dashboard/api/login",
]

const log = logger.child({ path: "middleware" })

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    if (whitelist.some((path) => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Dashboard routes — use cookie-based session auth
    if (pathname.startsWith("/dashboard")) {
        // Allow public dashboard paths (login page, login API)
        if (dashboardPublicPaths.some((path) => pathname.startsWith(path))) {
            return NextResponse.next();
        }
        // Allow static assets (CSS, JS, images) through
        if (pathname.match(/\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/)) {
            return NextResponse.next();
        }
        // Check session cookie
        const token = request.cookies.get("dashboard_token")?.value
        if (!token) {
            // API routes return 401, pages redirect to login
            if (pathname.startsWith("/dashboard/api/")) {
                return Response.json({ error: "authentication required" }, { status: 401 })
            }
            return NextResponse.redirect(new URL("/dashboard/login", request.url))
        }
        // Verify JWT inline (lightweight check — full verify happens in route)
        // We do a basic structure check here; the route handlers do full crypto verify
        const parts = token.split(".")
        if (parts.length !== 3) {
            if (pathname.startsWith("/dashboard/api/")) {
                return Response.json({ error: "invalid session" }, { status: 401 })
            }
            return NextResponse.redirect(new URL("/dashboard/login", request.url))
        }
        try {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
            if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
                if (pathname.startsWith("/dashboard/api/")) {
                    return Response.json({ error: "session expired" }, { status: 401 })
                }
                return NextResponse.redirect(new URL("/dashboard/login", request.url))
            }
        } catch {
            if (pathname.startsWith("/dashboard/api/")) {
                return Response.json({ error: "invalid session" }, { status: 401 })
            }
            return NextResponse.redirect(new URL("/dashboard/login", request.url))
        }
        return NextResponse.next()
    }

    // API routes — use Basic auth with API key
    const token = request.headers.get("authorization")
    if (token) {
        const result = await authentication(token)
        if (result) {
            return NextResponse.next();
        }
    }
    log.error({ path: pathname }, "API key not found")
    return Response.json({ error: 'authentication failed' }, { status: 401 })
}

// Match all routes
export const config = {
    matcher: "/:path((?!.*\\.(?:css|js|png|jpg|jpeg|gif|webp|svg|ico)).*)",
}