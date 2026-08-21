import { parseProviderOptions } from '@ai-sdk/provider-utils'

import { convertToOpenAICompatibleCompletionPrompt } from './convert-to-openai-compatible-completion-prompt'
import { openaiCompatibleCompletionProviderOptions } from './openai-compatible-completion-options'

import type { OpenAICompatibleCompletionModelId } from './openai-compatible-completion-options'
import type {
  LanguageModelV2,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider'

export type OpenAICompatibleCompletionArgsResult = {
  args: Record<string, unknown>
  warnings: LanguageModelV2CallWarning[]
}

/**
 * Build the completions request body from the doGenerate/doStream options.
 * Extracted from OpenAICompatibleCompletionLanguageModel.getArgs
 * (FID-2026-0819-005 quality ratchet: file-length remediation, Loop 115).
 */
export async function buildOpenAICompatibleCompletionArgs(params: {
  modelId: OpenAICompatibleCompletionModelId
  providerOptionsName: string
  options: Parameters<LanguageModelV2['doGenerate']>[0]
}): Promise<OpenAICompatibleCompletionArgsResult> {
  const { modelId, providerOptionsName, options } = params
  const {
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    seed,
    providerOptions,
    tools,
    toolChoice,
  } = options
  const warnings: LanguageModelV2CallWarning[] = []

  // Parse provider options
  const completionOptionsResult = await parseProviderOptions({
    provider: providerOptionsName,
    providerOptions,
    schema: openaiCompatibleCompletionProviderOptions,
  })
  const completionOptions = completionOptionsResult ?? {}

  if (topK != null) {
    warnings.push({ type: 'unsupported-setting', setting: 'topK' })
  }

  if (tools?.length) {
    warnings.push({ type: 'unsupported-setting', setting: 'tools' })
  }

  if (toolChoice != null) {
    warnings.push({ type: 'unsupported-setting', setting: 'toolChoice' })
  }

  if (responseFormat != null && responseFormat.type !== 'text') {
    warnings.push({
      type: 'unsupported-setting',
      setting: 'responseFormat',
      details: 'JSON response format is not supported.',
    })
  }

  const { prompt: completionPrompt, stopSequences } =
    convertToOpenAICompatibleCompletionPrompt({ prompt })

  const stop = [...(stopSequences ?? []), ...(userStopSequences ?? [])]

  return {
    args: {
      // model specific settings:
      echo: completionOptions.echo,
      logit_bias: completionOptions.logitBias,
      suffix: completionOptions.suffix,
      user: completionOptions.user,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
      // FID-2026-0803-002 LLM-2: filter out the known option keys from the
      // raw spread (mirroring the chat model) so a caller passing e.g.
      // `logitBias` does not send BOTH `logit_bias` (mapped) and `logitBias`
      // (raw camelCase) on the wire.
      ...Object.fromEntries(
        Object.entries(providerOptions?.[providerOptionsName] ?? {}).filter(
          ([key]) =>
            !Object.keys(
              openaiCompatibleCompletionProviderOptions.shape,
            ).includes(key),
        ),
      ),

      // model id (FID-006 LLM2): re-asserted AFTER the provider-options
      // spread so a provider option can never override the requested model
      // (billing/routing integrity).
      model: modelId,

      // prompt:
      prompt: completionPrompt,

      // stop sequences:
      stop: stop.length > 0 ? stop : undefined,
    },
    warnings,
  }
}
