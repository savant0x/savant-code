import { cloneDeep, has } from 'lodash'

import type { ProviderMetadata } from '../../types/messages/provider-metadata'

/**
 * The one provider set the cache-control breakpoint marker is written to and
 * cleared from (FID-2026-1006-005 step 4). Two spellings and two sets used to
 * coexist: this module wrote snake_case `cache_control` over these three, while
 * the agent-runtime trim path deleted camelCase `cacheControl` over
 * anthropic|openrouter|savant-code — a spelling nothing in this repository
 * writes, and a set that omits the provider the writer actually tags. That
 * deletion was therefore dead against the real marker, and the comment beside
 * it described re-tagging that was never implemented.
 */
export const CACHE_CONTROL_PROVIDERS = [
  'anthropic',
  'openrouter',
  'openaiCompatible',
] as const

/**
 * Removes the breakpoint marker IN PLACE — the contract the trim path needs,
 * since it owns the array it is clearing — using the same spelling and the same
 * provider set the writer uses. A provider entry emptied by the removal is
 * pruned, and `providerOptions` itself is dropped when nothing is left in it.
 *
 * The write side and both clear sides share this module on purpose: if a second
 * spelling is ever introduced, this is the one place that has to change, and
 * `packages/agent-runtime/src/util/__tests__/messages-trim-cache-control.test.ts`
 * is what fails when the two ends disagree.
 */
export function clearCacheControlInPlace<
  T extends { providerOptions?: ProviderMetadata },
>(obj: T): T {
  for (const provider of CACHE_CONTROL_PROVIDERS) {
    if (has(obj.providerOptions?.[provider]?.cache_control, 'type')) {
      // Delete the WHOLE marker, not just its `type` key. Step 7 gave the
      // marker a second field (`ttl`), and removing only `type` would leave
      // `{ ttl: '1h' }` behind — a partially-cleared breakpoint that reads as
      // cleared by the presence check above while still travelling to the
      // provider. (Caught by the TTL case in
      // packages/agent-runtime/src/util/__tests__/messages-trim-cache-control.test.ts.)
      delete obj.providerOptions?.[provider]?.cache_control
    }
    if (Object.keys(obj.providerOptions?.[provider] ?? {}).length === 0) {
      delete obj.providerOptions?.[provider]
    }
  }

  if (Object.keys(obj.providerOptions ?? {}).length === 0) {
    delete obj.providerOptions
  }

  return obj
}

/**
 * Cache-breakpoint lifetime. Anthropic's explicit-cache TTL is the one
 * provider-side spend knob this harness sets: a 5-minute write costs 1.25x the
 * base input rate and a 1-hour write costs 2.0x, while every read costs 0.1x —
 * so the longer TTL only pays for itself when the same prefix is reused at
 * least twice more (FID-2026-1006-005 step 7).
 */
export type CacheBreakpointTtl = '5m' | '1h'

/**
 * The operator-approved mode-to-TTL policy (FID-2026-1006-005 step 7; operator
 * ruling 2026-10-07: "approve, grant automation level 3").
 *
 * STRICT mode IS ECHO's FID-bound execution — a record per change, the full
 * ceremony, many turns against one prefix — so its breakpoints are written for
 * the long cache. HYBRID returns undefined, which emits the provider default
 * (5m) and keeps today's request bytes byte-for-byte unchanged.
 */
export function resolveCacheBreakpointTtl(
  enforcementMode?: 'hybrid' | 'strict',
): CacheBreakpointTtl | undefined {
  return enforcementMode === 'strict' ? '1h' : undefined
}

export function withCacheControl<
  T extends { providerOptions?: ProviderMetadata },
>(obj: T, ttl?: CacheBreakpointTtl): T {
  const wrapper = cloneDeep(obj)
  if (!wrapper.providerOptions) {
    wrapper.providerOptions = {}
  }

  /* 'savant-code' provider name is not compatible with providerMetadata for
   * messages, so we need to use 'openaiCompatible' instead.
   * https://github.com/vercel/ai/blob/8e4fdac31b4f8c6a8d07a606a8833e74adf99470/packages/openai-compatible/src/chat/convert-to-openai-compatible-chat-messages.ts#L9
   */
  for (const provider of CACHE_CONTROL_PROVIDERS) {
    if (!wrapper.providerOptions[provider]) {
      wrapper.providerOptions[provider] = {}
    }
    wrapper.providerOptions[provider].cache_control = {
      type: 'ephemeral',
      ...(ttl ? { ttl } : {}),
    }
  }

  return wrapper
}

export function withoutCacheControl<
  T extends { providerOptions?: ProviderMetadata },
>(obj: T): T {
  // The same clearer, over a clone: `convertCbToModelMessages` must not mutate
  // the caller's message history.
  return clearCacheControlInPlace(cloneDeep(obj))
}
