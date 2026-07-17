import { pino } from 'pino'

/**
 * Lightweight structured logger for the SDK.
 *
 * Uses pino for JSON-structured output. No file shipping, no analytics,
 * no CLI-specific context — just leveled diagnostic logging.
 */

export const logger = pino({
  level: process.env.SDK_LOG_LEVEL ?? 'warn',
  name: 'codebuff-sdk',
})

export default logger
