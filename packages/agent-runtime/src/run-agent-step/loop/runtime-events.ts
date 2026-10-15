import type {
  TraceWriter,
  RuntimeTraceEvent,
} from '@savant-code/common/types/contracts/trace'

/**
 * Best-effort runtime lifecycle event sink. Runtime tracing is observational
 * and must never affect execution (FID-2026-0809-016: extracted from loop.ts).
 */
export function recordRuntimeEvent(
  event: RuntimeTraceEvent,
  traceWriter?: TraceWriter,
): void {
  try {
    traceWriter?.recordEvent?.(event)
  } catch {
    // Runtime tracing is observational and must never affect execution.
  }
}
