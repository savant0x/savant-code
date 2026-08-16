/**
 * Teacher skill taxonomy + challenge contracts — FID-2026-0813-012.
 *
 * The public challenge manifest never contains the known-good implementation
 * or hidden test source; the private pack is content-addressed and loaded only
 * by the trusted grader. The operator owns skill objectives and acceptance
 * contracts; agents propose artifacts.
 */

import type { MutationContract } from './mutation'

export type SkillId = string

/** A measurable learning outcome, tagged with which grader measures it. */
export type LearningOutcome = {
  id: string
  statement: string
  measuredBy: 'equivalence' | 'detection' | 'both'
}

export type Skill = {
  id: SkillId
  label: string
  /** Developer-facing description; no beginner promise is implied. */
  description: string
  outcomes: LearningOutcome[]
}

/** The public function contract the learner's solution must satisfy. */
export type InputContract = {
  /** Function signature the solution must implement. */
  signature: string
  /** Public example inputs. */
  examples: string[]
}

export type OutputContract = {
  /** Shape/type of the expected result, in prose. */
  description: string
  /** Public example outputs. */
  examples: string[]
}

export type ChallengeLimits = {
  /** Timeout in ms for a single sandbox run. */
  timeLimitMs: number
  /** Max stdout bytes before the run is truncated and failed. */
  maxOutputBytes: number
  /** Optional declared complexity guidance (pedagogical, not syntax policing). */
  complexityNote?: string
}

export type Prerequisite = {
  skillId: SkillId
  reason: string
}

export type PublicChallenge = {
  id: string
  version: number
  skill: SkillId
  objective: string
  prompt: string
  visibleGuidance: string
  inputContract: InputContract
  outputContract: OutputContract
  limits: ChallengeLimits
  prerequisites: Prerequisite[]
  /** Content hash over the public manifest (excluding this field). */
  challengeHash: string
}

/** The critique rubric bounds natural-language adjudication (FID-012). */
export type CritiqueRubric = {
  /** Acceptable concept labels + synonyms the rubric maps to a mutation. */
  concepts: string[]
  /** Evidence dimensions a passing critique must cover. */
  requiredEvidence: ('location' | 'witness' | 'impact')[]
}

export type PrivateChallengePack = {
  challengeHash: string
  /** Hash of the known-good solution source. */
  knownGoodHash: string
  /** Hidden test source — never shipped to the learner or UI. */
  hiddenTests: string
  /** Mutation contracts this challenge ships for the detection grader. */
  mutationContracts: MutationContract[]
  critiqueRubric: CritiqueRubric
  gradingVersion: string
}
