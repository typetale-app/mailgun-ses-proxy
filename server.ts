import dotenv from 'dotenv'
dotenv.config()

import { createServer, IncomingMessage, ServerResponse } from "http"
import next from "next"
import logger from "./lib/core/logger"

import { processNewsletterEventsQueue, processNewsletterQueue, processSystemEventsQueue } from "./service/background-process"

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

    // process the SES queues for emails and events
    processNewsletterQueue()
        .finally(() => process.exit(1))
        .catch((e) => { logger.error(e, "newsletter queue crashed"); process.exit(1) })
    processNewsletterEventsQueue()
        .finally(() => process.exit(1))
        .catch((e) => { logger.error(e, "newsletter events queue crashed"); process.exit(1) })
    processSystemEventsQueue()
        .finally(() => process.exit(1))
        .catch((e) => { logger.error(e, "system events queue crashed"); process.exit(1) })

}).catch((e) => { logger.error(e, "stopping the server."); process.exit(1) })
