// Per-function decisions (FID-068 Step 3 — `any` and broad Record types eliminated):
// - LoggerContext.[key: string]           → `unknown` → `LogValue | undefined`
// - isEmptyObject(value: unknown)         → `unknown` → `LogValue`
// - sendAnalyticsAndLog(level, data: unknown, msg?: string, ...args: unknown[]) → `LogValue` for all log inputs
// - logAsErrorIfNeeded.toTrack.data       → `unknown` → `LogValue`; inline safeToJSONValue conversion for logError
// - logger wrappers (data: unknown, msg?: string, ...args: unknown[]) → `LogValue`
// - pino call site                        → typed with `LogValue` and final `as unknown as Record<LogLevel, pino.LogFn>` cast
import { appendFileSync } from 'fs'
import path from 'path'
import { format as stringFormat } from 'util'

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { env, IS_DEV, IS_TEST, IS_CI } from '@savant-code/common/env'
import { createAnalyticsDispatcher } from '@savant-code/common/util/analytics-dispatcher'
import { getAnalyticsEventId } from '@savant-code/common/util/analytics-log'
import {
  isFullTelemetryEnabled,
  summarizeAnalyticsValue,
} from '@savant-code/common/util/analytics-sampling'
import { getAxiomOnlyLogEvent } from '@savant-code/common/util/axiom-only-log'
import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import { getCurrentChatDir, getProjectRoot } from '../../project-files'
import {
  flushAnalytics,
  isAnalyticsEnabled,
  registerAnalyticsConsentListener,
  logError,
  trackEvent,
} from '../analytics'
import { enqueueClientLog } from '../log-shipper'
import {
  loggerContext,
  loggerContextToRecord,
  isEmptyObject,
  type LoggerContext,
} from './context'
import {
  CHAT_LOG_FILENAME,
  getLogPath,
  getPinoLogger,
  setLogPath,
} from './file-sink'
import { sanitizeSecrets, safeStringify } from './sanitize'

export { CHAT_LOG_FILENAME, clearLogFile } from './file-sink'

import type { LogRecordInput } from '@savant-code/common/schemas/logs'
import type { LogValue } from '@savant-code/common/types/contracts/logger'
import type { JSONValue } from '@savant-code/common/types/json'

export const loggingLevels = [
  'info',
  'debug',
  'warn',
  'error',
  'fatal',
] as const
export type LogLevel = (typeof loggingLevels)[number]

const analyticsDispatcher = createAnalyticsDispatcher({
  envName: env.NEXT_PUBLIC_CB_ENVIRONMENT,
  bufferWhenNoUser: true,
})

registerAnalyticsConsentListener((enabled) => {
  if (!enabled) {
    analyticsDispatcher.clearBuffer()
  }
})

export function sendAnalyticsAndLog(
  level: LogLevel,
  data: LogValue,
  msg?: string,
  ...args: LogValue[]
): void {
  if (!IS_CI && !IS_TEST) {
    let projectRoot: string | undefined
    try {
      projectRoot = getProjectRoot()
    } catch {
      projectRoot = undefined
    }
    if (projectRoot) {
      const logTarget = IS_DEV
        ? path.join(projectRoot, 'debug', 'cli.jsonl')
        : path.join(getCurrentChatDir(), CHAT_LOG_FILENAME)

      setLogPath(logTarget)
    }
  }

  const isStringOnly = typeof data === 'string' && msg === undefined
  const normalizedData = isStringOnly ? undefined : data
  const normalizedMsg = isStringOnly ? (data as string) : msg
  const includeData = normalizedData != null && !isEmptyObject(normalizedData)
  // Sanitize once before any disk, network, or analytics use.
  const sanitizedData = includeData
    ? sanitizeSecrets(normalizedData)
    : normalizedData
  const axiomOnlyLogEvent = getAxiomOnlyLogEvent(sanitizedData)

  const toTrack = {
    ...(includeData ? { data: sanitizedData } : {}),
    level,
    loggerContext,
    msg: stringFormat(normalizedMsg, ...args),
  }

  logAsErrorIfNeeded(toTrack)

  if (
    isAnalyticsEnabled() &&
    !IS_DEV &&
    includeData &&
    typeof sanitizedData === 'object'
  ) {
    const analyticsPayloads = analyticsDispatcher.process({
      data: sanitizedData,
      level,
      msg: stringFormat(normalizedMsg ?? '', ...args),
      fallbackUserId: loggerContext.userId,
    })

    analyticsPayloads.forEach((payload) => {
      trackEvent(payload.event, payload.properties as Record<string, JSONValue>)
    })
  }

  // Send all log events to PostHog in production for better observability
  // Skip if the log already has an eventId (to avoid duplicate tracking)
  const hasEventId = includeData && getAnalyticsEventId(sanitizedData) !== null
  if (
    isAnalyticsEnabled() &&
    !IS_DEV &&
    !IS_TEST &&
    !IS_CI &&
    !hasEventId &&
    !axiomOnlyLogEvent
  ) {
    const fullTelemetry = isFullTelemetryEnabled({
      distinctId: loggerContext.userId,
      properties: loggerContextToRecord(loggerContext),
    })
    const includeRawData =
      fullTelemetry || level === 'error' || level === 'fatal'
    const dataProperties: Record<string, JSONValue> =
      includeData && includeRawData
        ? { data: safeToJSONValue(sanitizedData) }
        : includeData
          ? {
              dataSummary: summarizeAnalyticsValue(
                safeToJSONValue(sanitizedData),
              ),
            }
          : {}

    trackEvent(AnalyticsEvent.CLI_LOG, {
      level,
      msg: stringFormat(normalizedMsg ?? '', ...args),
      ...dataProperties,
      ...loggerContextToRecord(loggerContext),
    })
  }

  // Mirror the log/event into the server-side Axiom logs sink via /api/logs
  // (in addition to PostHog). Best-effort and batched; skip noisy debug logs
  // and anything before we know who the user is.
  if (
    isAnalyticsEnabled() &&
    !IS_DEV &&
    !IS_TEST &&
    !IS_CI &&
    loggerContext.userId &&
    level !== 'debug'
  ) {
    const analyticsEventId =
      includeData && typeof normalizedData === 'object'
        ? getAnalyticsEventId(normalizedData)
        : null
    // Mirror the PostHog path's redaction: only ship raw payloads for errors or
    // when full telemetry is enabled; otherwise ship a summary. Keeps PII/data
    // volume symmetric across the two sinks.
    const includeRawData =
      isFullTelemetryEnabled({
        distinctId: loggerContext.userId,
        properties: loggerContextToRecord(loggerContext),
      }) ||
      level === 'error' ||
      level === 'fatal'
    const shipData = axiomOnlyLogEvent
      ? axiomOnlyLogEvent.data
      : includeData
        ? includeRawData
          ? sanitizedData
          : summarizeAnalyticsValue(safeToJSONValue(sanitizedData))
        : undefined
    const record: LogRecordInput = {
      timestamp: new Date().toISOString(),
      level,
      event:
        axiomOnlyLogEvent?.event ??
        (analyticsEventId ? String(analyticsEventId) : undefined),
      message: stringFormat(normalizedMsg ?? '', ...args),
      client_session_id:
        (axiomOnlyLogEvent?.data.client_session_id as string | undefined) ??
        loggerContext.clientSessionId,
      client_request_id:
        (axiomOnlyLogEvent?.data.client_request_id as string | undefined) ??
        loggerContext.clientRequestId,
      fingerprint_id: loggerContext.fingerprintId,
      data: shipData,
    }
    enqueueClientLog(record)
  }

  // In dev mode, use appendFileSync for real-time logging (Bun has issues with pino sync)
  // In prod mode, use pino for better performance
  const currentLogPath = getLogPath()
  const currentPinoLogger = getPinoLogger()
  if (IS_DEV && currentLogPath) {
    const logEntry = safeStringify({
      level: level.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...loggerContext,
      ...(includeData ? { data: sanitizedData } : {}),
      msg: stringFormat(normalizedMsg ?? '', ...args),
    })
    try {
      appendFileSync(currentLogPath, logEntry + '\n')
    } catch {
      // Ignore write errors
    }
  } else if (currentPinoLogger !== undefined) {
    const base = { ...loggerContext }
    const obj = includeData ? { ...base, data: sanitizedData } : base
    currentPinoLogger[level](obj, normalizedMsg, ...args)
  }
}

function logAsErrorIfNeeded(toTrack: {
  data?: LogValue
  level: LogLevel
  loggerContext: LoggerContext
  msg: string
}) {
  if (toTrack.level === 'error' || toTrack.level === 'fatal') {
    const dataObj =
      toTrack.data &&
      typeof toTrack.data === 'object' &&
      !Array.isArray(toTrack.data)
        ? (toTrack.data as Record<string, LogValue>)
        : ({} as Record<string, LogValue>)
    const dataRecord: Record<string, JSONValue> = {}
    for (const [key, value] of Object.entries(dataObj)) {
      dataRecord[key] = safeToJSONValue(value)
    }
    logError(
      new Error(toTrack.msg),
      toTrack.loggerContext.userId ?? 'unknown',
      {
        ...dataRecord,
        context: loggerContextToRecord(toTrack.loggerContext),
      },
    )
    flushAnalytics()
  }
}
