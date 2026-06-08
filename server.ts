import dotenv from 'dotenv'
dotenv.config()

import { createServer, IncomingMessage, ServerResponse } from "http"
import next from "next"
import logger from "./lib/core/logger"

import { processNewsletterEventsQueue, processNewsletterQueue, processSystemEventsQueue } from "./service/background-process"
import { requestShutdown } from "./lib/core/sqs-worker"
import { flushLogger } from "./lib/core/logger"

// ── Process-level error handlers ─────────────────────────────────────────────
// Prevent silent crashes from stray promise rejections or uncaught exceptions.

process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down')
    process.exit(1)
})

// ── Graceful shutdown ────────────────────────────────────────────────────────
// On SIGTERM/SIGINT (e.g. Kubernetes pod termination), signal workers to stop
// polling. In-flight handler calls are allowed to finish. After a grace period
// the process exits regardless, so we don't block pod shutdown forever.

const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS || "10000")
let shutdownInProgress = false

function initiateShutdown(signal: string) {
    if (shutdownInProgress) return
    shutdownInProgress = true
    logger.info({ signal }, `${signal} received — draining workers (grace ${SHUTDOWN_GRACE_MS}ms)`)
    flushLogger()
    requestShutdown()

    // Hard-stop fallback: if workers don't finish within the grace period,
    // exit anyway so the container runtime is not forced to SIGKILL us.
    setTimeout(() => {
        logger.warn("Shutdown grace period expired — forcing exit")
        process.exit(1)
    }, SHUTDOWN_GRACE_MS).unref()
}

process.on('SIGTERM', () => initiateShutdown('SIGTERM'))
process.on('SIGINT', () => initiateShutdown('SIGINT'))

// ── Server startup ───────────────────────────────────────────────────────────

// ── Process-level error handlers ─────────────────────────────────────────────
// Prevent silent crashes from stray promise rejections or uncaught exceptions.

process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception — shutting down')
    process.exit(1)
})

// ── Server startup ───────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT || "3000")
const dev = process.env.NODE_ENV !== "production"

const app = next({ dev })
const handle = app.getRequestHandler()

const handler = (req: IncomingMessage, res: ServerResponse) => {
    const baseURL = `http://${req.headers.host || 'localhost'}`
    const parsedUrl = new URL(req.url!, baseURL)
    handle(req, res, {
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams)
    } as any)
}

app.prepare().then(() => {
    createServer(handler).listen(port)
    const type = dev ? "development" : process.env.NODE_ENV
    logger.info(`> Server listening at http://localhost:${port} as ${type}`)

    // Workers run as background loops. We wait for ALL of them to settle
    // before exiting, so one crashing worker doesn't kill the others mid-flight.
    const workerPromises = [
        processNewsletterQueue()
            .then(() => logger.error("newsletter-sender stopped unexpectedly"))
            .catch((e) => { logger.error(e, "newsletter-sender crashed") }),

        processNewsletterEventsQueue()
            .then(() => logger.error("newsletter-events stopped unexpectedly"))
            .catch((e) => { logger.error(e, "newsletter-events crashed") }),

        processSystemEventsQueue()
            .then(() => logger.error("system-events stopped unexpectedly"))
            .catch((e) => { logger.error(e, "system-events crashed") }),
    ]

    Promise.allSettled(workerPromises).then((results) => {
        for (const r of results) {
            if (r.status === "rejected") {
                logger.error({ err: r.reason }, "Worker settled with rejection")
            }
        }
        logger.error("All workers have stopped — exiting process")
        process.exit(1)
    })

}).catch((e) => { logger.error(e, "stopping the server."); process.exit(1) })
