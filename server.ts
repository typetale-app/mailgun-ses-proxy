import { createServer, IncomingMessage, ServerResponse } from "http"
import { parse } from "url"
import next from "next"
import logger from "./lib/core/logger"
import { processNewsletterEventsQueue, processNewsletterQueue, processSystemEventsQueue } from "./service/background-process"

const port = parseInt(process.env.PORT || "3000")
const dev = process.env.NODE_ENV !== "production"
const app = next({ dev })
const handle = app.getRequestHandler()

const handler = (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
}

app.prepare().then(() => {
    createServer(handler).listen(port)
    const type = dev ? "development" : process.env.NODE_ENV
    logger.info(`> Server listening at http://localhost:${port} as ${type}`)
    
    // process the SES queues for emails and events
    processNewsletterQueue()
        .then(() => process.exit(1))
        .catch((e) => { logger.error(e, "newsletter queue crashed"); process.exit(1) })
    processNewsletterEventsQueue()
        .then(() => process.exit(1))
        .catch((e) => { logger.error(e, "newsletter events queue crashed"); process.exit(1) })
    processSystemEventsQueue()
        .then(() => process.exit(1))
        .catch((e) => { logger.error(e, "system events queue crashed"); process.exit(1) })
    
}).catch((e)=>{logger.error(e, "stopping the server."); process.exit(1)})
