/**
 * Pure helper functions for the context-pruner handleSteps generator
 * (extracted verbatim from the original in-body implementation).
 * Embedded into the generated self-contained source via .toString() at
 * factory time — Bun transpiles on import, so the serialized form is plain JS.
 */
import type { JSONValue, Message, TextPart } from '../types/util-types'

/**
 * Truncates long text with 80% from the beginning and 20% from the end.
 */
export function truncateLongText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text
  }
  const availableChars = limit - 50 // 50 chars for the truncation notice
  const prefixLength = Math.floor(availableChars * 0.8)
  const suffixLength = availableChars - prefixLength
  const prefix = text.slice(0, prefixLength)
  const suffix = text.slice(-suffixLength)
  const truncatedChars = text.length - prefixLength - suffixLength
  return `${prefix}\n\n[...truncated ${truncatedChars} chars...]\n\n${suffix}`
}

/**
 * Extracts text content from a message.
 */
export function getTextContent(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter(
        (part): part is TextPart =>
          part.type === 'text' && typeof part.text === 'string',
      )
      .map((part) => part.text)
      .join('\n')
  }
  return ''
}

export function asString(value: JSONValue): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function asNumber(value: JSONValue): number | null {
  return typeof value === 'number' ? value : null
}

export function asStringArray(value: JSONValue): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const result: string[] = []
  for (const item of value) {
    if (typeof item === 'string') result.push(item)
  }
  return result.length > 0 ? result : undefined
}

export function asObject(
  value: JSONValue,
): Record<string, JSONValue> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined
}

export function asAgentSpawnArray(value: JSONValue):
  | Array<{
      agent_type: string
      prompt?: string
      params?: Record<string, JSONValue>
    }>
  | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{
    agent_type: string
    prompt?: string
    params?: Record<string, JSONValue>
  }> = []
  for (const item of value) {
    const obj = asObject(item)
    if (!obj) continue
    const agent_type = asString(obj.agent_type)
    if (!agent_type) continue
    const prompt = asString(obj.prompt)
    const params = asObject(obj.params)
    result.push({
      agent_type,
      ...(prompt && { prompt }),
      ...(params && { params }),
    })
  }
  return result.length > 0 ? result : undefined
}

export function asTodoList(
  value: JSONValue,
): Array<{ task: string; completed: boolean }> | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{ task: string; completed: boolean }> = []
  for (const item of value) {
    const obj = asObject(item)
    if (!obj) continue
    const task = asString(obj.task)
    if (task === undefined) continue
    result.push({ task, completed: obj.completed === true })
  }
  return result.length > 0 ? result : undefined
}

export function asQuestionList(
  value: JSONValue,
): Array<{ question: string }> | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{ question: string }> = []
  for (const item of value) {
    const obj = asObject(item)
    if (!obj) continue
    const question = asString(obj.question)
    if (question === undefined) continue
    result.push({ question })
  }
  return result.length > 0 ? result : undefined
}

export function asAnswerList(value: JSONValue):
  | Array<{
      selectedOption?: string
      selectedOptions?: string[]
      otherText?: string
    }>
  | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{
    selectedOption?: string
    selectedOptions?: string[]
    otherText?: string
  }> = []
  for (const item of value) {
    const obj = asObject(item)
    if (!obj) continue
    const selectedOption = asString(obj.selectedOption)
    const selectedOptions = asStringArray(obj.selectedOptions)
    const otherText = asString(obj.otherText)
    result.push({
      ...(selectedOption && { selectedOption }),
      ...(selectedOptions && { selectedOptions }),
      ...(otherText && { otherText }),
    })
  }
  return result.length > 0 ? result : undefined
}

export function asAgentResultList(value: JSONValue):
  | Array<{
      agentName?: string
      agentType?: string
      value?: { type?: string; value?: JSONValue }
    }>
  | undefined {
  if (!Array.isArray(value)) return undefined
  const result: Array<{
    agentName?: string
    agentType?: string
    value?: { type?: string; value?: JSONValue }
  }> = []
  for (const item of value) {
    const obj = asObject(item)
    if (!obj) continue
    const agentName = asString(obj.agentName)
    const agentType = asString(obj.agentType)
    const valueObj = asObject(obj.value)
    let inner: { type?: string; value?: JSONValue } | undefined
    if (valueObj) {
      const type = asString(valueObj.type)
      const v = valueObj.value
      inner = {
        ...(type && { type }),
        ...(v !== undefined && { value: v }),
      }
    }
    const entry: {
      agentName?: string
      agentType?: string
      value?: { type?: string; value?: JSONValue }
    } = {}
    if (agentName) entry.agentName = agentName
    if (agentType) entry.agentType = agentType
    if (inner) entry.value = inner
    result.push(entry)
  }
  return result
}
