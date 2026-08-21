import { modelMessageSchema } from 'ai'
import { isEqual } from 'lodash'

import { withCacheControl } from './cache-control'
import { convertToolMessages } from './convert'
import { toWellFormedString, wellFormStringsInPlace } from './well-formed'

import type { SavantModelMessage } from './types'
import type { Logger } from '../../types/contracts/logger'
import type { Message } from '../../types/messages/savant-code-message'

export function convertCbToModelMessages({
  messages,
  includeCacheControl = true,
  logger,
}: {
  messages: Message[]
  includeCacheControl?: boolean
  logger?: Logger
}): SavantModelMessage[] {
  const toolMessagesConverted: SavantModelMessage[] =
    convertToolMessages(messages)

  const aggregated: SavantModelMessage[] = []
  for (const message of toolMessagesConverted) {
    if (aggregated.length === 0) {
      aggregated.push(message)
      continue
    }

    const lastMessage = aggregated[aggregated.length - 1]
    if (
      lastMessage.timeToLive !== message.timeToLive ||
      !isEqual(lastMessage.providerOptions, message.providerOptions) ||
      !isEqual(lastMessage.tags, message.tags)
    ) {
      aggregated.push(message)
      continue
    }
    if (lastMessage.role === 'system' && message.role === 'system') {
      lastMessage.content += '\n\n' + message.content
      continue
    }
    if (lastMessage.role === 'user' && message.role === 'user') {
      lastMessage.content.push(...message.content)
      continue
    }
    if (lastMessage.role === 'assistant' && message.role === 'assistant') {
      lastMessage.content.push(...message.content)
      continue
    }

    aggregated.push(message)
  }

  // Neutralize any lone UTF-16 surrogates before the messages reach the provider.
  // These are mutated in place; every aggregated message is a fresh clone (see
  // convertToolMessage), so the caller's message history is unaffected.
  for (const message of aggregated) {
    if (typeof message.content === 'string') {
      message.content = toWellFormedString(message.content)
    } else if (message.content && typeof message.content === 'object') {
      wellFormStringsInPlace(message.content)
    }
  }

  // Validate each message against the AI SDK schema (FID-2026-0820-013).
  // This MUST run on BOTH paths: includeCacheControl is per-model
  // (run-agent-step/step.ts supportsCacheControl), and the non-cache-
  // control path previously returned before validation, letting
  // schema-invalid shapes surface only as the AI SDK's opaque
  // AI_InvalidPromptError ("The messages must be a ModelMessage[]") from
  // standardizePrompt — intermittent and correlated with session growth
  // (rare message shapes appear late). Fail fast here instead, with the
  // actionable role/index/zod error below.
  for (let i = 0; i < aggregated.length; i++) {
    const message = aggregated[i]
    const result = modelMessageSchema.safeParse(message)
    if (!result.success) {
      if (logger) {
        logger.error(
          { message, aggregated, error: result.error },
          `convertCbToModelMessages: Message at index ${i} failed schema validation.`,
        )
      }
      throw new Error(
        `convertCbToModelMessages: Message at index ${i} failed schema validation.\n` +
          `Role: ${message.role}\n` +
          `Message:\n${result.error.message}`,
      )
    }
  }

  if (!includeCacheControl) {
    return aggregated
  }

  // Add cache control to specific messages (max of 4 can be marked for caching!):
  // - The message right before the three tagged messages
  // - Last message
  for (const tag of [
    'LAST_ASSISTANT_MESSAGE',
    'USER_PROMPT',
    'STEP_PROMPT',
    undefined, // Last message
  ] as const) {
    let index =
      tag === 'LAST_ASSISTANT_MESSAGE'
        ? aggregated.findLastIndex((m) => m.role === 'assistant')
        : tag
          ? aggregated.findLastIndex((m) => m.tags?.includes(tag))
          : aggregated.length
    if (index <= 0) {
      continue
    }

    // Iterate to find the last "valid" message that we can cache control
    let prevMessage: (typeof aggregated)[number]
    let contentBlock: (typeof prevMessage)['content']
    addCacheControlLoop: while (true) {
      index--

      // No message found
      if (index < 0) {
        break
      }

      prevMessage = aggregated[index]
      contentBlock = prevMessage.content

      if (typeof contentBlock === 'string') {
        // This must be a system message
        aggregated[index] = withCacheControl(aggregated[index])
        break
      }

      // Iterate to find the last valid content part (not a very short string)
      let lastContentIndex = contentBlock.length
      let lastContentPart: (typeof contentBlock)[number]
      while (true) {
        lastContentIndex--
        lastContentPart = contentBlock[lastContentIndex]

        if (lastContentIndex < 0) {
          // Continue searching in next message
          break
        }

        if (lastContentPart.type !== 'text') {
          contentBlock[lastContentIndex] = withCacheControl(
            contentBlock[lastContentIndex],
          )
          break addCacheControlLoop
        }

        prevMessage.content = [
          ...contentBlock.slice(0, lastContentIndex),
          withCacheControl(lastContentPart),
          ...contentBlock.slice(lastContentIndex + 1),
        ] as typeof contentBlock

        break addCacheControlLoop
      }
      break
    }
  }

  return aggregated
}
