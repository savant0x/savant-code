import { z } from 'zod/v4'

export const ripgrepEventSchema = z.object({
  type: z.enum(['match', 'context']),
  data: z.object({
    // Byte-only payloads are unsupported display data and must earn a drop
    // diagnostic rather than a blank successful match (FID-2026-1002-002).
    path: z.object({ text: z.string() }),
    line_number: z.number().optional(),
    lines: z.object({ text: z.string() }),
  }),
})

export type RipgrepEvent = z.infer<typeof ripgrepEventSchema>

/**
 * Valid JSON events from the ripgrep `--json` protocol that carry NO match
 * data (`begin`, `end`, `summary`). FID-2026-1002-001 step 2: these are
 * NOT parse drops — the old single-type parse treated them as unparseable
 * and the collector had no way to tell protocol noise from schema drift.
 */
const NON_MATCH_EVENT_TYPES = new Set(['begin', 'end', 'summary'])

export type RipgrepLineParse =
  | { kind: 'event'; event: RipgrepEvent }
  | { kind: 'protocol'; type: string }
  | { kind: 'unparseable' }

/**
 * FID-2026-1002-001 step 2: discriminate the three outcomes the collector
 * must account for — a usable match/context event, a benign protocol event,
 * or an UNPARSEABLE line (JSON failure or schema mismatch: the drop source
 * that previously vanished silently).
 */
export function parseRipgrepLine(line: string): RipgrepLineParse {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return { kind: 'unparseable' }
  }
  const type = (parsed as { type?: unknown } | null)?.type
  if (typeof type === 'string' && NON_MATCH_EVENT_TYPES.has(type)) {
    return { kind: 'protocol', type }
  }
  const result = ripgrepEventSchema.safeParse(parsed)
  return result.success
    ? { kind: 'event', event: result.data }
    : { kind: 'unparseable' }
}

// Hidden directories to include in code search by default.
// These are searched in addition to '.' to ensure important config/workflow files are discoverable.
export const INCLUDED_HIDDEN_DIRS = [
  '.agents', // SavantCode agent definitions
  '.claude', // Claude settings
  '.github', // GitHub Actions, workflows, issue templates
  '.gitlab', // GitLab CI configuration
  '.circleci', // CircleCI configuration
  '.husky', // Git hooks
]
