/**
 * Pack builder — FID-2026-0813-015.
 *
 * Pure and deterministic: computes the challenge hash over the JCS-canonical
 * public manifest (excluding the hash itself), the known-good source hash, and
 * splits the source into a public challenge and a content-addressed private
 * pack. No sandbox runs here — validation is a separate pass.
 */
import { hashChange, jcsCanonicalize } from '@savant-code/common/crypto'

import type { ChallengeSource } from './source'
import type {
  PrivateChallengePack,
  PublicChallenge,
} from '@savant-code/common/teacher'

export type BuiltPack = {
  public: PublicChallenge
  private: PrivateChallengePack
}

type PublicFields = Omit<PublicChallenge, 'challengeHash'>

export function buildChallengeHash(publicFields: PublicFields): string {
  return hashChange(jcsCanonicalize(publicFields))
}

export function buildPack(source: ChallengeSource): BuiltPack {
  const publicFields: PublicFields = {
    id: source.id,
    version: source.version,
    skill: source.skill,
    objective: source.objective,
    prompt: source.prompt,
    visibleGuidance: source.visibleGuidance,
    inputContract: source.inputContract,
    outputContract: source.outputContract,
    limits: source.limits,
    prerequisites: source.prerequisites,
  }
  const challengeHash = buildChallengeHash(publicFields)
  const publicChallenge: PublicChallenge = { ...publicFields, challengeHash }
  const privatePack: PrivateChallengePack = {
    challengeHash,
    knownGoodHash: hashChange(source.knownGoodSource),
    hiddenTests: source.hiddenTests,
    mutationContracts: source.mutationContracts,
    critiqueRubric: source.critiqueRubric,
    gradingVersion: source.gradingVersion,
  }
  return { public: publicChallenge, private: privatePack }
}
