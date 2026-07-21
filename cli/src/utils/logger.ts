/* eslint-disable savant/no-unknown-in-signatures -- logger: dynamic structured-log data trust-boundary; data parameter accepts arbitrary upstream LLM/agent/tool-call shapes (cf. common/src/util/error.ts trust-boundary contract). ECHO Law 6: `unknown` at trust boundary with internal `typeof`/Array.isArray narrowing is the correct shape. See FID-2026-0719-029-eslint-zero-tolerance-push-gate.md.
*/
// Per-function decisions (FID-029-git Step 2 enumeration → Step 3 application — all `any` instances eliminated in this pass):
// - LoggerContext.[key: string]           → `any` → `unknown` (key access value type downgraded)
// - pinoLogger                            → `any` → `pino.Logger | undefined` (pino's exported type)
// - isEmptyObject(value: unknown)         → `any` → `unknown` (runtime `typeof === 'object'` + Array.isArray + Object.keys check inside)
// - sendAnalyticsAndLog(level, data: unknown, msg?: string, ...args: unknown[]) → `any` → `unknown` for all params
// - logAsErrorIfNeeded.toTrack.data       → `any` → `unknown`; runtime object guard added before spread
// - logger wrappers (data: unknown, msg?: string, ...args: unknown[]) → `any` → `unknown`
// - pino call site                        → removed raw-typed cast on normalizedMsg (msg already typed `string | undefined`; pino.LogFn signature accepts `(obj: object, msg?: string, ...args: unknown[])`)
import { appendFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import path, { dirname } from 'path'
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
import { pino } from 'pino'

import {
  flushAnalytics,
  logError,
  setAnalyticsErrorLogger,
  trackEvent,
} from './analytics'
import { enqueueClientLog } from './log-shipper'
import { getCurrentChatDir, getProjectRoot } from '../project-files'

import type { LogRecordInput } from '@savant-code/common/schemas/logs'

/** Name of the per-chat debug log file written in production builds */
export const CHAT_LOG_FILENAME = 'log.jsonl'

export interface LoggerContext {
  userId?: string
  userEmail?: string
  clientSessionId?: string
  fingerprintId?: string
  clientRequestId?: string
  [key: string]: unknown // Allow for future extensions; values typed as unknown per ECHO Law 6 trust-boundary contract
}

export const loggerContext: LoggerContext = {}

let logPath: string | undefined = undefined
let pinoLogger: pino.Logger | undefined = undefined

const loggingLevels = ['info', 'debug', 'warn', 'error', 'fatal'] as const
type LogLevel = (typeof loggingLevels)[number]
const analyticsDispatcher = createAnalyticsDispatcher({
  envName: env.NEXT_PUBLIC_CB_ENVIRONMENT,
  bufferWhenNoUser: true,
})

/**
 * Safely stringify an object, handling circular references.
 * Replaces circular references with '[Circular]' placeholder.
 */
function safeStringify(obj: unknown): string {
  const seen = new WeakSet()
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]'
      }
      seen.add(value)
    }
    return value
  })
}

function isEmptyObject(value: unknown): boolean {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}

function setLogPath(p: string): void {
  if (p === logPath) return // nothing to do

  logPath = p
  mkdirSync(dirname(p), { recursive: true })

  // ──────────────────────────────────────────────────────────────
  //  pino.destination(..) → SonicBoom stream, no worker thread
  // ──────────────────────────────────────────────────────────────
  const fileStream = pino.destination({
    dest: p, // absolute or relative file path
    mkdir: true, // create parent dirs if they don’t exist
    sync: true, // set true if you *must* block on every write
  })

  pinoLogger = pino(
    {
      level: 'debug',
      formatters: {
        level: (label) => ({ level: label.toUpperCase() }),
      },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    },
    fileStream, // <-- no worker thread involved
  )
}

export function clearLogFile(): void {
  const projectRoot = getProjectRoot()
  const debugDir = path.join(projectRoot, 'debug')
  const targets = new Set<string>()

  if (logPath) {
    targets.add(logPath)
  }
  targets.add(path.join(debugDir, 'cli.jsonl'))
  targets.add(path.join(debugDir, 'trace.jsonl'))

  for (const target of targets) {
    try {
      if (existsSync(target)) {
        unlinkSync(target)
      }
    } catch {
      // Ignore errors when clearing logs
    }
  }

  logPath = undefined
  pinoLogger = undefined
}

function sendAnalyticsAndLog(
  level: LogLevel,
  data: unknown,
  msg?: string,
  ...args: unknown[]
): void {
  if (!IS_CI && !IS_TEST) {
    let projectRoot: string | undefined
    try {
      projectRoot = getProjectRoot()
    } catch {
      projectRoot = undefined
    }
    if (projectRoot) {
      const logTarget =
        IS_DEV
          ? path.join(projectRoot, 'debug', 'cli.jsonl')
          : path.join(getCurrentChatDir(), CHAT_LOG_FILENAME)

      setLogPath(logTarget)
    }
  }

  const isStringOnly = typeof data === 'string' && msg === undefined
  const normalizedData = isStringOnly ? undefined : data
  const normalizedMsg = isStringOnly ? (data as string) : msg
  const includeData = normalizedData != null && !isEmptyObject(normalizedData)
  const axiomOnlyLogEvent = getAxiomOnlyLogEvent(normalizedData)

  const toTrack = {
    ...(includeData ? { data: normalizedData } : {}),
    level,
    loggerContext,
    msg: stringFormat(normalizedMsg, ...args),
  }

  logAsErrorIfNeeded(toTrack)

  if (!IS_DEV && includeData && typeof normalizedData === 'object') {
    const analyticsPayloads = analyticsDispatcher.process({
      data: normalizedData,
      level,
      msg: stringFormat(normalizedMsg ?? '', ...args),
      fallbackUserId: loggerContext.userId,
    })

    analyticsPayloads.forEach((payload) => {
      trackEvent(payload.event, payload.properties)
    })
  }

  // Send all log events to PostHog in production for better observability
  // Skip if the log already has an eventId (to avoid duplicate tracking)
  const hasEventId = includeData && getAnalyticsEventId(normalizedData) !== null
  if (!IS_DEV && !IS_TEST && !IS_CI && !hasEventId && !axiomOnlyLogEvent) {
    const fullTelemetry = isFullTelemetryEnabled({
      distinctId: loggerContext.userId,
      properties: loggerContext,
    })
    const includeRawData =
      fullTelemetry || level === 'error' || level === 'fatal'
    const dataProperties =
      includeData && includeRawData
        ? { data: normalizedData }
        : includeData
          ? { dataSummary: summarizeAnalyticsValue(normalizedData) }
          : {}

    trackEvent(AnalyticsEvent.CLI_LOG, {
      level,
      msg: stringFormat(normalizedMsg ?? '', ...args),
      ...dataProperties,
      ...loggerContext,
    })
  }

  // Mirror the log/event into the server-side Axiom logs sink via /api/logs
  // (in addition to PostHog). Best-effort and batched; skip noisy debug logs
  // and anything before we know who the user is.
  if (
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
        properties: loggerContext,
      }) ||
      level === 'error' ||
      level === 'fatal'
    const shipData = axiomOnlyLogEvent
      ? axiomOnlyLogEvent.data
      : includeData
        ? includeRawData
          ? normalizedData
          : summarizeAnalyticsValue(normalizedData)
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
  if (IS_DEV && logPath) {
    const logEntry = safeStringify({
      level: level.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...loggerContext,
      ...(includeData ? { data: normalizedData } : {}),
      msg: stringFormat(normalizedMsg ?? '', ...args),
    })
    try {
      appendFileSync(logPath, logEntry + '\n')
    } catch {
      // Ignore write errors
    }
  } else if (pinoLogger !== undefined) {
    const base = { ...loggerContext }
    const obj = includeData ? { ...base, data: normalizedData } : base
    pinoLogger[level](obj, normalizedMsg, ...args)
  }
}

function logAsErrorIfNeeded(toTrack: {
  data?: unknown
  level: LogLevel
  loggerContext: LoggerContext
  msg: string
}) {
  if (toTrack.level === 'error' || toTrack.level === 'fatal') {
    // ECHO Law 6 trust-boundary: validate object shape before spread.
    const dataObj =
      toTrack.data &&
      typeof toTrack.data === 'object' &&
      !Array.isArray(toTrack.data)
        ? (toTrack.data as Record<string, unknown>)
        : ({} as Record<string, unknown>)
    logError(
      new Error(toTrack.msg),
      toTrack.loggerContext.userId ?? 'unknown',
      { ...dataObj, context: toTrack.loggerContext },
    )
    flushAnalytics()
  }
}

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
      (data: unknown, msg?: string, ...args: unknown[]) =>
        sendAnalyticsAndLog(level, data, msg, ...args),
    ]
  }),
) as Record<LogLevel, pino.LogFn>

setAnalyticsErrorLogger((error, context) => {
  const err =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown analytics error')

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
