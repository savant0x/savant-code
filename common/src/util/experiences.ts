import { createHash } from 'node:crypto'

/**
 * FID-2026-0824-012 Phase 1 — pure experience-record helpers shared by the
 * in-process capture sink (packages/agent-runtime/src/hooks/
 * experience-capture.ts) and the dedup/compaction layer
 * (scripts/experiences-dedup.ts).
 *
 * Single source of truth for key normalization: the capture path and the
 * analysis path MUST agree on what makes two failures "the same", otherwise
 * the recurrence counter can never converge (same failure class as the
 * FID-2026-0823-009 path-form mismatch).
 */

/** Bounds that keep the ledger small regardless of event volume. */
export const ERROR_FIRST_LINE_MAX = 500
/** ANSI escape sequences (color codes etc.) must not pollute dedup keys. */
const ANSI_ESCAPE_RE = /\u001b\[[0-9;]*[a-zA-Z]/g

/**
 * Normalize an error into a stable first-line dedup key: strip ANSI codes,
 * collapse whitespace, and normalize Windows path separators so `C:\a\b` and
 * `C:/a/b` hash identically (canonical rule `no-environment-dependent-guards`).
 */
export function normalizeErrorFirstLine(error: string): string {
  const firstLine = error.split(/\r?\n/, 1)[0] ?? ''
  return firstLine
    .replace(ANSI_ESCAPE_RE, '')
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, ERROR_FIRST_LINE_MAX)
}

/**
 * Canonical, stable string form of the tool input for hashing: keys sorted,
 * path separators normalized so the same call on Windows and POSIX hashes
 * identically.
 */
export function canonicalToolInput(input: unknown): string {
  const normalize = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(/\\/g, '/')
    if (Array.isArray(value)) return value.map(normalize)
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        out[key] = normalize((value as Record<string, unknown>)[key])
      }
      return out
    }
    return value
  }
  return JSON.stringify(normalize(input))
}

/**
 * sha256 hex over `toolName + NUL + normalizedFirstLine`. The NUL separator
 * prevents boundary collisions (`["a","b"]` vs `["ab",""]`).
 *
 * Normalization is applied HERE defensively, not assumed: even if a record
 * was written by a capture path that already normalized, a raw-spelled
 * record (e.g. a hand-written fixture or a pre-normalization ledger) still
 * groups with its normalized twins.
 */
export function experienceDedupKey(
  toolName: string,
  errorFirstLine: string,
): string {
  const normalized = normalizeErrorFirstLine(errorFirstLine)
  return createHash('sha256')
    .update(`${toolName}\u0000${normalized}`, 'utf8')
    .digest('hex')
}
