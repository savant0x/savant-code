/**
 * Teacher progression + ZTAP adapter — FID-2026-0813-019.
 */
export {
  PROGRESSION_SCHEMA_VERSION,
  ProgressionStore,
  applyProgressionSchema,
} from './store'
export {
  adaptAttemptReceipt,
  buildProgressionRecord,
  buildTeacherEvidence,
  deriveCompetencyEdge,
  signTeacherAttemptReceipt,
  signTeacherEvidence,
} from './record'
