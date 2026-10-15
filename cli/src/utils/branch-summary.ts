/**
 * FID-2026-1006-003 WP6: the branch-summarization consumer.
 *
 * FID-2026-1006-002 shipped the branch-summary format contract with no
 * caller, so a chat switch (/new, resuming from /history) that aborted a
 * mid-turn run left nothing behind: the abandoned turn vanished from the
 * transcript and left no durable record of what it was doing.
 * `abandonActiveRun` is the chat-switch seam that consumes it — it aborts the
 * run, then emits a branch summary into the transcript and persists it as a
 * `custom` entry on the chat it left.
 *
 * Every step is fail-open: a chat switch must never fail because the summary
 * could not be rendered, appended, or persisted.
 */
import { randomUUID } from 'node:crypto'
import path from 'path'

import { formatBranchSummary } from '@savant-code/agent-runtime/context-compactor/branch-summarization'
import {
  createCustomEntry,
  getSessionsByChatId,
} from '@savant-code/database/service'

import { abortActiveRun } from './active-run'
import { logger } from './logger'
import { useChatStore } from '../state/chat-store'
import { resolveCurrentChatDir } from './run-state-storage/state'

import type { ChatMessage, TextContentBlock } from '../types/chat'
import type { BranchSummaryInput } from '@savant-code/agent-runtime/context-compactor/branch-summarization'
import type { JSONValue } from '@savant-code/common/types/json'

/**
 * Tool input keys that name what the call acted on, in priority order. A
 * `read_files` call carries `paths`, an edit carries `path`, a terminal call
 * carries `command`.
 */
const TOOL_TARGET_KEYS = ['path', 'paths', 'command', 'pattern'] as const

function toolTarget(input: Record<string, JSONValue>): string | undefined {
  for (const key of TOOL_TARGET_KEYS) {
    const value = input[key]
    if (typeof value === 'string' && value.trim().length > 0) return value
    if (Array.isArray(value)) {
      const first = value.find(
        (item): item is string => typeof item === 'string',
      )
      if (first !== undefined) return first
    }
  }
  return undefined
}

/**
 * Tool activity taken verbatim from the transcript: `done` = calls that have
 * a result, `inProgress` = calls still awaiting one. Only the tool name and
 * its own target string are emitted, so every path and command in the summary
 * is byte-identical to the call that produced it (the contract this module
 * exists to honour: never paraphrase, round, or rename evidence).
 */
function toolActivityLines(
  messages: ChatMessage[],
  phase: 'done' | 'inProgress',
): string[] {
  const lines: string[] = []
  for (const message of messages) {
    for (const block of message.blocks ?? []) {
      if (block.type !== 'tool') continue
      if ((block.output !== undefined) !== (phase === 'done')) continue
      const target = toolTarget(block.input)
      lines.push(
        target === undefined ? block.toolName : `${block.toolName}: ${target}`,
      )
    }
  }
  return lines
}

function lastUserText(messages: ChatMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.variant !== 'user') continue
    const text = message.content.trim()
    if (text.length > 0) return text
  }
  return undefined
}

/**
 * Render the branch summary for an abandoned conversation. Sections the
 * transcript cannot answer stay empty and render as `_None recorded._` — the
 * skeleton is fixed, and its content is never invented.
 */
export function buildBranchSummary(messages: ChatMessage[]): string {
  const goal = lastUserText(messages)
  const done = toolActivityLines(messages, 'done')
  const inProgress = toolActivityLines(messages, 'inProgress')
  const input: BranchSummaryInput = {
    ...(goal === undefined ? {} : { goal }),
    ...(done.length === 0 ? {} : { done }),
    ...(inProgress.length === 0 ? {} : { inProgress }),
  }
  return formatBranchSummary(input)
}

/** Append the summary to the transcript of the chat being left. */
function appendToTranscript(text: string): void {
  const block: TextContentBlock = { type: 'text', content: text }
  const message: ChatMessage = {
    id: `branch-summary-${randomUUID()}`,
    variant: 'ai',
    content: text,
    blocks: [block],
    timestamp: new Date().toISOString(),
    isComplete: true,
  }
  useChatStore.getState().setMessages((prev) => [...prev, message])
}

/**
 * Durable record: a `custom` entry on the abandoned chat's DB session. A chat
 * that never reached the database has no session to attach to — skip instead
 * of failing the switch.
 */
function persistBranchSummary(chatId: string, text: string): void {
  const sessions = getSessionsByChatId(chatId)
  if (sessions.length === 0) return
  createCustomEntry(sessions[0].id, { kind: 'branch_summary', summary: text })
}

function defaultResolveChatId(): string {
  return path.basename(resolveCurrentChatDir())
}

function reportFailure(step: string, error: unknown): void {
  logger.warn(
    {
      step,
      error: error instanceof Error ? error.message : String(error),
    },
    'branch summary: abandoned-run summary failed (chat switch continues)',
  )
}

export type BranchSummaryDeps = {
  /** Transcript append; defaults to the live chat store. */
  append?: (text: string) => void
  /** Durable write; defaults to the abandoned chat's DB session entry. */
  persist?: (chatId: string, text: string) => void
  /** Read the abandoned conversation; defaults to the live chat store. */
  loadMessages?: () => ChatMessage[]
  /** Resolve the abandoned chat's id; defaults to its chat directory name. */
  resolveChatId?: () => string
}

/**
 * FID-2026-1006-003 WP6: abort the in-flight run and leave a branch summary
 * behind. Returns true when a run was actually aborted. Fail-open by
 * construction — the render/append step and the persist step fail
 * independently, so one failure can never suppress the other.
 */
export function abandonActiveRun(deps: BranchSummaryDeps = {}): boolean {
  if (!abortActiveRun()) return false
  const loadMessages =
    deps.loadMessages ?? (() => useChatStore.getState().messages)
  const append = deps.append ?? appendToTranscript
  const persist = deps.persist ?? persistBranchSummary
  let text = ''
  try {
    text = buildBranchSummary(loadMessages())
    append(text)
  } catch (error) {
    reportFailure('render', error)
    return true
  }
  try {
    persist((deps.resolveChatId ?? defaultResolveChatId)(), text)
  } catch (error) {
    reportFailure('persist', error)
  }
  return true
}
