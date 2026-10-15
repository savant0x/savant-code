import * as fs from 'fs'
import path from 'path'

import {
  CHAT_MESSAGES_FILENAME,
  readChatMeta,
  writeChatMeta,
} from '../chat-meta'
import { saveChatStateToDb } from '../db-storage'
import { logger } from '../logger'
import { safeStringify } from '../safe-stringify'
import { writeFileAtomic, writeFileAtomicAsync } from '../write-file-atomic'
import {
  getCheckpointDrain,
  getLiveChatStateProvider,
  getPendingCheckpoints,
  resolveCurrentChatDir,
  RUN_STATE_FILENAME,
  setCheckpointDrain,
} from './state'

import type { LiveChatState } from './state'
import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

/**
 * Resolve the completion flag an exit flush should write for a chat dir:
 * preserve an already-complete sidecar (the turn-end save marked it done) and
 * only mark incomplete when the chat genuinely never completed (sidecar says
 * false, is missing, or is stale). Without this, the exit flush downgrades
 * every chat it touches to `completed: false` — /history then shows every
 * finished session as interrupted (FID-2026-0804-008).
 */
function flushCompletionForChatDir(chatDir: string): boolean {
  return readChatMeta(chatDir)?.completed ?? false
}

/**
 * Synchronously persist the in-flight chat state, if any. Safe to call from
 * process exit/signal handlers (saveChatState uses writeFileSync).
 */
export function flushLiveChatState(): void {
  try {
    // The process is exiting, so the async drain will never get to run:
    // write any queued checkpoints synchronously first. Each is bound to the
    // chat dir captured when it was scheduled. The live provider below may
    // overwrite one of these with strictly newer state — that order is
    // intentional.
    for (const [chatDir, state] of getPendingCheckpoints()) {
      saveChatState(
        state.runState,
        state.messages,
        chatDir,
        '',
        flushCompletionForChatDir(chatDir),
      )
    }
    getPendingCheckpoints().clear()

    const provider = getLiveChatStateProvider()
    if (!provider) {
      return
    }
    // The provider reads live store state. Once the user has switched to a
    // different chat (/new, resuming from /history), that state no longer
    // matches the provider's chat directory — flushing would overwrite the
    // run's chat with another conversation's messages. Skip instead; the
    // run's last checkpoint was flushed from the queue above.
    if (provider.chatDir !== resolveCurrentChatDir()) {
      return
    }
    const state = provider.provide()
    if (state) {
      saveChatState(
        state.runState,
        state.messages,
        provider.chatDir,
        '',
        flushCompletionForChatDir(provider.chatDir),
      )
    }
  } catch {
    // Best-effort - never block process exit.
  }
}

/**
 * Save both the RunState and ChatMessage[] to disk.
 *
 * `chatDir` should be captured when the state itself is captured (e.g. at run
 * start) and passed through. Defaulting to the current chat dir is only safe
 * when the caller knows no chat switch can have happened in between.
 */
export function saveChatState(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string = resolveCurrentChatDir(),
  selectedModel: string = '',
  completed: boolean = true,
): void {
  try {
    // Save to database
    const chatId = path.basename(chatDir)
    const agentId = runState.sessionState?.mainAgentState?.agentId || 'unknown'
    saveChatStateToDb(chatId, agentId, runState, messages, selectedModel)

    // Also save to file system for backward compatibility
    const runStatePath = path.join(chatDir, RUN_STATE_FILENAME)
    const messagesPath = path.join(chatDir, CHAT_MESSAGES_FILENAME)

    fs.mkdirSync(chatDir, { recursive: true })
    // FID-2026-0806-012: cyclic-safe serialization — a circular reference in
    // the run state must never throw and lose the whole checkpoint.
    writeFileAtomic(runStatePath, safeStringify(runState))
    writeFileAtomic(messagesPath, safeStringify(messages))
    writeChatMeta(chatDir, messages, completed)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to save chat state',
    )
  }
}

/**
 * Async counterpart to saveChatState. Serializes and writes off the caller's
 * tick so a multi-MB transcript doesn't block the CLI's render/input thread.
 */
export async function saveChatStateAsync(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string,
): Promise<void> {
  try {
    const runStatePath = path.join(chatDir, RUN_STATE_FILENAME)
    const messagesPath = path.join(chatDir, CHAT_MESSAGES_FILENAME)

    await fs.promises.mkdir(chatDir, { recursive: true })
    // FID-2026-0806-012: cyclic-safe serialization — a circular reference in
    // the run state must never throw and lose the whole checkpoint.
    await writeFileAtomicAsync(runStatePath, safeStringify(runState))
    await writeFileAtomicAsync(messagesPath, safeStringify(messages))
    // Sidecar summary so /history can list this chat without parsing the
    // (unbounded) chat-messages.json. Written after the messages file: it
    // records that file's size/mtime to detect staleness. The meta write is
    // tiny, so keeping it synchronous here is fine.
    // Mid-stream checkpoints are explicitly marked incomplete; the final
    // turn-end save overwrites this with completed: true.
    writeChatMeta(chatDir, messages, false)
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to save chat state (async)',
    )
  }
}

async function drainCheckpoints(): Promise<void> {
  const pendingCheckpoints = getPendingCheckpoints()
  while (pendingCheckpoints.size > 0) {
    // Yield first so serialization never runs on the same tick that scheduled
    // us (that tick is often mid-render or handling a keystroke). Entries stay
    // in the map while we yield, so the synchronous exit flush can still write
    // them if the process quits before we resume.
    await new Promise<void>((resolve) => setImmediate(resolve))
    const entry = pendingCheckpoints.entries().next()
    if (entry.done) {
      break
    }
    const [chatDir, state] = entry.value
    pendingCheckpoints.delete(chatDir)
    // Write to the chat dir captured at schedule time: the current chat may
    // have rotated (/new, /history resume) while this write sat in the queue,
    // and resolving the dir here would dump this state into the wrong chat.
    await saveChatStateAsync(state.runState, state.messages, chatDir)
  }
}

/**
 * Schedule an asynchronous, coalescing checkpoint save. Safe to call at a high
 * rate: only one write runs at a time and intermediate states are dropped in
 * favor of the latest (per chat). Use this for periodic in-flight checkpoints;
 * use the synchronous saveChatState for one-shot authoritative saves (turn
 * completion, exit flush).
 */
export function scheduleCheckpointSave(
  runState: RunState,
  messages: ChatMessage[],
  chatDir: string = resolveCurrentChatDir(),
): void {
  getPendingCheckpoints().set(chatDir, { runState, messages })
  if (!getCheckpointDrain()) {
    const drain = drainCheckpoints().finally(() => {
      setCheckpointDrain(null)
    })
    setCheckpointDrain(drain)
  }
}

/**
 * Wait until all queued/in-flight checkpoint writes have flushed. Call this
 * before an authoritative synchronous save (turn completion / error) so that a
 * still-running async write can't land after — and clobber — the final state.
 * Relies on the run having stopped scheduling checkpoints (the SDK's snapshot
 * timer stops once the run settles), so the queue reaches idle.
 */
export async function settleCheckpointSave(): Promise<void> {
  await getCheckpointDrain()
}

export type { LiveChatState }
