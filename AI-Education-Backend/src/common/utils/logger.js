import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'education-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// Without this, any transport failure emits an unhandled 'error' event on
// the logger — which, since Logger is a Node EventEmitter, throws and
// crashes the entire process just because one log line couldn't be
// written. Logging the failure to the console keeps it visible without
// ever taking the app down over it.
logger.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[logger] transport error (non-fatal):', err?.message || err);
});

export const logInfo = (message, meta = {}) => logger.info(message, meta);
export const logDebug = (message, meta = {}) => logger.debug(message, meta);
export const logWarn = (message, meta = {}) => logger.warn(message, meta);
export const logError = (message, err, meta = {}) => {
  if (err instanceof Error) {
    logger.error(message, { error: err.message, stack: err.stack, ...meta });
  } else {
    logger.error(message, { ...err, ...meta });
  }
};

export default logger;
