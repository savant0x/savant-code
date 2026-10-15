import type {
  ChatCompletionsBody,
  ChatCompletionsMessage,
  ChatCompletionsTool,
} from './types'
import type { JSONObject, JSONValue } from '@savant-code/common/types/json'

export function parseChatCompletionsBody(raw: string): ChatCompletionsBody {
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

export function transformRequestBody(body: ChatCompletionsBody): JSONObject {
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
