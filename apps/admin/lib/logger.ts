import pino, { type LoggerOptions } from 'pino'

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

const baseOptions: LoggerOptions = {
  level,
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'starter-admin',
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'request.headers.authorization',
      'request.headers.cookie',
      'headers.authorization',
      'headers.cookie',
    ],
    remove: true,
  },
}

export const loggerOptions = baseOptions
export const logger = pino(baseOptions)

type ErrorLogger = {
  error: (obj: unknown, msg?: string) => void
}

export function logError(
  log: ErrorLogger,
  error: unknown,
  context: Record<string, unknown>,
  message: string,
) {
  const err = error instanceof Error ? error : new Error(String(error))
  log.error({ err, ...context }, message)
}
