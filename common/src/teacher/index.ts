/**
 * Teacher shared contracts — FID-2026-0813-012.
 *
 * common owns the serializable contracts and runtime validation so the
 * agent-runtime teacher engine, the CLI `/learn` surface, and the build-time
 * corpus pipeline reference one schema set without a common → agent-runtime
 * dependency.
 */
export type {
  CompletionState,
  AttemptEvent,
  AttemptResult,
  DetectionResult,
  EquivalenceResult,
  EvidenceHashes,
} from './attempt'
export type {
  ChallengeLimits,
  CritiqueRubric,
  InputContract,
  OutputContract,
  Prerequisite,
  PrivateChallengePack,
  PublicChallenge,
  Skill,
  SkillId,
  LearningOutcome,
} from './challenge'
export type {
  CritiqueGrade,
  CritiqueSubmission,
  EvidenceCoverage,
  ReasonCode,
} from './critique'
export type {
  MutationCatalog,
  MutationContract,
  MutationPatch,
  MutationSeverity,
} from './mutation'
export type {
  CompetencyEdge,
  CompetencyState,
  ProgressionRecord,
  TeacherAttemptReceipt,
  TeacherProcessEvidence,
} from './progression'
export { TEACHER_PRIVACY_POLICY, type TeacherPrivacyPolicy } from './privacy'
export type {
  CapabilityDimension,
  CapabilityReport,
  CapabilityStatus,
  SandboxPolicy,
  SandboxResult,
  SandboxStatus,
  TestSummary,
} from './sandbox'
export {
  attemptResultSchema,
  capabilityReportSchema,
  critiqueGradeSchema,
  critiqueSubmissionSchema,
  mutationCatalogSchema,
  mutationContractSchema,
  privateChallengePackSchema,
  publicChallengeSchema,
  sandboxPolicySchema,
  sandboxResultSchema,
  skillSchema,
} from './schemas'
export {
  competencyEdgeSchema,
  progressionRecordSchema,
  teacherAttemptReceiptSchema,
  teacherProcessEvidenceSchema,
} from './progression-schemas'
export {
  parseAttemptResult,
  parseCompetencyEdge,
  parseCritiqueGrade,
  parseCritiqueSubmission,
  parseMutationCatalog,
  parsePrivateChallengePack,
  parseProgressionRecord,
  parsePublicChallenge,
  parseSandboxPolicy,
  parseSandboxResult,
  parseTeacherAttemptReceipt,
} from './parse'
