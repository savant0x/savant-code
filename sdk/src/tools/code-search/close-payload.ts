/**
 * Terminal-payload construction for the search child's `close` event:
 * flush the remaining stdout, classify the run outcome, build the
 * formatted output, and decide between the error channel (anomaly) and
 * the normal result with its `Exit code` / warning message. Extracted
 * verbatim from `executor.ts` (quality ceiling, FID-2026-1004-006) —
 * behavior contract unchanged.
 */

import { classifyCodeSearchOutcome } from './anomaly'
import { buildCloseOutput } from './format'

import type { RipgrepMatchCollector } from './match-collector'

export type CodeSearchResult =
  | { stdout: string; message: string; stderr?: string; exitCode?: number }
  | { errorMessage: string; stdout?: string; stderr?: string }

export function settleOnClose(params: {
  /** The child's exit code, or null when killed by a signal. */
  childExitCode: number | null
  collector: RipgrepMatchCollector
  /** Undecoded stdout remainder plus the decoder's tail, at close time. */
  remainingStdout: string
  stderrBuf: string
  maxResults: number
  globalMaxResults: number
  maxOutputStringLength: number
}): CodeSearchResult {
  const { collector } = params

  // FID-2026-1002-001: remainder flushing lives on the collector and
  // every dropped line is accounted, never silent.
  collector.flushRemainder(params.remainingStdout)

  const outcome = classifyCodeSearchOutcome({
    code: params.childExitCode,
    collected: collector.matchesGlobal,
    dropped: collector.droppedEventLines,
    firstDroppedLine: collector.firstDroppedLine,
    stderrBuf: params.stderrBuf,
  })
  const closeOutput = buildCloseOutput({
    fileGroups: collector.fileGroups,
    filesLimitedByMaxResults: collector.filesLimitedByMaxResults,
    matchesGlobal: collector.matchesGlobal,
    killedForLimit: collector.killedForLimit,
    maxResults: params.maxResults,
    globalMaxResults: params.globalMaxResults,
    maxOutputStringLength: params.maxOutputStringLength,
    stderrBuf: params.stderrBuf,
    // FID-2026-1002-001 step 4: an anomalous run NEVER renders a
    // "Found 0 matches" line — the formatter renders the anomaly text.
    emptyResultText:
      outcome.kind === 'anomaly' ? outcome.emptyResultText : undefined,
  })

  if (outcome.kind === 'anomaly') {
    // The absence-shaped result is not trustworthy: settle through the
    // error channel carrying stderr and the drop count (step 3).
    return {
      errorMessage: outcome.errorMessage,
      stdout: closeOutput.stdout,
      stderr: closeOutput.stderr,
    }
  }

  return {
    ...closeOutput,
    message:
      (params.childExitCode !== null
        ? `Exit code: ${params.childExitCode}${collector.killedForLimit ? ' (early stop)' : ''}`
        : '') +
      (outcome.kind === 'warning' ? ` — warning: ${outcome.message}` : ''),
  }
}
