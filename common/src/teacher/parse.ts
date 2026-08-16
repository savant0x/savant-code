/**
 * Teacher trust-boundary parsers — FID-2026-0813-012.
 *
 * Each `parse*` throws a single descriptive error on the first invalid field,
 * used at trust boundaries: pack loading, child-process results, persisted
 * attempts, and progression records. Schemas live in `schemas.ts`; parsers are
 * split out so neither module exceeds the new-file baseline.
 */

import {
  competencyEdgeSchema,
  progressionRecordSchema,
  teacherAttemptReceiptSchema,
} from './progression-schemas'
import {
  attemptResultSchema,
  critiqueGradeSchema,
  critiqueSubmissionSchema,
  mutationCatalogSchema,
  privateChallengePackSchema,
  publicChallengeSchema,
  sandboxPolicySchema,
  sandboxResultSchema,
} from './schemas'

import type { AttemptResult } from './attempt'
import type { PrivateChallengePack, PublicChallenge } from './challenge'
import type { CritiqueGrade, CritiqueSubmission } from './critique'
import type { MutationCatalog } from './mutation'
import type {
  CompetencyEdge,
  ProgressionRecord,
  TeacherAttemptReceipt,
} from './progression'
import type { SandboxPolicy, SandboxResult } from './sandbox'
import type { z } from 'zod/v4'

/** Parse a value or throw a single descriptive error (trust-boundary guard). */
function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid ${label}: ${details}`)
  }
  return result.data
}

export const parsePublicChallenge = (value: unknown): PublicChallenge =>
  parseOrThrow(publicChallengeSchema, value, 'public challenge')
export const parsePrivateChallengePack = (
  value: unknown,
): PrivateChallengePack =>
  parseOrThrow(privateChallengePackSchema, value, 'private challenge pack')
export const parseMutationCatalog = (value: unknown): MutationCatalog =>
  parseOrThrow(mutationCatalogSchema, value, 'mutation catalog')
export const parseCritiqueSubmission = (value: unknown): CritiqueSubmission =>
  parseOrThrow(critiqueSubmissionSchema, value, 'critique submission')
export const parseCritiqueGrade = (value: unknown): CritiqueGrade =>
  parseOrThrow(critiqueGradeSchema, value, 'critique grade')
export const parseSandboxPolicy = (value: unknown): SandboxPolicy =>
  parseOrThrow(sandboxPolicySchema, value, 'sandbox policy')
export const parseSandboxResult = (value: unknown): SandboxResult =>
  parseOrThrow(sandboxResultSchema, value, 'sandbox result')
export const parseAttemptResult = (value: unknown): AttemptResult =>
  parseOrThrow(attemptResultSchema, value, 'attempt result')
export const parseProgressionRecord = (value: unknown): ProgressionRecord =>
  parseOrThrow(progressionRecordSchema, value, 'progression record')
export const parseCompetencyEdge = (value: unknown): CompetencyEdge =>
  parseOrThrow(competencyEdgeSchema, value, 'competency edge')
export const parseTeacherAttemptReceipt = (
  value: unknown,
): TeacherAttemptReceipt =>
  parseOrThrow(teacherAttemptReceiptSchema, value, 'teacher attempt receipt')
