/**
 * Detects the error shapes emitted by native/client tool handlers.
 * Unknown object shapes are not treated as errors unless they carry an
 * explicit error field; this keeps successful JSON results valid while making
 * all known failure receipts fail closed.
 */
export function hasToolResultError(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  return content.some((part: unknown) => {
    if (!part || typeof part !== 'object' || !('value' in part)) return false
    const value = part.value
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false
    const record = value as Record<string, unknown>
    return (
      (typeof record.errorMessage === 'string' &&
        record.errorMessage.length > 0) ||
      (typeof record.error === 'string' && record.error.length > 0) ||
      (typeof record.errorCode === 'string' && record.errorCode.length > 0)
    )
  })
}

/**
 * Extracts the real first error line from a tool result's content parts
 * (FID-2026-0909-005).
 *
 * Mirrors `hasToolResultError` exactly — same fields, same order, same
 * non-empty checks — so detection and extraction can never disagree: for
 * every content shape, `hasToolResultError(content)` is true if and only
 * if `extractToolResultError(content)` returns a non-empty string.
 *
 * Precedence is deterministic so dedup keys stay stable: parts are scanned
 * in array order (the first error-carrying part wins) and, within a part,
 * `errorMessage` > `error` > `errorCode` — the checker's own field order.
 *
 * Returns '' for non-error content; the caller owns the fallback label.
 * No normalization here — `normalizeErrorFirstLine` (capture layer) is the
 * single normalization point, so raw text passes through one truth.
 */
export function extractToolResultError(content: unknown): string {
  if (!Array.isArray(content)) return ''
  for (const part of content) {
    if (!part || typeof part !== 'object' || !('value' in part)) continue
    const value = part.value
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const record = value as Record<string, unknown>
    if (
      typeof record.errorMessage === 'string' &&
      record.errorMessage.length > 0
    ) {
      return record.errorMessage
    }
    if (typeof record.error === 'string' && record.error.length > 0) {
      return record.error
    }
    if (typeof record.errorCode === 'string' && record.errorCode.length > 0) {
      return record.errorCode
    }
  }
  return ''
}

/**
 * FID-2026-0909-005 — the lifecycle site's error line, with the generic
 * label centralized here as the fallback for shape drift (a soft-failed
 * result that carries no extractable error field). Single truth: the
 * fallback spelling lives beside the extractor, never inline at the
 * call site. Unreachable while the detection/extraction mirror above
 * holds — defense-in-depth for future checker drift.
 */
export function toolResultErrorLine(content: unknown): string {
  return extractToolResultError(content) || 'tool result contains an error'
}

/**
 * FID-2026-0927-003 F1 — outcome-aware command failure detection.
 *
 * `hasToolResultError` is SHAPE-aware: it recognises only structured
 * errorMessage / error / errorCode fields. That is the correct primitive for
 * "did the tool itself error", but the wrong primitive for "did the command I
 * ran fail", because a CLI test run reports failure as a non-zero exit plus
 * plain text. Law 3 credited exactly those runs as passes, so the gate was
 * inert for the dominant failure mode.
 *
 * The outcome is already in the payload — `run_readonly_command` and
 * `run_terminal_command` both emit
 * `{ type: 'json', value: { command, stdout, stderr, exitCode } }`, and a
 * batch nests them under `results` — so this reads a field that was already
 * being written and never consulted.
 *
 * Deliberately additive: `hasToolResultError` is retained as the fallback so
 * an infrastructure-level failure (a rejected command with no exitCode) still
 * fails closed. This decides Law 3 verification credit ONLY; `writeSucceeded`
 * keeps the shape-aware predicate, because a command that ran and returned
 * non-zero is a SUCCESSFUL write of a failing program, not a failed write.
 */
export function hasCommandFailure(content: unknown): boolean {
  if (!Array.isArray(content)) return false
  for (const part of content) {
    if (!part || typeof part !== 'object' || !('value' in part)) continue
    const value = part.value
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const record = value as Record<string, unknown>
    if (isNonZeroExit(record.exitCode)) return true
    // Batch shape: run_readonly_command's `commands` form nests one result per
    // command. Any non-zero member makes the whole verification run red.
    if (Array.isArray(record.results)) {
      for (const entry of record.results) {
        if (
          entry &&
          typeof entry === 'object' &&
          isNonZeroExit((entry as Record<string, unknown>).exitCode)
        ) {
          return true
        }
      }
    }
  }
  return hasToolResultError(content)
}

/** A numeric exit code other than 0. A non-numeric value is unknown, not failure. */
function isNonZeroExit(exitCode: unknown): boolean {
  return typeof exitCode === 'number' && exitCode !== 0
}
