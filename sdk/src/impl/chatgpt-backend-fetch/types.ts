import type { JSONValue } from '@savant-code/common/types/json'

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export interface ChatCompletionsToolCall {
  id: string
  type: string
  function: { name: string; arguments: string }
}

export interface ChatCompletionsMessage {
  role: string
  content?: JSONValue
  tool_calls?: ChatCompletionsToolCall[]
  tool_call_id?: string
}

export interface ChatCompletionsTool {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: JSONValue
    strict?: boolean
  }
}

export interface ChatCompletionsBody {
  model: JSONValue
  messages: ChatCompletionsMessage[]
  tools: ChatCompletionsTool[]
  tool_choice?: JSONValue
  reasoning_effort?: string
}
