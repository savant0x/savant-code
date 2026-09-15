/**
 * FID-2026-0915-001 — compatibility re-export (Law 13: one truth).
 *
 * The state layer moved to `common/src/providers/discovery-state.ts` so the
 * CLI (W5 fallback hints, the wizard prefill) can consume it without
 * importing across tree boundaries. Every symbol remains importable from
 * here — existing imports keep working.
 */
export {
  appendHistory,
  buildModelIndex,
  churnSummary,
  type CandidateState,
  type ChurnSummary,
  diffCandidates,
  type DiffClassification,
  type DiffEntry,
  type DiffResult,
  detectDropouts,
  type HistorySample,
  HISTORY_CAP,
  fallbackHint,
  familyToken,
  fnv1aHex,
  parseStateFile,
  serializeStateFile,
  uptimeFor,
  type ModelIndexEntry,
} from '../../../common/src/providers/discovery-state'
