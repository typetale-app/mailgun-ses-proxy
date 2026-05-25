import dotenv from 'dotenv'
dotenv.config()

import { createServer, IncomingMessage, ServerResponse } from "http"
import next from "next"
import logger from "./lib/core/logger"

import { processNewsletterEventsQueue, processNewsletterQueue, processSystemEventsQueue } from "./service/background-process"

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

    // Workers run as fire-and-forget background loops. If any worker exits
    // (after exhausting the inner resilience in sqs-worker.ts), we exit the
    // process so Kubernetes can restart the pod.
    processNewsletterQueue()
        .then(() => logger.error("newsletter-sender stopped unexpectedly"))
        .catch((e) => { logger.error(e, "newsletter-sender crashed") })
        .finally(() => process.exit(1))

    processNewsletterEventsQueue()
        .then(() => logger.error("newsletter-events stopped unexpectedly"))
        .catch((e) => { logger.error(e, "newsletter-events crashed") })
        .finally(() => process.exit(1))

    processSystemEventsQueue()
        .then(() => logger.error("system-events stopped unexpectedly"))
        .catch((e) => { logger.error(e, "system-events crashed") })
        .finally(() => process.exit(1))

}).catch((e) => { logger.error(e, "stopping the server."); process.exit(1) })
