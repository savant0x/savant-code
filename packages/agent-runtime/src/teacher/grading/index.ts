/**
 * Teacher grading — FID-2026-0813-016/017.
 */
export {
  EQUIVALENCE_GRADER_VERSION,
  BehaviorFirstEquivalenceGrader,
  behaviorFirstEquivalenceGrader,
  detectHardcoding,
} from './equivalence'
export {
  DETECTION_GRADER_VERSION,
  CatalogDetectionGrader,
  catalogDetectionGrader,
  evaluateCalibration,
  gradeCritique,
  type CalibrationReport,
  type LabeledCritiqueCase,
} from './detection'
