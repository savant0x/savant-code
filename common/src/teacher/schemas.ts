/**
 * Teacher runtime validation — FID-2026-0813-012.
 *
 * Every schema is type-annotated against its contract type so structural
 * drift between the schema and the type fails to compile (one source of
 * truth). Used at trust boundaries: pack loading, child-process results,
 * persisted attempts, and progression records.
 */
import { z } from 'zod/v4'

import type {
  AttemptResult,
  EvidenceHashes,
  EquivalenceResult,
} from './attempt'
import type {
  ChallengeLimits,
  CritiqueRubric,
  InputContract,
  OutputContract,
  Prerequisite,
  PrivateChallengePack,
  PublicChallenge,
  Skill,
} from './challenge'
import type { CritiqueGrade, CritiqueSubmission } from './critique'
import type {
  MutationCatalog,
  MutationContract,
  MutationPatch,
} from './mutation'
import type { CapabilityReport, SandboxPolicy, SandboxResult } from './sandbox'

export const sha256HashSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/)
const capabilityStatusSchema = z.enum(['enforced', 'not_enforced', 'untested'])

const learningOutcomeSchema: z.ZodType<Skill['outcomes'][number]> = z.object({
  id: z.string(),
  statement: z.string(),
  measuredBy: z.enum(['equivalence', 'detection', 'both']),
})

export const skillSchema: z.ZodType<Skill> = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  outcomes: z.array(learningOutcomeSchema),
})

const inputContractSchema: z.ZodType<InputContract> = z.object({
  signature: z.string(),
  examples: z.array(z.string()),
})

const outputContractSchema: z.ZodType<OutputContract> = z.object({
  description: z.string(),
  examples: z.array(z.string()),
})

const challengeLimitsSchema: z.ZodType<ChallengeLimits> = z.object({
  timeLimitMs: z.number().int().positive(),
  maxOutputBytes: z.number().int().positive(),
  complexityNote: z.string().optional(),
})

const prerequisiteSchema: z.ZodType<Prerequisite> = z.object({
  skillId: z.string(),
  reason: z.string(),
})

export const publicChallengeSchema: z.ZodType<PublicChallenge> = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  skill: z.string(),
  objective: z.string(),
  prompt: z.string(),
  visibleGuidance: z.string(),
  inputContract: inputContractSchema,
  outputContract: outputContractSchema,
  limits: challengeLimitsSchema,
  prerequisites: z.array(prerequisiteSchema),
  challengeHash: sha256HashSchema,
})

const critiqueRubricSchema: z.ZodType<CritiqueRubric> = z.object({
  concepts: z.array(z.string()),
  requiredEvidence: z.array(z.enum(['location', 'witness', 'impact'])),
})

const mutationPatchSchema: z.ZodType<MutationPatch> = z.object({
  find: z.string(),
  replace: z.string(),
  occurrence: z.number().int().positive().optional(),
})

export const mutationContractSchema: z.ZodType<MutationContract> = z.object({
  mutationId: z.string(),
  skillTarget: z.string(),
  changedBehavior: z.string(),
  surface: z.string(),
  witness: z.string(),
  impact: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  acceptableConcepts: z.array(z.string()),
  patch: mutationPatchSchema,
  hiddenFromVisibleTests: z.boolean(),
  graderVersion: z.string(),
})

export const mutationCatalogSchema: z.ZodType<MutationCatalog> = z.object({
  version: z.string(),
  mutations: z.array(mutationContractSchema),
})

export const privateChallengePackSchema: z.ZodType<PrivateChallengePack> =
  z.object({
    challengeHash: sha256HashSchema,
    knownGoodHash: sha256HashSchema,
    hiddenTests: z.string(),
    mutationContracts: z.array(mutationContractSchema),
    critiqueRubric: critiqueRubricSchema,
    gradingVersion: z.string(),
  })

export const critiqueSubmissionSchema: z.ZodType<CritiqueSubmission> = z.object(
  {
    statement: z.string(),
    location: z.string().optional(),
    witness: z.string().optional(),
    impact: z.string().optional(),
  },
)

const evidenceCoverageSchema = z.object({
  location: z.boolean(),
  witness: z.boolean(),
  impact: z.boolean(),
})

export const critiqueGradeSchema: z.ZodType<CritiqueGrade> = z.object({
  mutationId: z.string(),
  identified: z.boolean(),
  evidenceCoverage: evidenceCoverageSchema,
  locationMatch: z.boolean(),
  witnessMatch: z.boolean(),
  impactMatch: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasonCode: z.enum([
    'identified',
    'partial',
    'vague',
    'unrelated',
    'uncalibrated',
  ]),
  graderVersion: z.string(),
})

export const capabilityReportSchema: z.ZodType<CapabilityReport> = z.object({
  temp_workspace: capabilityStatusSchema,
  no_project_access: capabilityStatusSchema,
  no_corpus_access: capabilityStatusSchema,
  no_home_access: capabilityStatusSchema,
  no_network: capabilityStatusSchema,
  stripped_environment: capabilityStatusSchema,
  no_child_process: capabilityStatusSchema,
  no_native_modules: capabilityStatusSchema,
  output_cap: capabilityStatusSchema,
  timeout: capabilityStatusSchema,
  deterministic_runtime: capabilityStatusSchema,
  path_traversal_containment: capabilityStatusSchema,
  symlink_containment: capabilityStatusSchema,
  cancellation: capabilityStatusSchema,
  cleanup: capabilityStatusSchema,
})

export const sandboxPolicySchema: z.ZodType<SandboxPolicy> = z.object({
  policyVersion: z.string(),
  required: z.array(
    z.enum([
      'temp_workspace',
      'no_project_access',
      'no_corpus_access',
      'no_home_access',
      'no_network',
      'stripped_environment',
      'no_child_process',
      'no_native_modules',
      'output_cap',
      'timeout',
      'deterministic_runtime',
      'path_traversal_containment',
      'symlink_containment',
      'cancellation',
      'cleanup',
    ]),
  ),
  limits: z.object({
    timeLimitMs: z.number().int().positive(),
    maxOutputBytes: z.number().int().positive(),
  }),
})

const testSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  failedNames: z.array(z.string()),
})

export const sandboxResultSchema: z.ZodType<SandboxResult> = z.object({
  status: z.enum([
    'passed',
    'failed',
    'timed_out',
    'policy_denied',
    'unavailable',
  ]),
  exitCode: z.number().int().nullable(),
  testSummary: testSummarySchema,
  stdoutHash: sha256HashSchema,
  stderrSummary: z.string(),
  durationMs: z.number().nonnegative(),
  policyVersion: z.string(),
  runnerVersion: z.string(),
  capabilities: capabilityReportSchema,
})

const equivalenceResultSchema: z.ZodType<EquivalenceResult> = z.object({
  passed: z.boolean(),
  testSummary: testSummarySchema,
  antiCheat: z.object({
    passed: z.boolean(),
    findings: z.array(z.string()),
  }),
  graderVersion: z.string(),
})

export const evidenceHashesSchema: z.ZodType<EvidenceHashes> = z.object({
  submissionHash: sha256HashSchema,
  sandboxResultHash: sha256HashSchema,
  equivalenceHash: sha256HashSchema,
  detectionHash: sha256HashSchema,
})

export const attemptResultSchema: z.ZodType<AttemptResult> = z.object({
  attemptId: z.string(),
  challengeHash: sha256HashSchema,
  corpusVersion: z.string(),
  sandboxPolicyVersion: z.string(),
  graderVersion: z.string(),
  equivalenceResult: equivalenceResultSchema,
  detectionResult: z.object({
    mutationId: z.string(),
    grade: critiqueGradeSchema,
    graderVersion: z.string(),
  }),
  evidenceHashes: evidenceHashesSchema,
  completionState: z.enum(['passed', 'failed', 'unavailable', 'cancelled']),
  timestamp: z.string(),
})
