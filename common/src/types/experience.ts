import { z } from 'zod/v4'

/**
 * FID-2026-0824-012 Phase 1 — mechanical experience capture.
 *
 * One immutable event per record. Aggregate counters (frequency, recurrence)
 * NEVER live in the record — they are computed by the dedup layer
 * (`scripts/experiences-dedup.ts`) over the append-only JSONL store, so the
 * capture path stays a write-only ledger and the record schema cannot drift
 * into per-session state.
 */
export const EXPERIENCE_TRIGGER_TYPES = [
  // A tool call failed (PostToolUseFailure).
  'tool_failure',
  // Reserved for operator-correction capture (PostToolUse + corrective
  // heuristic). Not wired in v1 — schema-forward only.
  'operator_correction',
  // Reserved for session-end synthesis. Not wired in v1 — schema-forward only.
  'session_end',
] as const

export type ExperienceTriggerType = (typeof EXPERIENCE_TRIGGER_TYPES)[number]

/** Store location (repo-relative): raw traces are never boot-read. */
export const EXPERIENCES_DIR_NAME = 'dev/experiences'
/** Append-only ledger file inside the store. */
export const RAW_TRACES_FILE_NAME = 'raw-traces.jsonl'

export const experienceRecordSchema = z.object({
  /** ISO-8601 UTC timestamp of the triggering event. */
  ts: z.string(),
  triggerType: z.enum(EXPERIENCE_TRIGGER_TYPES),
  /** Tool that failed (empty for non-tool triggers). */
  toolName: z.string(),
  /**
   * First line of the normalized error message (empty when the trigger type
   * carries no error). Path-normalized (`\` → `/`) so Windows vs POSIX
   * spellings of the same failure produce the same dedup key.
   */
  errorFirstLine: z.string(),
  /**
   * sha256 hex of the canonical tool input (path-normalized JSON). Lets the
   * dedup layer group by failure signature WITHOUT storing raw arguments
   * (raw payloads may contain credentials — never persisted).
   */
  contextHash: z.string(),
  sessionId: z.string(),
})

export type ExperienceRecord = z.infer<typeof experienceRecordSchema>
