/**
 * Teacher mutation contract — FID-2026-0813-012/017.
 *
 * V1 injects one deterministic mutation per attempt from a versioned catalog.
 * Each mutation has a real witness, expected impact, detectability contract,
 * and acceptable critique concepts. The injector never invents untestable
 * random defects.
 */
import type { SkillId } from './challenge'

export type MutationSeverity = 'low' | 'medium' | 'high' | 'critical'

/** A deterministic patch applied to the known-good source to produce the flaw. */
export type MutationPatch = {
  /** Literal substring to replace in the known-good source. */
  find: string
  /** Replacement text. */
  replace: string
  /** 1-based occurrence to replace (defaults to the first). */
  occurrence?: number
}

export type MutationContract = {
  mutationId: string
  skillTarget: SkillId
  /** Exact changed behavior, in prose. */
  changedBehavior: string
  /** The observable surface (function, edge case, error path) the flaw lives on. */
  surface: string
  /** The counterexample/witness input that reveals the defect. */
  witness: string
  /** The expected impact of the defect. */
  impact: string
  severity: MutationSeverity
  /** Acceptable critique concepts + synonyms the rubric maps to this mutation. */
  acceptableConcepts: string[]
  /** Deterministic patch that re-derives the mutated source from known-good. */
  patch: MutationPatch
  /** When true, the defect must remain hidden from the public/visible tests. */
  hiddenFromVisibleTests: boolean
  graderVersion: string
}

/** A versioned catalog of mutations, keyed by mutation id. */
export type MutationCatalog = {
  version: string
  mutations: MutationContract[]
}
