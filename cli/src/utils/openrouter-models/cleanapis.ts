/**
 * Live Clean APIs (cleanapis.com) model catalog.
 *
 * Clean APIs exposes an OpenAI-compatible authenticated `/v1/models`
 * endpoint — probed keyless it returns **401**, i.e. the route exists and is
 * auth-gated, so this is the authenticated pattern (Nous / KiosAPI / B.AI), not
 * the keyless Vercel one. The shared live-catalog fetcher supplies bounded
 * timeout, cache, in-flight deduplication, stale-cache fallback, and redacted
 * failure handling.
 *
 * Key resolution reads `process.env` only. `.env.local` is never read here —
 * a shell key and a `/provider cleanapis` stored key both arrive through the
 * same env seam, per the FID-2026-0804-001 precedence contract.
 */
import { deriveLiveCatalogUrl } from '@savant-code/common/providers/derive'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { createLiveCatalogFetcher } from './live-catalog'
import { asOptionalNumber, asOptionalString } from './wire-guards'

import type { OpenRouterModel } from './types'

const CLEANAPIS_MODELS_URL = deriveLiveCatalogUrl(
  PROVIDER_REGISTRY,
  'cleanapis',
)
if (!CLEANAPIS_MODELS_URL) {
  throw new Error(
    'cleanapis catalog must be configured as live in the provider registry',
  )
}

type CleanApisModelsResponse = {
  data?: Array<{
    id?: unknown
    name?: unknown
    description?: unknown
    context_length?: unknown
    context_window?: unknown
    max_completion_tokens?: unknown
    max_tokens?: unknown
    created?: unknown
    architecture?: {
      modality?: unknown
      tokenizer?: unknown
      instruct_type?: unknown
    }
    pricing?: {
      prompt?: unknown
      completion?: unknown
    }
    top_provider?: {
      context_length?: unknown
      max_completion_tokens?: unknown
      is_moderated?: unknown
    }
  }>
}

/**
 * Pricing arrives as a decimal STRING (`"0.000001817"`), matching OpenRouter's
 * wire shape and `openrouter.ts`'s `Number(prompt)` coercion. Non-numeric text
 * coerces to `NaN`, which is then rejected — a malformed price degrades to
 * "price not shown" rather than rendering `NaN` in the picker.
 */
function asOptionalPrice(value: unknown): number | undefined {
  if (typeof value === 'number') return asOptionalNumber(value)
  if (typeof value !== 'string' || value.length === 0) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Model ids are served BARE (`gpt-5.6-luna`), so the internal `cleanapis/`
 * prefix is added for picker routing and stripped again by the registry's
 * `idTransform: 'strip'` on the wire.
 *
 * The prefix is applied UNCONDITIONALLY — no `startsWith` guard — because the
 * registry's `strip` removes exactly one segment. If a vendor ever serves an
 * upstream id that itself begins with `cleanapis/`, a guard would leave the
 * picker id single-prefixed and `strip` would then send the WRONG id on the
 * wire (`cleanapis/router` → `router` instead of `cleanapis/router`).
 * Unconditional doubling makes the round-trip exact for every upstream id. This
 * is the vercel / orcarouter live-catalog precedent; the guard belongs to
 * CUSTOM providers, where the operator types their own already-prefixed ids,
 * not to a vendor-served catalog.
 *
 * `context_length` / `max_completion_tokens` are the OpenAI-standard names; the
 * gateway `context_window` / `max_tokens` spellings are accepted as a fallback
 * because this vendor's docs publish a per-model context column and the exact
 * field name is not guaranteed stable across catalog revisions.
 *
 * **Nested-shape mapping (FID-2026-0927-005 remediation).** Measured against the
 * live payload 2026-09-27 (33 models), this vendor serves the OpenRouter-shaped
 * fields but places `modality` / `tokenizer` / `instruct_type` one level deeper,
 * under `architecture.*`, instead of flat as `openrouter.ts` reads them. Without
 * this mapping `topProvider` was never populated and `modality` never reached
 * `model-info.ts:67-68` — the one production consumer of the capability-shaped
 * fields — so every cleanapis model rendered with no modalities line.
 *
 * `top_provider` and `pricing` are already at the TOP level, matching
 * OpenRouter, so they map exactly as `openrouter.ts` does; only `architecture.*`
 * is genuinely nested. `maxCompletionTokens` deliberately does **not** fall back
 * to `top_provider.max_completion_tokens`: that value is `null` on all 33
 * models (the vendor publishes no max-output), and routing it into the top-level
 * field would assert a number the catalog does not carry. The nested value, when
 * a vendor ever populates it, belongs in `topProvider.maxCompletionTokens` —
 * which is populated here.
 */
function parseCleanApisCatalog(
  json: CleanApisModelsResponse,
): OpenRouterModel[] {
  const parsed: OpenRouterModel[] = []
  for (const model of json.data ?? []) {
    const upstreamId = asOptionalString(model.id)
    if (!upstreamId) continue

    parsed.push({
      id: `cleanapis/${upstreamId}`,
      name: asOptionalString(model.name) ?? upstreamId,
      description: asOptionalString(model.description),
      contextLength:
        asOptionalNumber(model.context_length) ??
        asOptionalNumber(model.context_window),
      maxCompletionTokens:
        asOptionalNumber(model.max_completion_tokens) ??
        asOptionalNumber(model.max_tokens),
      promptPricePerToken: asOptionalPrice(model.pricing?.prompt),
      completionPricePerToken: asOptionalPrice(model.pricing?.completion),
      modality: asOptionalString(model.architecture?.modality),
      tokenizer: asOptionalString(model.architecture?.tokenizer),
      instructType: asOptionalString(model.architecture?.instruct_type),
      topProvider: model.top_provider
        ? {
            contextLength: asOptionalNumber(model.top_provider.context_length),
            maxCompletionTokens: asOptionalNumber(
              model.top_provider.max_completion_tokens,
            ),
            isModerated:
              typeof model.top_provider.is_moderated === 'boolean'
                ? model.top_provider.is_moderated
                : undefined,
          }
        : undefined,
      created: asOptionalString(model.created),
      provider: 'cleanapis',
    })
  }
  parsed.sort((a, b) => a.id.localeCompare(b.id))
  return parsed
}

const fetcher = createLiveCatalogFetcher<CleanApisModelsResponse>({
  url: CLEANAPIS_MODELS_URL,
  logLabel: 'Clean APIs',
  parse: parseCleanApisCatalog,
  resolveKey: () => process.env.CLEANAPIS_API_KEY,
})

export const fetchCleanApisModels = fetcher.fetchModels
export const getCachedCleanApisModels = fetcher.getCachedModels
export const hasCleanApisCatalog = fetcher.hasCatalog
export const __resetCleanApisCacheForTest = fetcher.resetForTest

/** Test-only parser seam for catalog contract tests without network access. */
export function parseCleanApisModelsForTest(
  json: CleanApisModelsResponse,
): OpenRouterModel[] {
  return parseCleanApisCatalog(json)
}
