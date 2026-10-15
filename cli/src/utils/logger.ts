// Per-function decisions (FID-068 Step 3 — `any` and broad Record types eliminated).
//
// FID-2026-0809-016: Backward-compatible shim. The implementation was split
// into `logger/context.ts`, `logger/sanitize.ts`, and `logger/sink.ts`. All
// public symbols are re-exported and the `logger` facade + analytics error
// wiring are composed here so existing imports resolve unchanged.

import { setAnalyticsErrorLogger } from './analytics'
import { sanitizeSecrets, safeStringify } from './logger/sanitize'
import {
  CHAT_LOG_FILENAME,
  loggingLevels,
  sendAnalyticsAndLog,
} from './logger/sink'

import type { LogValue } from '@savant-code/common/types/contracts/logger'
import type { pino } from 'pino'

export { CHAT_LOG_FILENAME }
export { sanitizeSecrets }
export { safeStringify }
export * from './logger/context'
export { clearLogFile } from './logger/sink'

type LogLevel = (typeof loggingLevels)[number]

/**
 * Wrapper around Pino logger.
 *
 * To also send to Posthog, set data.eventId to type AnalyticsEvent
 *
 * e.g. logger.info({eventId: AnalyticsEvent.SOME_EVENT, field: value}, 'some message')
 */
export const logger: Record<LogLevel, pino.LogFn> = Object.fromEntries(
  loggingLevels.map((level) => {
    return [
      level,
      (data: LogValue, msg?: string, ...args: LogValue[]) =>
        sendAnalyticsAndLog(level, data, msg, ...args),
    ]
  }),
) as unknown as Record<LogLevel, pino.LogFn>

setAnalyticsErrorLogger((error, context) => {
  const err =
    error instanceof Error
      ? error
      : new Error(typeof error === 'string' ? error : 'Unknown analytics error')

  logger.warn(
    {
      analyticsError: true,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack,
      },
      context,
    },
    '[analytics] error',
  )
})
