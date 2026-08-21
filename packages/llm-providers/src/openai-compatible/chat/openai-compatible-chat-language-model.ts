import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler,
  createJsonResponseHandler,
  generateId,
  postJsonToApi,
} from '@ai-sdk/provider-utils'

import { getResponseMetadata } from './get-response-metadata'
import { mapOpenAICompatibleFinishReason } from './map-openai-compatible-finish-reason'
import { buildOpenAICompatibleChatArgs } from './openai-compatible-chat-args'
import {
  OpenAICompatibleChatResponseSchema,
  createOpenAICompatibleChatChunkSchema,
} from './openai-compatible-chat-schema'
import {
  createChatStreamTransformer,
  getRequiredToolKeys,
} from './stream-transform'
import { defaultOpenAICompatibleErrorStructure } from '../openai-compatible-error'

import type { OpenAICompatibleChatModelId } from './openai-compatible-chat-options'
import type {
  OpenAICompatibleErrorData,
  ProviderErrorStructure,
} from '../openai-compatible-error'
import type { MetadataExtractor } from './openai-compatible-metadata-extractor'
import type {
  APICallError,
  LanguageModelV2,
  LanguageModelV2Content,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider'
import type { FetchFunction, ResponseHandler } from '@ai-sdk/provider-utils'
import type { JSONValue } from '@savant-code/common/types/json'

export type OpenAICompatibleChatConfig = {
  provider: string
  headers: () => Record<string, string | undefined>
  url: (options: { modelId: string; path: string }) => string
  fetch?: FetchFunction
  includeUsage?: boolean
  errorStructure?: ProviderErrorStructure<OpenAICompatibleErrorData>
  metadataExtractor?: MetadataExtractor

  /**
   * Whether the model supports structured outputs.
   */
  supportsStructuredOutputs?: boolean

  /**
   * The supported URLs for the model.
   */
  supportedUrls?: () => LanguageModelV2['supportedUrls']
}

export class OpenAICompatibleChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2'

  readonly supportsStructuredOutputs: boolean

  readonly modelId: OpenAICompatibleChatModelId
  private readonly config: OpenAICompatibleChatConfig
  private readonly failedResponseHandler: ResponseHandler<APICallError>
  private readonly chunkSchema // type inferred via constructor

  constructor(
    modelId: OpenAICompatibleChatModelId,
    config: OpenAICompatibleChatConfig,
  ) {
    this.modelId = modelId
    this.config = config

    // initialize error handling:
    const errorStructure =
      config.errorStructure ?? defaultOpenAICompatibleErrorStructure
    this.chunkSchema = createOpenAICompatibleChatChunkSchema(
      errorStructure.errorSchema,
    )
    this.failedResponseHandler = createJsonErrorResponseHandler(errorStructure)

    this.supportsStructuredOutputs = config.supportsStructuredOutputs ?? false
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

  private async getArgs(options: Parameters<LanguageModelV2['doGenerate']>[0]) {
    return buildOpenAICompatibleChatArgs({
      modelId: this.modelId,
      providerOptionsName: this.providerOptionsName,
      supportsStructuredOutputs: this.supportsStructuredOutputs,
      options,
    })
  }

  async doGenerate(
    options: Parameters<LanguageModelV2['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    const { args, warnings } = await this.getArgs({ ...options })

    const body = JSON.stringify(args)

    const {
      responseHeaders,
      value: responseBody,
      rawValue: rawResponse,
    } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenAICompatibleChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    })

    // FID-2026-0803-002 LLM-1: guard against an empty `choices` array, which
    // is valid per the response schema (mirrors the completion-model guard from
    // FID-006 LLM1 that was missed on this primary hot path).
    const choice = responseBody.choices[0]
    const content: Array<LanguageModelV2Content> = []

    // text content:
    const text = choice?.message.content
    if (text != null && text.length > 0) {
      content.push({ type: 'text', text })
    }

    // reasoning content:
    const reasoning =
      choice?.message.reasoning_content ?? choice?.message.reasoning
    if (reasoning != null && reasoning.length > 0) {
      content.push({
        type: 'reasoning',
        text: reasoning,
      })
    }

    // tool calls:
    if (choice?.message.tool_calls != null) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments!,
        })
      }
    }

    // provider metadata:
    const extractedMetadata =
      await this.config.metadataExtractor?.extractMetadata?.({
        parsedBody: rawResponse as Record<string, JSONValue>,
      })
    const providerMetadata: SharedV2ProviderMetadata = {
      [this.providerOptionsName]: {},
      ...extractedMetadata,
    }
    const completionTokenDetails = responseBody.usage?.completion_tokens_details
    if (completionTokenDetails?.accepted_prediction_tokens != null) {
      providerMetadata[this.providerOptionsName].acceptedPredictionTokens =
        completionTokenDetails?.accepted_prediction_tokens
    }
    if (completionTokenDetails?.rejected_prediction_tokens != null) {
      providerMetadata[this.providerOptionsName].rejectedPredictionTokens =
        completionTokenDetails?.rejected_prediction_tokens
    }

    return {
      content,
      finishReason: mapOpenAICompatibleFinishReason(choice?.finish_reason),
      usage: {
        inputTokens: responseBody.usage?.prompt_tokens ?? undefined,
        outputTokens: responseBody.usage?.completion_tokens ?? undefined,
        totalTokens: responseBody.usage?.total_tokens ?? undefined,
        reasoningTokens:
          responseBody.usage?.completion_tokens_details?.reasoning_tokens ??
          undefined,
        cachedInputTokens:
          responseBody.usage?.prompt_tokens_details?.cached_tokens ?? undefined,
      },
      providerMetadata,
      request: { body },
      response: {
        ...getResponseMetadata(responseBody),
        headers: responseHeaders,
        body: rawResponse,
      },
      warnings,
    }
  }

  async doStream(
    options: Parameters<LanguageModelV2['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    const { args, warnings } = await this.getArgs({ ...options })

    const body = {
      ...args,
      stream: true,

      // only include stream_options when in strict compatibility mode:
      stream_options: this.config.includeUsage
        ? { include_usage: true }
        : undefined,
    }

    const metadataExtractor =
      this.config.metadataExtractor?.createStreamExtractor()

    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
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

    const requiredToolKeys = getRequiredToolKeys(options.tools)

    return {
      stream: response.pipeThrough(
        createChatStreamTransformer({
          warnings,
          includeRawChunks: options.includeRawChunks,
          metadataExtractor,
          requiredToolKeys,
          providerOptionsName: this.providerOptionsName,
        }),
      ),
      request: { body },
      response: { headers: responseHeaders },
    }
  }
}

export {
  isCompleteToolCallArguments,
  parseToolCallArguments,
} from './stream-transform'
export type { ParsedToolArguments } from './stream-transform'
