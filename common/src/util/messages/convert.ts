import { cloneDeep } from 'lodash'

import type { SavantModelMessage } from './types'
import type { JSONValue } from '../../types/json'
import type {
  TextPart,
  ToolResultOutput,
} from '../../types/messages/content-part'
import type {
  AssistantMessage,
  Message,
  ToolMessage,
  UserMessage,
} from '../../types/messages/savant-code-message'
import type { ToolModelMessage } from 'ai'

function textPartFromString(text: string): TextPart {
  return { type: 'text', text }
}

function assistantToSavantCodeMessage(
  message: Omit<AssistantMessage, 'content'> & {
    content: Exclude<AssistantMessage['content'], string>[number]
  },
): AssistantMessage {
  // if (message.content.type === 'tool-call') {
  //   return cloneDeep({
  //     ...message,
  //     content: [
  //       {
  //         type: 'text',
  //         text: getToolCallString(
  //           message.content.toolName,
  //           message.content.input,
  //           false,
  //         ),
  //       },
  //     ],
  //   })
  // }
  return cloneDeep({ ...message, content: [message.content] })
}

export function convertToolResultMessage(
  message: ToolMessage,
): SavantModelMessage[] {
  // Defensive: some compaction paths historically wrote a bare string here.
  // Coerce any non-array content into a json tool result so downstream code
  // can safely call .map() and the AI SDK receives a valid tool-result shape.
  if (!Array.isArray(message.content)) {
    message = {
      ...message,
      content: [
        {
          type: 'json',
          value: message.content as JSONValue,
        } as ToolResultOutput,
      ],
    }
  }

  if (message.content.length === 0) {
    return [
      cloneDeep<ToolModelMessage>({
        ...message,
        role: 'tool',
        content: [
          {
            ...message,
            output: { type: 'json', value: '' },
            type: 'tool-result',
          },
        ],
      }),
    ]
  }
  return message.content.map((c) => {
    if (c.type === 'json') {
      // FID-2026-0820-013: in-memory tool results may carry undefined fields
      // (optional result fields like cwd/timeout, batch wrappers), which fail
      // the AI SDK's JSONValue schema and crash subagent spawn conversion.
      // Sanitize to strict JSON — the same shape the persisted-history path
      // already produces via session serialization. The persisted path never
      // saw this because JSON serialization drops undefined on write.
      const sanitized = JSON.parse(
        JSON.stringify(c.value ?? null),
      ) as typeof c.value
      return cloneDeep<ToolModelMessage>({
        ...message,
        role: 'tool',
        content: [
          {
            ...message,
            output: { type: 'json', value: sanitized },
            type: 'tool-result',
          },
        ],
      })
    }
    if (c.type === 'media') {
      return cloneDeep<UserMessage>({
        ...message,
        role: 'user',
        content: [{ type: 'file', data: c.data, mediaType: c.mediaType }],
      })
    }
    c satisfies never
    throw new Error(`Invalid tool output type: ${JSON.stringify(c)}`)
  })
}

export function convertToolMessage(message: Message): SavantModelMessage[] {
  if (message.role === 'system') {
    // Defensive: older serialized state may store system content as a plain
    // string instead of TextPart[]. Treat any non-array as the literal text.
    const rawContent = message.content
    let textContent: string
    if (typeof rawContent === 'string') {
      textContent = rawContent
    } else if (Array.isArray(rawContent)) {
      textContent = rawContent
        .map((c) => (c && 'text' in c ? c.text : ''))
        .join('\n\n')
    } else {
      textContent = ''
    }
    return [
      {
        ...message,
        content: textContent,
      },
    ]
  }
  if (message.role === 'user') {
    // Defensive: older serialized state may store user content as a plain
    // string. Wrap it as a TextPart[] so downstream code always sees an array.
    const rawContent = message.content
    if (typeof rawContent === 'string') {
      return [
        cloneDeep({
          ...message,
          content: [textPartFromString(rawContent)],
        }),
      ]
    }
    if (!Array.isArray(rawContent)) {
      return [
        cloneDeep({
          ...message,
          content: [],
        }),
      ]
    }
    return [cloneDeep(message)]
  }
  if (message.role === 'assistant') {
    // Defensive: older serialized state may store assistant content as a plain
    // string (or invalid value). Wrap it as a TextPart[] before iterating.
    const rawContent = message.content
    if (typeof rawContent === 'string') {
      return [
        cloneDeep({
          ...message,
          content: [textPartFromString(rawContent)],
        }),
      ]
    }
    if (!Array.isArray(rawContent)) {
      return [
        cloneDeep({
          ...message,
          content: [textPartFromString('')],
        }),
      ]
    }
    return rawContent.map((c) => {
      return assistantToSavantCodeMessage({
        ...message,
        content: c,
      })
    })
  }
  if (message.role === 'tool') {
    return convertToolResultMessage(message)
  }
  message satisfies never
  throw new Error(
    `Invalid message role: ${(message as { role: unknown }).role}`,
  )
}

export function convertToolMessages(messages: Message[]): SavantModelMessage[] {
  const withoutToolMessages: SavantModelMessage[] = []
  for (const message of messages) {
    withoutToolMessages.push(...convertToolMessage(message))
  }
  return withoutToolMessages
}
