import {
  forkFrom,
  getTurn,
  restoreTurn,
  type RunState,
  type TurnCheckpoint,
  type TurnSummary,
} from '@savant-code/sdk'

import { getCurrentChatDir, startNewChat } from '../project-files'
import { saveChatState } from './run-state-storage'
import { useChatStore } from '../state/chat-store'

import type { RewindMode } from '../state/rewind-picker-store'
import type { ChatMessage } from '../types/chat'

/**
 * FID-2026-0803-004 — rewind execution core shared by the /rewind command
 * handler and the RewindPicker confirm path.
 *
 * Modes:
 *   - code: restore every file the turn touched to its pre-edit content
 *     (`restoreTurn`; `content: null` entries delete files created that turn).
 *   - conversation: truncate the chat transcript + SDK messageHistory back to
 *     the turn-start boundary captured in the checkpoint (messageCount /
 *     historyLength) and persist, so the next run continues from there.
 *   - both: code + conversation.
 *   - fork: code + conversation, then rotate to a fresh chat directory seeded
 *     with the truncated state (a new session "forked from here").
 *
 * Returns a user-facing status message to post in chat.
 */

type RewindDeps = {
  checkpointDir: string
  projectRoot: string
  turnId: string
  mode: RewindMode
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
}

/** Truncates a RunState's SDK messageHistory to `historyLength` entries. */
export function truncateRunStateToHistoryLength(
  runState: RunState | null,
  historyLength: number | undefined,
): RunState | null {
  if (!runState || !runState.sessionState || historyLength === undefined) {
    return runState
  }
  const { mainAgentState } = runState.sessionState
  if (
    !mainAgentState ||
    mainAgentState.messageHistory.length <= historyLength
  ) {
    return runState
  }
  return {
    ...runState,
    sessionState: {
      ...runState.sessionState,
      mainAgentState: {
        ...mainAgentState,
        messageHistory: mainAgentState.messageHistory.slice(0, historyLength),
      },
    },
  }
}

export function executeRewind({
  checkpointDir,
  projectRoot,
  turnId,
  mode,
  setMessages,
}: RewindDeps): string {
  const checkpoint = getTurn(checkpointDir, turnId)
  if (!checkpoint) {
    return `⚠️ No checkpoint found for turn ${turnId}.`
  }

  const touchesCode = mode === 'code' || mode === 'both' || mode === 'fork'
  const touchesConversation =
    mode === 'conversation' || mode === 'both' || mode === 'fork'

  let restoredCount = 0
  if (touchesCode) {
    if (mode === 'fork') {
      const forked = forkFrom({ checkpointDir, turnId, projectRoot })
      restoredCount = forked?.files.length ?? 0
    } else {
      restoredCount = restoreTurn({
        checkpointDir,
        turnId,
        projectRoot,
      }).length
    }
  }

  if (!touchesConversation) {
    return restoredCount > 0
      ? `✅ Rewound ${restoredCount} file${
          restoredCount === 1 ? '' : 's'
        } to before this turn.`
      : 'ℹ️ No files to restore for this turn.'
  }

  // Conversation truncation: restore the transcript + SDK history to the
  // turn-start boundary, then persist so the next run (or a restart) resumes
  // from the rewound conversation.
  const messages = useChatStore.getState().messages
  const messageCount = checkpoint.messageCount ?? 0
  const truncatedMessages = messages.slice(0, messageCount)
  const truncatedRunState = truncateRunStateToHistoryLength(
    useChatStore.getState().runState,
    checkpoint.historyLength,
  )

  const forking = mode === 'fork'
  // startNewChat rotates the chat id; resolve its directory for the seed.
  const targetDir = forking ? getCurrentChatDir() : undefined
  if (forking) {
    startNewChat()
  }

  setMessages(truncatedMessages)
  useChatStore.getState().setRunState(truncatedRunState)
  // Persist the rewound conversation so a restart after a rewind keeps it.
  const persistedRunState =
    truncatedRunState ?? useChatStore.getState().runState
  if (persistedRunState) {
    saveChatState(persistedRunState, truncatedMessages, targetDir, '', true)
  }

  const parts: string[] = []
  if (forking) {
    parts.push('Forked a new session from this point')
  } else {
    parts.push(
      `Rewound the conversation to before this turn (${truncatedMessages.length} messages)`,
    )
  }
  if (restoredCount > 0) {
    parts.push(
      `restored ${restoredCount} file${restoredCount === 1 ? '' : 's'}`,
    )
  }
  return `✅ ${parts.join(' · ')}.`
}

/**
 * Resolves a turn from a user-supplied argument: either a 1-based index into
 * the newest-first `listTurns` order or a full turnId.
 */
export function resolveTurnArg(
  turns: TurnSummary[],
  arg: string | undefined,
): TurnSummary | undefined {
  if (!arg) return undefined
  const asIndex = Number.parseInt(arg, 10)
  if (Number.isInteger(asIndex) && asIndex >= 1 && asIndex <= turns.length) {
    return turns[asIndex - 1]
  }
  return turns.find((t) => t.turnId === arg)
}

/** Formats a checkpoint's conversation boundary for the status message. */
export function describeCheckpoint(checkpoint: TurnCheckpoint | null): string {
  if (!checkpoint) return 'No checkpoint found.'
  const files = checkpoint.files.length
  return `Turn ${checkpoint.turnId.slice(0, 8)} — ${files} file${
    files === 1 ? '' : 's'
  } touched.`
}
