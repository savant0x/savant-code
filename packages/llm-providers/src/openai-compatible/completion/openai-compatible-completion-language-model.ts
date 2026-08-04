import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
} from '@ai-sdk/provider-utils'
import { z } from 'zod/v4'

import { defaultOpenAICompatibleErrorStructure } from '../openai-compatible-error'
import { convertToOpenAICompatibleCompletionPrompt } from './convert-to-openai-compatible-completion-prompt'
// FID-2026-0803-010 LLM-C: byte-identical copies of these helpers lived in
// completion/; the chat/ versions are canonical now.
import { openaiCompatibleCompletionProviderOptions } from './openai-compatible-completion-options'
import { getResponseMetadata } from '../chat/get-response-metadata'
import { mapOpenAICompatibleFinishReason } from '../chat/map-openai-compatible-finish-reason'

import type { OpenAICompatibleCompletionModelId } from './openai-compatible-completion-options'
import type {
  OpenAICompatibleErrorData,
  ProviderErrorStructure,
} from '../openai-compatible-error'
import type {
  APICallError,
  LanguageModelV2,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from '@ai-sdk/provider'
import type {
  FetchFunction,
  ParseResult,
  ResponseHandler,
} from '@ai-sdk/provider-utils'

type OpenAICompatibleCompletionConfig = {
  provider: string
  includeUsage?: boolean
  headers: () => Record<string, string | undefined>
  url: (options: { modelId: string; path: string }) => string
  fetch?: FetchFunction
  errorStructure?: ProviderErrorStructure<OpenAICompatibleErrorData>

  /**
   * The supported URLs for the model.
   */
  supportedUrls?: () => LanguageModelV2['supportedUrls']
}

export class OpenAICompatibleCompletionLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2'

  readonly modelId: OpenAICompatibleCompletionModelId
  private readonly config: OpenAICompatibleCompletionConfig
  private readonly failedResponseHandler: ResponseHandler<APICallError>
  private readonly chunkSchema // type inferred via constructor

  constructor(
    modelId: OpenAICompatibleCompletionModelId,
    config: OpenAICompatibleCompletionConfig,
  ) {
    this.modelId = modelId
    this.config = config

    // initialize error handling:
    const errorStructure =
      config.errorStructure ?? defaultOpenAICompatibleErrorStructure
    this.chunkSchema = createOpenAICompatibleCompletionChunkSchema(
      errorStructure.errorSchema,
    )
    this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure)
  }

  get provider(): string {
    return this.config.provider
  }

  private get providerOptionsName(): string {
    return this.config.provider.split('.')[0].trim()
  }

  get supportedUrls() {
    return this.config.supportedUrls?.() ?? {}
  }

  private async getArgs({
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
  }: Parameters<LanguageModelV2['doGenerate']>[0]) {
    const warnings: LanguageModelV2CallWarning[] = []

    // Parse provider options
    const completionOptionsResult = await parseProviderOptions({
      provider: this.providerOptionsName,
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
          Object.entries(
            providerOptions?.[this.providerOptionsName] ?? {},
          ).filter(
            ([key]) =>
              !Object.keys(
                openaiCompatibleCompletionProviderOptions.shape,
              ).includes(key),
          ),
        ),

        // model id (FID-006 LLM2): re-asserted AFTER the provider-options
        // spread so a provider option can never override the requested model
        // (billing/routing integrity).
        model: this.modelId,

        // prompt:
        prompt: completionPrompt,

        // stop sequences:
        stop: stop.length > 0 ? stop : undefined,
      },
      warnings,
    }
  }

  async doGenerate(
    options: Parameters<LanguageModelV2['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    const { args, warnings } = await this.getArgs(options)

    const {
      responseHeaders,
      value: response,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        openaiCompatibleCompletionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    // FID-006 LLM1: guard against providers returning an empty `choices`
    // array (valid per the response schema). An unguarded `choice.text` deref
    // would throw a TypeError that crashes the caller.
    const choice = response.choices[0]
    const content: Array<LanguageModelV2Content> = []

    // text content:
    if (choice?.text != null && choice.text.length > 0) {
      content.push({ type: 'text', text: choice.text })
    }

    return {
      content,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? undefined,
        outputTokens: response.usage?.completion_tokens ?? undefined,
        totalTokens: response.usage?.total_tokens ?? undefined,
      },
      finishReason: choice
        ? mapOpenAICompatibleFinishReason(choice.finish_reason)
        : 'unknown',
      request: { body: args },
      response: {
        ...getResponseMetadata(response),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    }
  }

  async doStream(
    options: Parameters<LanguageModelV2['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    const { args, warnings } = await this.getArgs(options)

    const body = {
      ...args,
      stream: true,

      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage
        ? { include_usage: true }
        : undefined,
    }

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        this.chunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    let finishReason: LanguageModelV2FinishReason = 'unknown'
    const usage: LanguageModelV2Usage = {
      inputTokens: undefined,
      outputTokens: undefined,
      totalTokens: undefined,
    }
    let isFirstChunk = true

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof this.chunkSchema>>,
          LanguageModelV2StreamPart
        >({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings })
          },

          transform(chunk, controller) {
            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = 'error'
              controller.enqueue({ type: 'error', error: chunk.error })
              return
            }

            const value = chunk.value

            // Emit raw chunk if requested (after success check so rawValue is
            // guaranteed) — FID-2026-0803-002 LLM-5, mirrors the chat model.
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue })
            }

            // handle error chunks:
            if ('error' in value) {
              finishReason = 'error'
              // FID-2026-0803-002 LLM-6: unify the payload with the chat model
              // (string message) instead of the full error object.
              controller.enqueue({
                type: 'error',
                error: value.error.message,
              })
              return
            }

            if (isFirstChunk) {
              isFirstChunk = false

              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              })

              controller.enqueue({
                type: 'text-start',
                id: '0',
              })
            }

            if (value.usage != null) {
              usage.inputTokens = value.usage.prompt_tokens ?? undefined
              usage.outputTokens = value.usage.completion_tokens ?? undefined
              usage.totalTokens = value.usage.total_tokens ?? undefined
            }

            const choice = value.choices[0]

            if (choice?.finish_reason != null) {
              finishReason = mapOpenAICompatibleFinishReason(
                choice.finish_reason,
              )
            }

            if (choice?.text != null) {
              controller.enqueue({
                type: 'text-delta',
                id: '0',
                delta: choice.text,
              })
            }
          },

          flush(controller) {
            if (!isFirstChunk) {
              controller.enqueue({ type: 'text-end', id: '0' })
            }

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
            })
          },
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}

const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const openaiCompatibleCompletionResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      text: z.string(),
      finish_reason: z.string(),
    }),
  ),
  usage: usageSchema.nullish(),
})

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const createOpenAICompatibleCompletionChunkSchema = <
  ERROR_SCHEMA extends z.core.$ZodType,
>(
  errorSchema: ERROR_SCHEMA,
) =>
  z.union([
    z.object({
      id: z.string().nullish(),
      created: z.number().nullish(),
      model: z.string().nullish(),
      choices: z.array(
        z.object({
          text: z.string(),
          finish_reason: z.string().nullish(),
          index: z.number(),
        }),
      ),
      usage: usageSchema.nullish(),
    }),
    errorSchema,
  ])
