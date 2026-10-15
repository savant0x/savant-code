import { buildArray } from '@savant-code/common/util/array'
import { getErrorObject } from '@savant-code/common/util/error'

import type { SavantCodeToolMessage } from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Message-history filters and extractors: expiration, unfinished tool-call
 * cleanup, and file-referencing tool outputs.
 * (FID-2026-0809-016: extracted from `util/messages.ts`.)
 */

export function expireMessages(
  messages: Message[],
  endOf: 'agentStep' | 'userPrompt',
): Message[] {
  // FID-2026-0815-004 (F-03): fast-path — scan once for a would-expire
  // message; if none, return the input array unchanged (no allocation).
  // Semantics are identical to the filter below (same kept elements, same
  // order); callers reassign `messageHistory` and append via spread copies,
  // so aliasing the input array is safe.
  let wouldExpire = false
  for (const m of messages) {
    if (m.timeToLive === 'agentStep') {
      wouldExpire = true
      break
    }
    if (m.timeToLive === 'userPrompt' && endOf === 'userPrompt') {
      wouldExpire = true
      break
    }
  }
  if (!wouldExpire) {
    return messages
  }

  return messages.filter((m) => {
    // Keep messages with no timeToLive
    if (m.timeToLive === undefined) return true

    // Remove messages that have expired
    if (m.timeToLive === 'agentStep') return false
    if (m.timeToLive === 'userPrompt' && endOf === 'userPrompt') return false

    return true
  })
}

/**
 * Removes tool calls from the message history that don't have corresponding tool responses.
 * This is important when passing message history to spawned agents, as unfinished tool calls
 * will cause issues with the LLM expecting tool responses.
 *
 * The function:
 * 1. Collects all toolCallIds from tool response messages
 * 2. Filters assistant messages to remove tool-call content parts without responses
 * 3. Removes assistant messages that become empty after filtering
 */
export function filterUnfinishedToolCalls(messages: Message[]): Message[] {
  // Collect all toolCallIds that have corresponding tool responses
  const respondedToolCallIds = new Set<string>()
  for (const message of messages) {
    if (message.role === 'tool') {
      respondedToolCallIds.add(message.toolCallId)
    }
  }

  // Filter messages, removing unfinished tool calls from assistant messages
  const filteredMessages: Message[] = []
  for (const message of messages) {
    if (message.role !== 'assistant') {
      filteredMessages.push(message)
      continue
    }

    // Filter out tool-call content parts that don't have responses
    const filteredContent = message.content.filter((part) => {
      if (part.type !== 'tool-call') {
        return true
      }
      return respondedToolCallIds.has(part.toolCallId)
    })

    // Only include the assistant message if it has content after filtering
    if (filteredContent.length > 0) {
      filteredMessages.push({
        ...message,
        content: filteredContent,
      })
    }
  }

  return filteredMessages
}

export function getEditedFiles(params: {
  messages: Message[]
  logger: Logger
}): string[] {
  const { messages, logger } = params
  return buildArray(
    messages
      .filter(
        (
          m,
        ): m is SavantCodeToolMessage<
          'create_plan' | 'str_replace' | 'write_file'
        > => {
          return (
            m.role === 'tool' &&
            (m.toolName === 'create_plan' ||
              m.toolName === 'str_replace' ||
              m.toolName === 'write_file')
          )
        },
      )
      .map((m) => {
        try {
          const fileInfo = m.content[0].value
          if ('errorMessage' in fileInfo) {
            return null
          }
          return fileInfo.file
        } catch (error) {
          logger.error(
            { error: getErrorObject(error), m },
            'Error parsing file info',
          )
          return null
        }
      }),
  )
}

export function getPreviouslyReadFiles(params: {
  messages: Message[]
  logger: Logger
}): {
  path: string
  content: string
  referencedBy?: Record<string, string[]>
}[] {
  const { messages, logger } = params
  const files: ReturnType<typeof getPreviouslyReadFiles> = []
  for (const message of messages) {
    if (message.role !== 'tool') continue
    if (message.toolName === 'read_files') {
      try {
        files.push(
          ...(
            message as SavantCodeToolMessage<'read_files'>
          ).content[0].value.filter(
            (
              file,
            ): file is typeof file & { contentOmittedForLength: undefined } =>
              !('contentOmittedForLength' in file),
          ),
        )
      } catch (error) {
        logger.error(
          { error: getErrorObject(error), message },
          'Error parsing read_files output from message',
        )
      }
    }

    if (message.toolName === 'find_files') {
      try {
        const v = (message as SavantCodeToolMessage<'find_files'>).content[0]
          .value
        if ('message' in v) {
          continue
        }
        files.push(
          ...v.filter(
            (
              file,
            ): file is typeof file & { contentOmittedForLength: undefined } =>
              !('contentOmittedForLength' in file),
          ),
        )
      } catch (error) {
        logger.error(
          { error: getErrorObject(error), message },
          'Error parsing find_files output from message',
        )
      }
    }
  }
  return files
}
