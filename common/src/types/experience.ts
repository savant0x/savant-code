import { z } from 'zod/v4'

import { hashUtf8 } from '../crypto/hash'
import { commandExecutionMetadataSchema } from '../util/command-execution'

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

export const EXPERIENCE_EXPECTEDNESS = [
  'expected',
  'unexpected',
  'undetermined',
] as const
export type ExperienceExpectedness = (typeof EXPERIENCE_EXPECTEDNESS)[number]
export const EXPERIENCE_ERROR_CLASSES = [
  'native-incomplete',
  'tool-unavailable',
  'tool-result-failure',
  'unclassified',
] as const
export type ExperienceErrorClass = (typeof EXPERIENCE_ERROR_CLASSES)[number]

/** Store location (repo-relative): raw traces are never boot-read. */
export const EXPERIENCES_DIR_NAME = 'dev/experiences'
/** Append-only ledger file inside the store. */
export const RAW_TRACES_FILE_NAME = 'raw-traces.jsonl'
/**
 * Exposure receipts (FID-2026-1012-024) live beside the ledger: one immutable
 * file per (class, boundary commit, fix time, session). The producer stamps the
 * name and the proof reader re-derives it, so a receipt cannot be renamed or
 * hand-edited into evidence it did not earn.
 */
export const EXPOSURE_DIR_NAME = 'exposure'

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
  /** Optional so historical immutable rows remain valid. */
  schemaVersion: z.literal(1).optional(),
  classKey: z.string().optional(),
  errorClass: z.enum(EXPERIENCE_ERROR_CLASSES).optional(),
  expectedness: z.enum(EXPERIENCE_EXPECTEDNESS).optional(),
  argumentsTruncated: z.boolean().optional(),
  finishReason: z.string().optional(),
  /**
   * FID-2026-1012-023: narrowed identity of a failed command execution, so an
   * abort or timeout is attributable to the tool that actually ran rather
   * than to whichever name its message happened to contain.
   */
  commandExecution: commandExecutionMetadataSchema.optional(),
  /** New captures use the canonical credential redactor; historical rows stay unaltered. */
  redacted: z.literal(true).optional(),
})

export type ExperienceRecord = z.infer<typeof experienceRecordSchema>

/** One exposure belongs to one declared repair boundary, never just a class. */
export const experienceExposureReceiptSchema = z.object({
  kind: z.literal('production-tool-exposure'),
  classKey: z.string().min(1),
  sessionId: z.string().min(1),
  exercisedAt: z.iso.datetime({ offset: true }),
  implementationCommit: z.string().regex(/^[a-f0-9]{40}$/),
  boundaryCommit: z.string().regex(/^[a-f0-9]{40}$/),
  boundaryFixedAt: z.iso.datetime({ offset: true }),
  /** Configuration confirmation; persistence and class coverage need separate proof. */
  captureVerified: z.literal(true),
})

export type ExperienceExposureReceipt = z.infer<
  typeof experienceExposureReceiptSchema
>

/** Receipt filename prefix — greppable, and the only attribution a corrupt file has. */
export function exposureReceiptReadablePrefix(classKey: string): string {
  return classKey.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80)
}

/**
 * Filename identity of a receipt: the readable half keeps it greppable, the
 * digest binds class, boundary commit, fix time and session. Both the producer
 * and the proof reader derive it, so a renamed or edited receipt is detectable.
 */
export function exposureReceiptFileName(
  receipt: Pick<
    ExperienceExposureReceipt,
    'classKey' | 'boundaryCommit' | 'boundaryFixedAt' | 'sessionId'
  >,
): string {
  const digest = hashUtf8(
    JSON.stringify([
      receipt.classKey,
      receipt.boundaryCommit,
      receipt.boundaryFixedAt,
      receipt.sessionId,
    ]),
  ).slice(0, 16)
  return `${exposureReceiptReadablePrefix(receipt.classKey)}--${digest}.json`
}

/**
 * One validated exposure receipt, as the proof reader derives it for a declared
 * repair boundary (FID-2026-1012-024 Loop 11). Exposure is DISCOVERED in the
 * store, never declared beside the boundary: the hand-maintained array it
 * replaces was the one thing no code could fill, so a landed fix could never
 * become an observed repair.
 */
export interface ExposureSession {
  sessionId: string
  exercisedAt: string
  evidence: string
}

/** Qualified exposure per class key, as the census receives it. */
export type ExposureByClass = ReadonlyMap<string, readonly ExposureSession[]>
