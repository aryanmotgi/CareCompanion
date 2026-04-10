type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  route?: string
  method?: string
  duration?: number
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL]
}

function formatLog(level: LogLevel, message: string, context?: LogContext) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  })
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (shouldLog('debug')) console.debug(formatLog('debug', message, context))
  },
  info(message: string, context?: LogContext) {
    if (shouldLog('info')) console.log(formatLog('info', message, context))
  },
  warn(message: string, context?: LogContext) {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, context))
  },
  error(message: string, context?: LogContext) {
    if (shouldLog('error')) console.error(formatLog('error', message, context))
  },
}
