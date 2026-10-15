/**
 * Corpus source manifest — FID-2026-0813-015.
 *
 * The authoring source is versioned, reviewable JSON: skills plus challenge
 * sources that carry both public fields and private answer material. The pack
 * builder splits this into a `PublicChallenge` (learner/Forge-visible) and a
 * content-addressed `PrivateChallengePack` (grader-only). SQLite is a runtime
 * artifact, never the authoring authority.
 */
import {
  mutationContractSchema,
  skillSchema,
} from '@savant-code/common/teacher'
import { z } from 'zod/v4'

const inputContractSchema = z.object({
  signature: z.string(),
  examples: z.array(z.string()),
})

const outputContractSchema = z.object({
  description: z.string(),
  examples: z.array(z.string()),
})

const challengeLimitsSchema = z.object({
  timeLimitMs: z.number().int().positive(),
  maxOutputBytes: z.number().int().positive(),
  complexityNote: z.string().optional(),
})

const prerequisiteSchema = z.object({
  skillId: z.string(),
  reason: z.string(),
})

const critiqueRubricSchema = z.object({
  concepts: z.array(z.string()),
  requiredEvidence: z.array(z.enum(['location', 'witness', 'impact'])),
})

export const challengeSourceSchema = z.object({
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
  knownGoodSource: z.string(),
  hiddenTests: z.string(),
  mutationContracts: z.array(mutationContractSchema).min(1),
  critiqueRubric: critiqueRubricSchema,
  gradingVersion: z.string(),
})

export const corpusSourceSchema = z.object({
  corpusVersion: z.string(),
  skills: z.array(skillSchema),
  challenges: z.array(challengeSourceSchema),
})

export type ChallengeSource = z.infer<typeof challengeSourceSchema>
export type CorpusSource = z.infer<typeof corpusSourceSchema>

/** Parse a corpus source manifest or throw a single descriptive error. */
export function parseCorpusSource(value: unknown): CorpusSource {
  const result = corpusSourceSchema.safeParse(value)
  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join('; ')
    throw new Error(`Invalid corpus source: ${details}`)
  }
  return result.data
}
