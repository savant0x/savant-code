import type { JSONValue } from '@savant-code/common/types/json'

// FID-2026-0819-005 Loop 148: analytics error-reporting plumbing, extracted
// from analytics/state.ts. Holds the stage enum, the error context contract,
// and the pluggable error logger (module-level by design — analytics state
// is a singleton). Public API re-exported from state.ts.

export enum AnalyticsErrorStage {
  Init = 'init',
  Track = 'track',
  Identify = 'identify',
  Flush = 'flush',
  CaptureException = 'captureException',
}

export type AnalyticsErrorContext = {
  stage: AnalyticsErrorStage
  [key: string]: JSONValue
}

export type AnalyticsErrorLogger = (
  error: unknown,
  context: AnalyticsErrorContext,
) => void

let analyticsErrorLogger: AnalyticsErrorLogger | undefined

export function setAnalyticsErrorLogger(loggerFn: AnalyticsErrorLogger) {
  analyticsErrorLogger = loggerFn
}

export function logAnalyticsError(
  error: unknown,
  context: AnalyticsErrorContext,
) {
  try {
    analyticsErrorLogger?.(error, context)
  } catch {
    // Never throw from error reporting
  }
}
