import {
  smallerTokenLimit,
  validTokenLimit,
} from '@savant-code/common/util/model-request-limits'

import { countRequestInputTokens } from './request-token-count'

import type { LanguageModelV2CallOptions } from '@ai-sdk/provider'
import type { ModelRequestLimits } from '@savant-code/common/util/model-request-limits'

const MAX_SAFETY_RESERVE = 4096
const RESERVE_FRACTION = 0.01
const OUTPUT_OPTION_KEYS = [
  'max_tokens',
  'max_completion_tokens',
  'max_output_tokens',
  'maxCompletionTokens',
] as const

export class RequestInputBudgetError extends Error {
  readonly code = 'context_length_exceeded'
  readonly inputTokens: number
  readonly contextWindow: number
  constructor(inputTokens: number, contextWindow: number) {
    super(
      `Request input estimate ${inputTokens} leaves no output headroom within the ${contextWindow} token context window.`,
    )
    this.name = 'RequestInputBudgetError'
    this.inputTokens = inputTokens
    this.contextWindow = contextWindow
  }
}

export function assertTokenBudget(
  value: number | undefined,
  name: string,
): void {
  if (value !== undefined && validTokenLimit(value) === undefined) {
    throw new RangeError(`${name} must be a positive safe integer`)
  }
}

function providerOutputCaps(params: LanguageModelV2CallOptions): number[] {
  const caps: number[] = []
  for (const options of Object.values(params.providerOptions ?? {})) {
    for (const key of OUTPUT_OPTION_KEYS) {
      if (!(key in options)) continue
      const value = options[key]
      if (typeof value !== 'number')
        throw new RangeError(`${key} must be a positive safe integer`)
      assertTokenBudget(value, key)
      caps.push(value)
    }
  }
  return caps
}

function boundProviderOutputOptions(
  params: LanguageModelV2CallOptions,
  maxOutputTokens: number | undefined,
): LanguageModelV2CallOptions['providerOptions'] {
  if (params.providerOptions === undefined) return undefined
  return Object.fromEntries(
    Object.entries(params.providerOptions).map(([provider, options]) => [
      provider,
      Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          OUTPUT_OPTION_KEYS.some((outputKey) => outputKey === key)
            ? (maxOutputTokens ?? value)
            : value,
        ]),
      ),
    ]),
  )
}

/**
 * FID-2026-1009-003 L2: last-resort prompt trim for the overflow seam.
 * When the budget check fails and a seam is wired, drop the oldest
 * non-system turns until the re-estimated input fits with headroom.
 * System messages and the final (current) turn are always kept. Returns
 * null when even the minimal prompt cannot fit — the caller rethrows the
 * original error. Byte-for-byte prompt reuse otherwise (no copy when the
 * prompt already fits).
 */
export function trimPromptToFit(
  params: LanguageModelV2CallOptions,
  contextWindow: number,
): LanguageModelV2CallOptions | null {
const reserve = Math.min(
    MAX_SAFETY_RESERVE,
    Math.ceil(contextWindow * RESERVE_FRACTION),
  )
  // budgetModelRequest requires headroom >= 1, so the trim target is one
  // below the largest input that still passes (window - reserve - 1).
  const inputBudget = contextWindow - reserve - 1
  let prompt = params.prompt
  if (countRequestInputTokens({ ...params, prompt }) <= inputBudget) {
    return params
  }
  // Drop one oldest non-system message at a time (never the final turn).
  while (countRequestInputTokens({ ...params, prompt }) > inputBudget) {
    const dropIndex = prompt.findIndex(
      (message, index) => message.role !== 'system' && index < prompt.length - 1,
    )
    if (dropIndex === -1) return null
    prompt = [...prompt.slice(0, dropIndex), ...prompt.slice(dropIndex + 1)]
  }
  return { ...params, prompt }
}

/** Pure policy: capabilities are ceilings, never a per-request allowance. */
export function budgetModelRequest(
  params: LanguageModelV2CallOptions,
  limits: ModelRequestLimits & { contextWindow: number },
  inputTokens: number,
): LanguageModelV2CallOptions {
  assertTokenBudget(params.maxOutputTokens, 'maxOutputTokens')
  assertTokenBudget(limits.contextWindow, 'contextWindow')
  const reserve = Math.min(
    MAX_SAFETY_RESERVE,
    Math.ceil(limits.contextWindow * RESERVE_FRACTION),
  )
  const headroom = limits.contextWindow - inputTokens - reserve
  if (headroom < 1)
    throw new RequestInputBudgetError(inputTokens, limits.contextWindow)

  // Compatible adapters spread provider options over generated fields; OpenAI
  // also exposes maxCompletionTokens. Include these explicit caps in the policy.
  const requested = smallerTokenLimit(
    params.maxOutputTokens,
    limits.maxOutputTokens,
    ...providerOutputCaps(params),
  )
  // Unknown caps remain omitted: inventing one can violate an output-only cap.
  const maxOutputTokens =
    requested === undefined ? undefined : Math.min(requested, headroom)
  const providerOptions = boundProviderOutputOptions(params, maxOutputTokens)
  return { ...params, maxOutputTokens, providerOptions }
}
