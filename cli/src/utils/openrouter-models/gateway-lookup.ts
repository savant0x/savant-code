/**
 * Gateway-catalog model lookup (exact → provider-prefix → base-family).
 * Move-only seam split from `lookup.ts` (FID-2026-0919-018 loop record):
 * the branch-2b insertion pushed the shared ladder module over the 300-line
 * quality ceiling; this function is a self-contained catalog matcher with
 * no dependency on the OpenRouter ladder.
 */
import { getCachedGatewayModels } from './gateway'

import type { OpenRouterModel } from './types'

/**
 * Look up a model in the cached gateway catalog by id, falling back to a
 * provider-prefixed match and then a base-family match.
 *
 * When the initial match comes from a hardcoded catalog (TokenRouter, OpenCode
 * Go) that has an *inferred* context length (not from the API), this function
 * also checks the live OpenRouter catalog for the canonical model ID to find
 * the real context length.
 */
export function findGatewayModel(modelId: string): OpenRouterModel | undefined {
  const catalog = getCachedGatewayModels()

  // Exact match
  const exact = catalog.find((m) => m.id === modelId)
  if (exact) return exact

  // Provider prefix variants (e.g. "openai/gpt-5" vs "gpt-5")
  const withoutProvider = catalog.find(
    (m) => m.id === modelId.replace(/^[a-z0-9-]+\//, ''),
  )
  if (withoutProvider) return withoutProvider

  // Base family match (e.g. "anthropic/claude-sonnet-4" vs "anthropic/claude-sonnet-4.8")
  // Also handles v-prefixed versions: "mimo-v2.5" → "mimo"
  const familyId = modelId.replace(/-v?\d+(\.\d+)?$/, '')
  if (familyId && familyId !== modelId) {
    const family = catalog.find((m) => m.id.startsWith(familyId))
    if (family) return family
  }

  return undefined
}
