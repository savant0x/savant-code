import { buildArray } from '@savant-code/common/util/array'
import { systemMessage, userMessage } from '@savant-code/common/util/messages'
import { closeXml } from '@savant-code/common/util/xml'

import type { System } from '../../llm-api/claude'
import type { JSONValue } from '@savant-code/common/types/json'
import type {
  TextPart,
  ImagePart,
} from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * XML framing helpers for user/assistant message construction
 * (FID-2026-0809-016: extracted from `util/messages.ts`).
 */

export function messagesWithSystem(params: {
  messages: Message[]
  system: System
}): Message[] {
  const { messages, system } = params
  return [systemMessage(system), ...messages]
}

export function asUserMessage(str: string): string {
  return `<user_message>${str}${closeXml('user_message')}`
}

/**
 * Combines prompt, params, and content into a unified message content structure.
 * Always wraps the first text part in <user_message> tags for consistent XML framing.
 * If you need a specific text part wrapped, put it first or pre-wrap it yourself before calling.
 */
export function buildUserMessageContent(
  prompt: string | undefined,
  params: Record<string, JSONValue> | undefined,
  content?: Array<TextPart | ImagePart>,
): Array<TextPart | ImagePart> {
  const promptHasNonWhitespaceText = (prompt ?? '').trim().length > 0

  // If we have content array (e.g., text + images)
  if (content && content.length > 0) {
    // Check if content has a non-empty text part
    const firstTextPart = content.find((p): p is TextPart => p.type === 'text')
    const hasNonEmptyText = firstTextPart && firstTextPart.text.trim()

    // If content has no meaningful text but prompt is provided, prepend prompt
    if (!hasNonEmptyText && promptHasNonWhitespaceText) {
      const nonTextContent = content.filter((p) => p.type !== 'text')
      return [
        { type: 'text' as const, text: asUserMessage(prompt!) },
        ...nonTextContent,
      ]
    }

    // Find the first text part and wrap it in <user_message> tags
    let hasWrappedText = false
    const wrappedContent = content.map((part) => {
      if (part.type === 'text' && !hasWrappedText) {
        hasWrappedText = true
        // Check if already wrapped
        const alreadyWrapped = parseUserMessage(part.text) !== undefined
        if (alreadyWrapped) {
          return part
        }
        return {
          type: 'text' as const,
          text: asUserMessage(part.text),
        }
      }
      return part
    })
    return wrappedContent
  }

  // Only prompt/params, combine and return as simple text
  const textParts = buildArray([
    promptHasNonWhitespaceText ? prompt : undefined,
    params && JSON.stringify(params, null, 2),
  ])
  return [
    {
      type: 'text',
      text: asUserMessage(textParts.join('\n\n')),
    },
  ]
}

export function parseUserMessage(str: string): string | undefined {
  const match = str.match(/<user_message>(.*?)<\/user_message>/s)
  return match ? match[1] : undefined
}

export function withSystemInstructionTags(str: string): string {
  return `<system_instructions>${str}${closeXml('system_instructions')}`
}

export function withSystemTags(str: string): string {
  return `<system>${str}${closeXml('system')}`
}

export function castAssistantMessage(message: Message): Message | null {
  if (message.role !== 'assistant') {
    return message
  }
  if (typeof message.content === 'string') {
    return userMessage(
      `<previous_assistant_message>${message.content}${closeXml('previous_assistant_message')}`,
    )
  }
  const content = buildArray(
    message.content.map((m) => {
      if (m.type === 'text') {
        return {
          ...m,
          text: `<previous_assistant_message>${m.text}${closeXml('previous_assistant_message')}`,
        }
      }
      return null
    }),
  )
  return content
    ? {
        role: 'user' as const,
        content,
      }
    : null
}
