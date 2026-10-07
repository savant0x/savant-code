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
      delete obj.providerOptions?.[provider]?.cache_control?.type
    }
    if (
      Object.keys(obj.providerOptions?.[provider]?.cache_control ?? {}).length ===
      0
    ) {
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

export function withCacheControl<
  T extends { providerOptions?: ProviderMetadata },
>(obj: T): T {
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
    wrapper.providerOptions[provider].cache_control = { type: 'ephemeral' }
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
