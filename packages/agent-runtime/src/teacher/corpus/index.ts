/**
 * Corpus authoring and validation — FID-2026-0813-015.
 */
export { buildChallengeHash, buildPack, type BuiltPack } from './pack'
export {
  challengeSourceSchema,
  corpusSourceSchema,
  parseCorpusSource,
  type ChallengeSource,
  type CorpusSource,
} from './source'
export {
  scanIsolation,
  validateChallenge,
  type IsolationReport,
  type KnownGoodReport,
  type MutationWitnessReport,
  type ValidationReport,
} from './validate'
