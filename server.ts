import { createServer, IncomingMessage, ServerResponse } from "http"
import next from "next"
import logger from "./lib/core/logger"
import { requestShutdown } from "./lib/core/sqs-worker"
import { processNewsletterEventsQueue, processNewsletterQueue, processSystemEventsQueue } from "./service/background-process"

// ── Config ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || "3000")
const DEV = process.env.NODE_ENV !== "production"
const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS || "10000")

// ── Background workers ──────────────────────────────────────────────────────

const WORKERS = [
    { name: "newsletter-sender", fn: processNewsletterQueue },
    { name: "newsletter-events", fn: processNewsletterEventsQueue },
    { name: "system-events", fn: processSystemEventsQueue },
]

// ── Process-level error handlers ─────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down')
    process.exit(1)
})

// ── Graceful shutdown ────────────────────────────────────────────────────────

let shutdownInProgress = false

function initiateShutdown(source: string, err?: unknown) {
    if (shutdownInProgress) return
    shutdownInProgress = true

    const isSignal = source === 'SIGTERM' || source === 'SIGINT'

    if (isSignal) {
        const msg = `Received ${source} — draining workers (grace ${SHUTDOWN_GRACE_MS}ms)`
        logger.info({ signal: source }, msg)
    } else {
        const detail = err instanceof Error ? err.message : String(err ?? 'unknown reason')
        const msg = `Worker "${source}" stopped — ${detail} (grace ${SHUTDOWN_GRACE_MS}ms)`
        logger.error({ worker: source, err }, msg)
        // Also write to stderr directly so the reason is never lost in async pino buffer
        console.error(`[SHUTDOWN] ${msg}`)
    }

    requestShutdown()

    setTimeout(() => {
        logger.warn("Shutdown grace period expired — forcing exit")
        process.exit(1)
    }, SHUTDOWN_GRACE_MS).unref()
}

process.on('SIGTERM', () => initiateShutdown('SIGTERM'))
process.on('SIGINT', () => initiateShutdown('SIGINT'))

// ── HTTP server ──────────────────────────────────────────────────────────────

const app = next({ dev: DEV })
const handle = app.getRequestHandler()

function requestHandler(req: IncomingMessage, res: ServerResponse) {
    const baseURL = `http://${req.headers.host || 'localhost'}`
    const parsedUrl = new URL(req.url!, baseURL)
    handle(req, res, {
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams),
    } as any)
}

// ── Startup ──────────────────────────────────────────────────────────────────

function start() {
    app.prepare().then(() => {
        createServer(requestHandler).listen(PORT)
        const type = DEV ? "development" : process.env.NODE_ENV
        logger.info(`> Server listening at http://localhost:${PORT} as ${type}`)

        for (const worker of WORKERS) {
            worker.fn()
                .catch((err) => initiateShutdown(worker.name, err))
        }
    }).catch((err) => {
        logger.error(err, "Failed to start server")
        process.exit(1)
    })
}

start()
