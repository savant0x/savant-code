import { AssertionError } from 'assert'

import {
  clearCacheControlInPlace,
  userMessage,
} from '@savant-code/common/util/messages'
import { cloneDeep, isEqual } from 'lodash'

import {
  appendCompactionInventory,
  describeRemovedToolItem,
  diffRemovedSpans,
} from '../../evidence/inventory'
import {
  simplifyTerminalCommandResults,
  simplifyVerboseToolResults,
  VERBOSE_TOOL_NAMES,
} from '../simplify-tool-results'
import { countTokensMessages } from '../token-counter'
import { withSystemTags } from './framing'

import type { InventoryContext } from '../../evidence/inventory'
import type {
  SavantCodeToolMessage,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'


/**
 * Token-budget trimming: simplify verbose tool outputs and trim old messages
 * to fit within the model context window.
 * (FID-2026-0809-016: extracted from `util/messages.ts`.)
 */

// Number of terminal command outputs to keep in full form before simplifying
const numTerminalCommandsToKeep = 5

function simplifyTerminalHelper(params: {
  toolResult: SavantCodeToolOutput<'run_terminal_command'>
  numKept: number
  logger: Logger
  toolCallId?: string
}): { result: SavantCodeToolOutput<'run_terminal_command'>; numKept: number } {
  const { toolResult, numKept, logger, toolCallId } = params
  const simplified = simplifyTerminalCommandResults({
    messageContent: toolResult,
    logger,
    toolCallId,
  })

  // Keep the full output for the N most recent commands
  if (numKept < numTerminalCommandsToKeep && !isEqual(simplified, toolResult)) {
    return { result: toolResult, numKept: numKept + 1 }
  }

  return {
    result: simplified,
    numKept,
  }
}

// Factor to reduce token count target by, to leave room for new messages
const shortenedMessageTokenFactor = 0.5
const replacementMessage = userMessage(
  withSystemTags('Previous message(s) omitted due to length'),
)

/**
 * Trims messages from the beginning to fit within token limits while preserving
 * important content. Also simplifies terminal command outputs to save tokens.
 *
 * The function:
 * 1. Processes messages from newest to oldest
 * 2. Simplifies terminal command outputs after keeping N most recent ones
 * 3. Stops adding messages when approaching token limit
 *
 * FID-2026-1007-004 step 4: this pass deletes whole messages — tool results and
 * conversation turns alike — and was the only destructive path that wrote no
 * row anywhere about what it took. Given `inventory`, it now writes the same
 * `appendCompactionInventory` row the compaction layers write, with
 * `layer: 'trim'`, the removed positions and the removed tool-result identity.
 *
 * @param messages - Array of messages to trim
 * @param systemTokens - Number of tokens used by system prompt
 * @param maxTotalTokens - Maximum total tokens allowed, defaults to 200k
 * @param inventory - Where the ledger row goes (omitted ⇒ no ledger, as before)
 * @returns Trimmed array of messages that fits within token limit
 */
export function trimMessagesToFitTokenLimit(params: {
  messages: Message[]
  systemTokens: number
  maxTotalTokens?: number
  logger: Logger
  inventory?: InventoryContext
}): Message[] {
  const { messages, systemTokens, maxTotalTokens = 190_000, logger } = params
  const maxMessageTokens = maxTotalTokens - systemTokens

  // Check if we're already under the limit
  const initialTokens = countTokensMessages(messages)

  if (initialTokens < maxMessageTokens) {
    return messages
  }

  const shortenedMessages: Message[] = []
  let numKept = 0

  // Process messages from newest to oldest
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'system' || m.role === 'user' || m.role === 'assistant') {
      shortenedMessages.push(m)
    } else if (m.role === 'tool') {
      // P2c (FID-2026-0806-003): cheap deterministic pre-pass for the verbose
      // tool set (grep/glob/search/URL/db results) — truncate before any
      // budget walk so oversized payloads never crowd out real history.
      if (VERBOSE_TOOL_NAMES.has(m.toolName)) {
        shortenedMessages.push({
          ...m,
          content: simplifyVerboseToolResults({
            messageContent: m.content as ToolResultOutput[],
            toolCallId: m.toolCallId,
          }),
        })
        continue
      }
      if (m.toolName !== 'run_terminal_command') {
        shortenedMessages.push(m)
        continue
      }

      const terminalResultMessage = cloneDeep(
        m,
      ) as SavantCodeToolMessage<'run_terminal_command'>

      const result = simplifyTerminalHelper({
        toolResult: terminalResultMessage.content,
        numKept,
        logger,
        toolCallId: m.toolCallId,
      })
      terminalResultMessage.content = result.result
      numKept = result.numKept

      shortenedMessages.push(terminalResultMessage)
    } else {
      m satisfies never
      throw new AssertionError({
        message: `Not a valid role: ${(m as { role: unknown }).role}`,
      })
    }
  }
  shortenedMessages.reverse()

  const requiredTokens = countTokensMessages(
    shortenedMessages.filter((m) => m.keepDuringTruncation),
  )
  let removedTokens = 0
  const tokensToRemove =
    (maxMessageTokens - requiredTokens) * (1 - shortenedMessageTokenFactor)

  const placeholder = 'deleted'
  const filteredMessages: (Message | typeof placeholder)[] = []
  // Which messages this pass actually deletes, by identity — the ledger below
  // names exactly these and nothing else.
  const removed = new Set<Message>()
  for (const message of shortenedMessages) {
    if (removedTokens >= tokensToRemove || message.keepDuringTruncation) {
      filteredMessages.push(message)
      continue
    }
    removedTokens += countTokensMessages([message])
    removed.add(message)
    if (
      filteredMessages.length === 0 ||
      filteredMessages[filteredMessages.length - 1] !== placeholder
    ) {
      filteredMessages.push(placeholder)
      removedTokens -= countTokensMessages([replacementMessage])
    }
  }

  const result = filteredMessages.map((m) =>
    m === placeholder ? replacementMessage : m,
  )

  if (params.inventory) {
    ledgerTrimPass({
      // `shortenedMessages` is index-aligned with the caller's array: the pass
      // above maps one input message to exactly one entry, so a region here is
      // a region of the history the caller handed in.
      prev: shortenedMessages,
      next: shortenedMessages.filter((message) => !removed.has(message)),
      inventory: params.inventory,
      tokensSaved: initialTokens - countTokensMessages(result),
    })
  }

  return result
}

/**
 * FID-2026-1007-004 step 4 — the trim pass's ledger write.
 *
 * The row is the one the compaction layers already write (`diffRemovedSpans` +
 * `describeRemovedToolItem` + the bounded `items` cap), keyed to the same
 * `.savant/evidence/<runId>.inventory.jsonl` file, so an audit can ask "what did
 * this run take?" once instead of once per layer. Fire-and-forget on purpose:
 * the write is observable on disk and nothing on the find-files request path
 * waits on it, which is also how the other three callers behave. Fail-open, like
 * the store it reports to.
 */
function ledgerTrimPass(params: {
  prev: readonly Message[]
  next: readonly Message[]
  inventory: InventoryContext
  tokensSaved: number
}): void {
  const { regions, items } = diffRemovedSpans({
    prev: params.prev,
    next: params.next,
    describeItem: describeRemovedToolItem,
  })
  const removedMessages = regions.reduce(
    (total, region) => total + (region.end - region.start),
    0,
  )
  if (removedMessages === 0) return

  void appendCompactionInventory({
    projectRoot: params.inventory.projectRoot,
    runId: params.inventory.runId,
    layer: 'trim',
    removedMessages,
    tokensSaved: Math.max(0, params.tokensSaved),
    regions,
    items,
  })
}

export function getMessagesSubset(params: {
  messages: Message[]
  otherTokens: number
  logger: Logger
  inventory?: InventoryContext
}): Message[] {
  const { messages, otherTokens, logger, inventory } = params
  const messagesSubset = trimMessagesToFitTokenLimit({
    messages,
    systemTokens: otherTokens,
    logger,
    inventory,
  })

  // Strip every cache-control breakpoint from the trimmed subset: the subset is
  // a different prefix than the caller's history, so a marker placed against the
  // full history would describe a boundary that no longer exists.
  //
  // FID-2026-1006-005 step 4: this used to delete camelCase `cacheControl` over
  // anthropic|openrouter|savant-code — a spelling nothing in this repository
  // writes, and a set missing `openaiCompatible`, the provider the writer
  // actually tags — so it was dead against the real marker while reading as if
  // it flushed the cache. It now calls the same clearer every other caller uses,
  // over the one spelling and one provider set.
  //
  // The `// Cache up to the last message!` comment that used to sit here
  // promised a re-tag the function never performed. Placement is owned by
  // `convertCbToModelMessages`, which applies its own breakpoints to the
  // messages it emits, so re-tagging here would be a second, drifting truth.
  for (const message of messagesSubset) {
    clearCacheControlInPlace(message)
  }

  if (messagesSubset.length === 0) {
    logger.debug(
      {
        messages,
        messagesSubset,
        otherTokens,
      },
      'No last message found in messagesSubset!',
    )
  }

  return messagesSubset
}
