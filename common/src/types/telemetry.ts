/**
 * FID-2026-1007-012 FID 1 — model-compliance telemetry event schema.
 *
 * One `ComplianceEvent` is the canonical record of one enforced-law
 * observation: a rejection, a correction, or an advisory flag produced by
 * the EHEL enforcement layer (`runPreWriteGates`, escalation, turn-end
 * reconciliation, receipt checks). Aggregated downstream into per-model
 * compliance profiles; never acted on here.
 *
 * Shape mirrors the sibling `experienceRecordSchema` (`./experience.ts`):
 * plain strings with documented contracts, so a malformed edge event is
 * still storable and the aggregation layer (not the sink) reports drift.
 *
 * Privacy posture (BO non-negotiable + verified no-bodies constraint):
 * metadata only. `AdvisoryWarning.message` is free text and may carry
 * snippets, so the message is NEVER persisted — law id, classes, and a
 * context hash travel instead. No code content, no payloads, law IDs and
 * classes only.
 *
 * Evolution: additive-nullable — future fields ship optional, unknown keys
 * strip (zod default), history is never rewritten. `schemaVersion` marks
 * the contract.
 */
import { z } from 'zod'

/** Store location (repo-relative): compliance events are never boot-read. */
export const COMPLIANCE_TELEMETRY_DIR_NAME = 'dev/telemetry'
/** Append-only ledger file inside the store. */
export const COMPLIANCE_EVENTS_FILE_NAME = 'compliance.jsonl'

export const COMPLIANCE_EVENT_SCHEMA_VERSION = 1 as const

/** How the observation resolved: blocked, steered, or noted. */
export const violationClassSchema = z.enum(['rejected', 'corrected', 'flagged'])
export type ViolationClass = z.infer<typeof violationClassSchema>

/** The enforcement layer that emitted the observation. */
export const gateLayerSchema = z.enum([
  'pre-write',
  'escalation',
  'turn-end',
  'receipt',
])
export type GateLayer = z.infer<typeof gateLayerSchema>

export const complianceEventSchema = z.object({
  schemaVersion: z.literal(COMPLIANCE_EVENT_SCHEMA_VERSION),
  /** ISO-8601 UTC timestamp of the observation. */
  ts: z.string(),
  sessionId: z.string(),
  /** Raw provider/model slug as seen at runtime; aggregation normalizes. */
  model: z.string(),
  provider: z.string(),
  /** Numeric ECHO law id, matching `AdvisoryWarning.law`. */
  lawId: z.number(),
  violationClass: violationClassSchema,
  /** Agent role at emission (empty when the emitter has no role). */
  agentRole: z.string(),
  gateLayer: gateLayerSchema,
  /**
   * sha256 hex of the canonical grouping context (path-normalized JSON).
   * Empty when the observation carries no groupable context. Lets the
   * aggregation layer group WITHOUT storing raw arguments (raw payloads
   * may contain credentials — never persisted).
   */
  contextHash: z.string(),
  /**
   * Escalation strike at emission (1-based repeat count of the identical
   * block). Present only on escalation-layer events; absent elsewhere.
   * Additive-nullable evolution: readers must not require it.
   */
  strikeCount: z.number().int().positive().optional(),
})
export type ComplianceEvent = z.infer<typeof complianceEventSchema>
