import pino from 'pino'

function resolveLogLevel() {
    const envLevel = process.env.LOG_LEVEL
    if (envLevel) return envLevel
    return process.env.NODE_ENV != "production" ? "debug" : "info"
}

const destination = pino.destination({ sync: false, maxLength: 1024 })

const logger = pino(
    { level: resolveLogLevel() },
    destination,
)

/** Flush buffered log entries (call before process exit). */
export function flushLogger(): void {
    destination.flushSync()
}

export default logger.child({ app: "mailgun-ses-proxy" })
