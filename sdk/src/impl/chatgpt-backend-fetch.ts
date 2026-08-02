/**
 * Custom fetch for routing ChatGPT OAuth requests through the ChatGPT backend API.
 *
 * The AI SDK's OpenAICompatibleChatLanguageModel speaks Chat Completions format,
 * but ChatGPT OAuth tokens only work with the ChatGPT backend (chatgpt.com/backend-api)
 * which uses the Responses API format.
 *
 * This module transforms:
 * - Request: Chat Completions body → Responses API body
 * - Response: Responses API SSE → Chat Completions SSE
 */

import type { FetchFunction } from '@ai-sdk/provider-utils'
import type { JSONValue, JSONObject } from '@savant-code/common/types/json'

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

// ============================================================================
// JWT / Account ID
// ============================================================================

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad === 2) base64 += '=='
  else if (pad === 3) base64 += '='
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function extractChatGptAccountId(accessToken: string): string | null {
  try {
    const parts = accessToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    const auth = payload?.['https://api.openai.com/auth']
    return typeof auth?.chatgpt_account_id === 'string'
      ? auth.chatgpt_account_id
      : null
  } catch {
    return null
  }
}

// ============================================================================
// Request Transform: Chat Completions → Responses API
// ============================================================================

interface ChatCompletionsToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

interface ChatCompletionsMessage {
  role: string
  content?: JSONValue
  tool_calls?: ChatCompletionsToolCall[]
  tool_call_id?: string
}

interface ChatCompletionsTool {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: JSONValue
    strict?: boolean
  }
}

interface ChatCompletionsBody {
  model: JSONValue
  messages: ChatCompletionsMessage[]
  tools: ChatCompletionsTool[]
  tool_choice?: JSONValue
  reasoning_effort?: string
}

function parseChatCompletionsBody(raw: string): ChatCompletionsBody {
  const parsed = JSON.parse(raw)

  const messages: ChatCompletionsMessage[] = []
  if (Array.isArray(parsed.messages)) {
    for (const msg of parsed.messages) {
      if (msg && typeof msg.role === 'string') {
        messages.push({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.tool_calls,
          tool_call_id: msg.tool_call_id,
        })
      }
    }
  }

  const tools: ChatCompletionsTool[] = []
  if (Array.isArray(parsed.tools)) {
    for (const tool of parsed.tools) {
      if (tool && typeof tool.type === 'string') {
        tools.push({
          type: tool.type,
          function: tool.function,
        })
      }
    }
  }

  return {
    model: parsed.model,
    messages,
    tools,
    tool_choice: parsed.tool_choice,
    reasoning_effort:
      typeof parsed.reasoning_effort === 'string'
        ? parsed.reasoning_effort
        : undefined,
  }
}

function convertUserContentParts(content: JSONValue | undefined): JSONValue {
  if (content == null) return null
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return String(content ?? '')
  return content.map((part: JSONValue) => {
    const p = part as JSONObject
    if (p.type === 'text') {
      return { type: 'input_text', text: p.text }
    }
    if (p.type === 'image_url') {
      const imageUrl = p.image_url as JSONObject | undefined
      if (imageUrl?.url != null) {
        return { type: 'input_image', image_url: imageUrl.url }
      }
      if (imageUrl != null) {
        return { type: 'input_image', image_url: imageUrl }
      }
      return { type: 'input_image' }
    }
    return p
  })
}

function convertMessages(messages: ChatCompletionsMessage[]): JSONValue[] {
  const input: JSONValue[] = []

  for (const msg of messages) {
    switch (msg.role) {
      case 'system': {
        // System messages are extracted to top-level `instructions` field;
        // if any slip through, convert to developer role
        if (msg.content) {
          input.push({
            type: 'message',
            role: 'developer',
            content: msg.content,
          })
        }
        break
      }

      case 'user': {
        const content = convertUserContentParts(msg.content)
        if (content) {
          input.push({ type: 'message', role: 'user', content })
        }
        break
      }

      case 'assistant': {
        if (msg.content) {
          input.push({
            type: 'message',
            role: 'assistant',
            content: msg.content,
          })
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            input.push({
              type: 'function_call',
              call_id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            })
          }
        }
        break
      }

      case 'tool': {
        input.push({
          type: 'function_call_output',
          call_id: msg.tool_call_id ?? 'unknown',
          output:
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content ?? null),
        })
        break
      }
    }
  }

  return input
}

function convertTools(tools: ChatCompletionsTool[]): JSONValue[] {
  return tools.map((tool) => {
    if (tool.type === 'function' && tool.function) {
      const result: JSONObject = {
        type: 'function',
        name: tool.function.name,
      }
      if (tool.function.description != null) {
        result.description = tool.function.description
      }
      if (tool.function.parameters != null) {
        result.parameters = tool.function.parameters
      }
      if (tool.function.strict != null) {
        result.strict = tool.function.strict
      }
      return result
    }
    const fallback: JSONObject = { type: tool.type }
    if (tool.function != null) {
      fallback.function = tool.function as unknown as JSONValue
    }
    return fallback
  })
}

function transformRequestBody(body: ChatCompletionsBody): JSONObject {
  const { messages, tools } = body

  // Extract system messages into the top-level `instructions` field
  // (required by the ChatGPT backend API)
  const systemMessages = messages.filter((m) => m.role === 'system')
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')
  const instructions = systemMessages
    .map((m) =>
      typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    )
    .join('\n\n')

  const transformed: JSONObject = {
    model: body.model,
    instructions: instructions || 'You are a helpful assistant.',
    input: convertMessages(nonSystemMessages),
    stream: true,
    store: false,
    include: ['reasoning.encrypted_content'],
  }

  if (tools?.length) {
    transformed.tools = convertTools(tools)
  }
  if (body.tool_choice != null) {
    transformed.tool_choice = body.tool_choice
  }

  // The ChatGPT backend does not support: max_output_tokens, max_tokens,
  // temperature, top_p, stop, frequency_penalty, presence_penalty, logprobs,
  // n, stream_options — omit them all.

  const reasoningEffort = body.reasoning_effort as string | undefined
  transformed.reasoning = {
    effort: reasoningEffort || 'high',
    summary: 'auto',
  }

  transformed.text = { verbosity: 'medium' }

  return transformed
}

// ============================================================================
// Response Transform: Responses API SSE → Chat Completions SSE
// ============================================================================

function createSseTransformStream(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  let buffer = ''
  let responseId: string | null = null
  let responseModel: string | null = null
  let nextToolCallIndex = 0
  const outputIndexToToolIndex = new Map<number, number>()
  let emittedRole = false

  function emit(
    controller: TransformStreamDefaultController<Uint8Array>,
    chunk: JSONObject,
  ) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
  }

  function processEvent(
    controller: TransformStreamDefaultController<Uint8Array>,
    data: JSONObject,
  ) {
    const type = data.type as string | undefined
    if (!type) return

    switch (type) {
      case 'response.created': {
        const resp = data.response as JSONObject | undefined
        responseId = (resp?.id as string) ?? null
        responseModel = (resp?.model as string) ?? null
        if (!emittedRole) {
          emit(controller, {
            id: responseId,
            model: responseModel,
            choices: [
              { index: 0, delta: { role: 'assistant' }, finish_reason: null },
            ],
          })
          emittedRole = true
        }
        break
      }

      case 'response.output_text.delta': {
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: { content: data.delta as string },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.reasoning_summary_text.delta': {
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: { reasoning_content: data.delta as string },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.output_item.added': {
        const item = data.item as JSONObject | undefined
        if (item?.type === 'function_call') {
          const tcIndex = nextToolCallIndex++
          const outputIdx = (data.output_index as number) ?? 0
          outputIndexToToolIndex.set(outputIdx, tcIndex)
          emit(controller, {
            id: responseId,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: tcIndex,
                      id: (item.call_id as string) ?? (item.id as string),
                      function: {
                        name: item.name as string,
                        arguments: '',
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          })
        }
        break
      }

      case 'response.function_call_arguments.delta': {
        const outputIdx = (data.output_index as number) ?? 0
        const tcIdx = outputIndexToToolIndex.get(outputIdx) ?? 0
        emit(controller, {
          id: responseId,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: tcIdx,
                    function: { arguments: data.delta as string },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        })
        break
      }

      case 'response.completed':
      case 'response.done': {
        const resp = data.response as JSONObject | undefined
        const usage = resp?.usage as JSONObject | undefined
        const status = resp?.status as string | undefined

        let finishReason = 'stop'
        if (status === 'incomplete') {
          finishReason = 'length'
        } else if (nextToolCallIndex > 0) {
          finishReason = 'tool_calls'
        }

        const chunk: JSONObject = {
          id: responseId,
          choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
        }

        if (usage) {
          const outputDetails = usage.output_tokens_details as
            JSONObject | undefined
          chunk.usage = {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens: usage.total_tokens,
            ...(outputDetails?.reasoning_tokens != null && {
              completion_tokens_details: {
                reasoning_tokens: outputDetails.reasoning_tokens,
              },
            }),
          }
        }

        emit(controller, chunk)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        break
      }

      case 'response.failed': {
        const resp = data.response as JSONObject | undefined
        const errorObj = (resp?.error ?? data.error) as JSONObject | undefined
        emit(controller, {
          error: {
            message:
              (errorObj?.message as string) ?? 'ChatGPT backend request failed',
            type: (errorObj?.type as string) ?? 'server_error',
          },
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        break
      }

      case 'error': {
        const errorObj = (data.error ?? data) as JSONObject
        emit(controller, {
          error: {
            message:
              (errorObj.message as string) ??
              'Unknown error from ChatGPT backend',
            type: (errorObj.type as string) ?? 'server_error',
          },
        })
        break
      }

      // Skip all other events silently (content_part.added, output_text.done, etc.)
    }
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue

        const jsonStr = line.slice(6).trim()
        if (!jsonStr || jsonStr === '[DONE]') {
          continue
        }

        try {
          const parsed = JSON.parse(jsonStr) as JSONObject
          processEvent(controller, parsed)
        } catch {
          // Skip unparseable lines
        }
      }
    },

    flush(controller) {
      if (buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6).trim()
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(jsonStr) as JSONObject
            processEvent(controller, parsed)
          } catch {
            // skip
          }
        }
      }
    },
  })
}

function transformResponseStream(
  inputStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const transform = createSseTransformStream()
  inputStream.pipeTo(transform.writable).catch(() => {})
  return transform.readable
}

// ============================================================================
// Custom Fetch
// ============================================================================

export function createChatGptBackendFetch(): FetchFunction {
  const fetchFn: FetchLike = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    let transformedInit = init

    if (init?.body && typeof init.body === 'string') {
      try {
        const body = parseChatCompletionsBody(init.body)
        const transformedBody = transformRequestBody(body)
        transformedInit = { ...init, body: JSON.stringify(transformedBody) }
      } catch {
        // If body can't be parsed, pass through unchanged
      }
    }

    const response = await globalThis.fetch(input, transformedInit)

    if (!response.ok) {
      // Map 404 usage-limit errors to 429 (same as opencode plugin)
      if (response.status === 404) {
        try {
          const text = await response.clone().text()
          if (/usage_limit|rate_limit/i.test(text)) {
            return new Response(text, {
              status: 429,
              statusText: 'Too Many Requests',
              headers: response.headers,
            })
          }
        } catch {
          // Fall through to return original response
        }
      }
      return response
    }

    if (!response.body) return response

    const transformedStream = transformResponseStream(response.body)

    return new Response(transformedStream, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers({
        'content-type': 'text/event-stream; charset=utf-8',
      }),
    })
  }

  return fetchFn as FetchFunction
}
