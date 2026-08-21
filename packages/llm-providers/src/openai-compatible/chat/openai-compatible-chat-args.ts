import { parseProviderOptions } from '@ai-sdk/provider-utils'

import { convertToOpenAICompatibleChatMessages } from './convert-to-openai-compatible-chat-messages'
import { openaiCompatibleProviderOptions } from './openai-compatible-chat-options'
import { prepareTools } from './openai-compatible-prepare-tools'

import type { OpenAICompatibleChatModelId } from './openai-compatible-chat-options'
import type {
  LanguageModelV2,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider'

export type OpenAICompatibleChatArgsResult = {
  args: Record<string, unknown>
  warnings: LanguageModelV2CallWarning[]
}

/**
 * Build the chat-completions request body from the doGenerate/doStream
 * options. Extracted from OpenAICompatibleChatLanguageModel.getArgs
 * (FID-2026-0803-010 LLM-B: base-key reuse when the provider name coincides).
 */
export async function buildOpenAICompatibleChatArgs(params: {
  modelId: OpenAICompatibleChatModelId
  providerOptionsName: string
  supportsStructuredOutputs: boolean
  options: Parameters<LanguageModelV2['doGenerate']>[0]
}): Promise<OpenAICompatibleChatArgsResult> {
  const { modelId, providerOptionsName, supportsStructuredOutputs, options } =
    params
  const {
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    providerOptions,
    stopSequences,
    responseFormat,
    seed,
    toolChoice,
    tools,
  } = options
  const warnings: LanguageModelV2CallWarning[] = []

  // Parse provider options. FID-2026-0803-010 LLM-B: the base key and the
  // configured provider name coincide by default ('openai-compatible'), so
  // re-parsing the same key is redundant — reuse the base result. Custom
  // provider names still parse their own key.
  const baseOptionsResult = await parseProviderOptions({
    provider: 'openai-compatible',
    providerOptions,
    schema: openaiCompatibleProviderOptions,
  })
  const providerOptionsResult =
    providerOptionsName === 'openai-compatible'
      ? baseOptionsResult
      : await parseProviderOptions({
          provider: providerOptionsName,
          providerOptions,
          schema: openaiCompatibleProviderOptions,
        })
  const compatibleOptions = Object.assign(
    baseOptionsResult ?? {},
    providerOptionsResult ?? {},
  )

  if (topK != null) {
    warnings.push({ type: 'unsupported-setting', setting: 'topK' })
  }

  if (
    responseFormat?.type === 'json' &&
    responseFormat.schema != null &&
    !supportsStructuredOutputs
  ) {
    warnings.push({
      type: 'unsupported-setting',
      setting: 'responseFormat',
      details:
        'JSON response format schema is only supported with structuredOutputs',
    })
  }

  const {
    tools: openaiTools,
    toolChoice: openaiToolChoice,
    toolWarnings,
  } = prepareTools({
    tools,
    toolChoice,
  })

  return {
    args: {
      // model id:
      model: modelId,

      // model specific settings:
      user: compatibleOptions.user,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format:
        responseFormat?.type === 'json'
          ? supportsStructuredOutputs === true && responseFormat.schema != null
            ? {
                type: 'json_schema',
                json_schema: {
                  schema: responseFormat.schema,
                  name: responseFormat.name ?? 'response',
                  description: responseFormat.description,
                },
              }
            : { type: 'json_object' }
          : undefined,

      stop: stopSequences,
      seed,
      ...Object.fromEntries(
        Object.entries(providerOptions?.[providerOptionsName] ?? {}).filter(
          ([key]) =>
            !Object.keys(openaiCompatibleProviderOptions.shape).includes(key),
        ),
      ),

      reasoning_effort: compatibleOptions.reasoningEffort,
      verbosity: compatibleOptions.textVerbosity,

      // messages:
      messages: convertToOpenAICompatibleChatMessages(prompt),

      // tools:
      tools: openaiTools,
      tool_choice: openaiToolChoice,
    },
    warnings: [...warnings, ...toolWarnings],
  }
}
