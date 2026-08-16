/**
 * Deterministic mutation injector — FID-2026-0813-015/017.
 *
 * A mutation patch is applied to the known-good source by literal find/replace
 * at a fixed occurrence (default the first). The injector never invents random
 * defects; if the patch cannot be applied, it reports `applied: false` so the
 * validation pipeline can reject a non-derivable mutation rather than run a
 * silently-unchanged source.
 */
import type { MutationContract } from '@savant-code/common/teacher'

export type ApplyMutationResult = {
  applied: boolean
  source: string
}

export function applyMutation(
  knownGoodSource: string,
  contract: MutationContract,
): ApplyMutationResult {
  const occurrence = contract.patch.occurrence ?? 1
  let index = -1
  for (let i = 0; i < occurrence; i++) {
    index = knownGoodSource.indexOf(contract.patch.find, index + 1)
    if (index === -1) return { applied: false, source: knownGoodSource }
  }
  const source =
    knownGoodSource.slice(0, index) +
    contract.patch.replace +
    knownGoodSource.slice(index + contract.patch.find.length)
  return { applied: true, source }
}

/** Select a mutation deterministically from a pack's contracts (V1: first). */
export function selectMutation(
  contracts: MutationContract[],
  attemptSeed: string,
): MutationContract {
  // V1 keeps one mutation per attempt; selection is by stable index derived
  // from the attempt seed so retries vary but stay reproducible.
  let hash = 0
  for (let i = 0; i < attemptSeed.length; i++) {
    hash = (hash * 31 + attemptSeed.charCodeAt(i)) >>> 0
  }
  return contracts[hash % contracts.length]
}
