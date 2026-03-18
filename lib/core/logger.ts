import pino from 'pino';

function resolveLogLevel() {
    const envLevel = process.env.LOG_LEVEL
    if (envLevel) return envLevel
    return process.env.NODE_ENV != "production" ? "debug" : "info"
}

const logger = pino({
    level: resolveLogLevel()
});

export default logger.child({ app: "mailgun-ses-proxy" });
