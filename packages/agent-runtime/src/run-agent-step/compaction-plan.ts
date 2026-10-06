/**
 * FID-2026-1006-003 WP1 + WP2: the compaction inputs computed at the runtime
 * step boundary.
 *
 * The context pruner is serialized via `.toString()` and re-evaluated, so it
 * cannot import runtime modules — its inputs have to reach it as DATA. This
 * module is the producer half of that channel: it plans the compaction cut
 * from the live history and folds each new window's file operations into the
 * running ledger. The savant handleSteps then forwards both as spawn params,
 * the same channel `keepRecentTokens` already uses.
 */
import {
  capFileTracking,
  mergeFileTracking,
} from '../context-compactor/file-tracking'
import {
  findCutPoint,
  findPreviousKeptBoundary,
  segmentTurns,
} from '../context-compactor/cut-points'
import { countTokensMessagesCached } from '../util/token-counter'

import type {
  CompactionCutPlan,
  CompactionFileLedger,
} from '@savant-code/common/types/session-state'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * Pruner tail budget used when the project does not configure
 * `compression.keepRecentTokens`. Mirrors the pruner's own
 * `FIXED_TAIL_BUDGET_TOKENS` default; the configured value always wins.
 */
export const DEFAULT_TAIL_BUDGET_TOKENS = 16_384

const READ_TOOLS = new Set(['read_files', 'read_subtree'])
const CREATE_TOOLS = new Set(['write_file', 'propose_write_file'])
const MODIFY_TOOLS = new Set(['str_replace', 'propose_str_replace'])

type ToolCall = { toolName: string; input: unknown }

function toolCalls(message: Message): ToolCall[] {
  if (!Array.isArray(message.content)) return []
  const calls: ToolCall[] = []
  for (const part of message.content) {
    if (part.type !== 'tool-call' || typeof part.toolName !== 'string') continue
    calls.push({ toolName: part.toolName, input: part.input })
  }
  return calls
}

function pathValues(input: unknown): string[] {
  if (typeof input !== 'object' || input === null) return []
  const record = input as { path?: unknown; paths?: unknown }
  const values: string[] = []
  if (typeof record.path === 'string') values.push(record.path)
  if (Array.isArray(record.paths)) {
    for (const value of record.paths) {
      if (typeof value === 'string') values.push(value)
    }
  }
  return values
}

/**
 * Plan the next compaction cut. The boundary is the run's live turn (kept
 * verbatim), the window opens at the previous kept boundary so
 * already-summarized content is never re-summarized, and a boundary turn that
 * is itself over `tailBudgetTokens` is reported as a split.
 */
export function planCompactionCut(params: {
  messages: Message[]
  tailBudgetTokens: number
}): CompactionCutPlan {
  const { messages, tailBudgetTokens } = params
  const turns = segmentTurns(messages)
  const liveStart = turns.length > 0 ? turns[turns.length - 1].start : 0
  const plan = findCutPoint({
    messages,
    preferredIndex: Math.max(liveStart, 1),
    budgetTokens: tailBudgetTokens,
    // The cached estimator keeps this O(1) per message per step: the count is
    // memoized by message identity, and only the boundary turn is measured.
    estimateTokens: (message) => countTokensMessagesCached([message]),
    windowStart: findPreviousKeptBoundary(messages),
  })
  // Normalized to the JSON shape: `undefined` is not a JSON value, and this
  // plan is carried to the serialized pruner through spawn params.
  return { ...plan, splitTurn: plan.splitTurn ?? null }
}

/**
 * Fold the file operations of `messages[watermark..end)` into the running
 * ledger (newest window first, paths capped so the ledger can never defeat
 * the compaction it rides in on). The watermark makes the fold incremental —
 * a later step boundary re-reads the same history without double-counting it.
 */
export function foldFileOperations(params: {
  ledger?: CompactionFileLedger
  messages: Message[]
  watermark: number
}): { ledger: CompactionFileLedger; watermark: number } {
  const { ledger, messages, watermark } = params
  const window: CompactionFileLedger = {
    readFiles: [],
    modifiedFiles: [],
    createdFiles: [],
  }
  const from = Math.max(0, watermark)
  for (let index = from; index < messages.length; index += 1) {
    for (const call of toolCalls(messages[index])) {
      const paths = pathValues(call.input)
      if (READ_TOOLS.has(call.toolName)) window.readFiles.push(...paths)
      else if (CREATE_TOOLS.has(call.toolName)) {
        window.createdFiles.push(...paths)
      } else if (MODIFY_TOOLS.has(call.toolName)) {
        window.modifiedFiles.push(...paths)
      }
    }
  }
  return {
    ledger: capFileTracking(mergeFileTracking(ledger ?? null, window)),
    watermark: messages.length,
  }
}
