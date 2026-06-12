import bunyan from 'bunyan';

const logger = bunyan.createLogger({
    name: 'mailgun-ses-proxy',
    stream: process.stdout,
    level: 'info'
});

export default logger
