/**
 * Progression + attempt-receipt schemas — FID-2026-0813-019.
 *
 * Split out of `schemas.ts` so neither module exceeds the new-file baseline.
 * Every schema is type-annotated against its contract type (one source of
 * truth). Imports the shared hash primitives from `schemas.ts`; the dependency
 * is one-way (schemas.ts never imports this module), so there is no cycle.
 */
import { z } from 'zod/v4'

import { evidenceHashesSchema, sha256HashSchema } from './schemas'

import type {
  CompetencyEdge,
  ProgressionRecord,
  TeacherAttemptReceipt,
  TeacherProcessEvidence,
} from './progression'

export const teacherProcessEvidenceSchema: z.ZodType<TeacherProcessEvidence> =
  z.object({
    attemptId: z.string(),
    challengeHash: sha256HashSchema,
    completionState: z.enum(['passed', 'failed', 'unavailable', 'cancelled']),
    evidenceHashes: evidenceHashesSchema,
    versions: z.object({
      corpus: z.string(),
      sandboxPolicy: z.string(),
      grader: z.string(),
      mutation: z.string(),
    }),
    timestamp: z.string(),
  })

export const teacherAttemptReceiptSchema: z.ZodType<TeacherAttemptReceipt> =
  z.object({
    schema: z.literal('savant.teacher.attempt-receipt.v1'),
    role: z.string(),
    publicKey: z.string(),
    over: sha256HashSchema,
    sig: z.string(),
    evidence: teacherProcessEvidenceSchema,
  })

export const progressionRecordSchema: z.ZodType<ProgressionRecord> = z.object({
  attemptId: z.string(),
  challengeId: z.string(),
  challengeHash: sha256HashSchema,
  skill: z.string(),
  completionState: z.enum(['passed', 'failed', 'unavailable', 'cancelled']),
  evidenceHashes: evidenceHashesSchema,
  versions: z.object({
    corpus: z.string(),
    sandboxPolicy: z.string(),
    grader: z.string(),
    mutation: z.string(),
  }),
  timestamp: z.string(),
  receiptStatus: z.enum(['ztap-signed', 'local-unverified']),
  receipt: teacherAttemptReceiptSchema.nullable(),
})

export const competencyEdgeSchema: z.ZodType<CompetencyEdge> = z.object({
  skill: z.string(),
  state: z.enum(['not_attempted', 'attempted', 'completed', 'transferred']),
  evidence: z.array(z.string()),
})
