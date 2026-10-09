import * as fs from 'fs'
import { randomUUID } from 'node:crypto'
import path from 'path'

import { getMostRecentChatDir, getProjectDataDir } from '../../project-files'
import { CHAT_MESSAGES_FILENAME, CHAT_META_FILENAME } from '../chat-meta'
import { loadChatStateFromDb } from '../db-storage'
import { logger } from '../logger'
import { getChatMessagesPath, getRunStatePath } from './paths'
import {
  getChatDirOverride,
  resolveCurrentChatDir,
  RUN_STATE_FILENAME,
} from './state'

import type { SavedChatState } from './state'
import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

/**
 * Load chat state from a specific chat directory on disk. Returns null when the
 * directory or its state files are missing/unreadable.
 */
function loadChatStateFromDisk(chatDir: string): SavedChatState | null {
  const runStatePath = path.join(chatDir, RUN_STATE_FILENAME)
  const messagesPath = path.join(chatDir, CHAT_MESSAGES_FILENAME)

  // Parse the two files independently: a missing or torn run-state.json
  // must not lose the transcript, and vice versa. Restore whatever is
  // readable and fall back for the rest.
  let runState: RunState | null = null
  try {
    runState = JSON.parse(fs.readFileSync(runStatePath, 'utf8')) as RunState
  } catch (error) {
    logger.warn(
      {
        runStatePath,
        error: error instanceof Error ? error.message : String(error),
      },
      'Could not read run state; restoring transcript without agent context',
    )
  }

  let messages: ChatMessage[] | null = null
  try {
    messages = JSON.parse(
      fs.readFileSync(messagesPath, 'utf8'),
    ) as ChatMessage[]
  } catch (error) {
    logger.warn(
      {
        messagesPath,
        error: error instanceof Error ? error.message : String(error),
      },
      'Could not read chat messages; restoring agent context without transcript',
    )
  }

  if (!runState && !messages) {
    logger.debug(
      { runStatePath, messagesPath },
      'No readable state files in chat directory',
    )
    return null
  }

  runState ??= {
    output: {
      type: 'error',
      message: 'Previous run state could not be restored.',
    },
  } as RunState
  runState.traceSessionId ??= randomUUID()
  messages ??= []

  const resolvedChatId = path.basename(chatDir)

  logger.info(
    {
      runStatePath,
      messagesPath,
      messageCount: messages.length,
      chatId: resolvedChatId,
    },
    'Loaded chat state from chat directory',
  )

  return { runState, messages, chatId: resolvedChatId }
}

/**
 * Load both RunState and ChatMessage[] from a specific chat directory or the most recent one.
 * When chatId is provided, it is used to locate the chat directory; otherwise the most
 * recently modified chat directory is used.
 * Returns null if no previous chat exists or files can't be parsed.
 *
 * The filesystem is treated as the authoritative source because async checkpoints
 * (mid-stream) are written to disk but not to the database. The database is only
 * consulted as a fallback when the filesystem state is unavailable.
 */
export function loadMostRecentChatState(
  chatId?: string,
): SavedChatState | null {
  try {
    let chatDir: string | null = getChatDirOverride()

    if (!chatDir && chatId && chatId.trim().length > 0) {
      const baseDir = path.join(getProjectDataDir(), 'chats')
      const candidateDir = path.join(baseDir, chatId.trim())
      if (
        fs.existsSync(candidateDir) &&
        fs.statSync(candidateDir).isDirectory()
      ) {
        chatDir = candidateDir
      } else {
        logger.debug(
          { candidateDir, chatId },
          'Requested chatId directory not found, falling back to most recent chat directory',
        )
      }
    }

    if (!chatDir) {
      chatDir = getMostRecentChatDir()
    }

    // Prefer the filesystem: it holds the latest mid-stream checkpoints.
    if (chatDir) {
      const diskState = loadChatStateFromDisk(chatDir)
      if (diskState) {
        return diskState
      }
    }

    // Fall back to the database only when the filesystem state is missing.
    if (chatId) {
      const dbState = loadChatStateFromDb(chatId)
      if (dbState) {
        logger.info(
          { chatId, messageCount: dbState.messages.length },
          'Loaded chat state from database',
        )
        return {
          runState: dbState.runState,
          messages: dbState.messages,
          chatId,
        }
      }
    }

    logger.debug('No previous chat directory found')
    return null
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to load chat state',
    )
    return null
  }
}

/**
 * FID-2026-1009-002: the context token count a restored chat carries, or
 * null when the state has none. The sidebar seeds its readout from this at
 * boot so a resumed chat shows its real count instead of 0/1,000,000 until
 * the first run's first step recomputes it. Non-positive counts are "no
 * reading" and yield null (the display guard suppresses them anyway).
 */
export function readRestoredContextTokenCount(
  runState: RunState | null | undefined,
): number | null {
  const count = runState?.sessionState?.mainAgentState?.contextTokenCount
  return typeof count === 'number' && count > 0 ? count : null
}

/**
 * Clear the saved state files
 */
export function clearChatState(): void {
  try {
    const runStatePath = getRunStatePath()
    const messagesPath = getChatMessagesPath()
    const metaPath = path.join(resolveCurrentChatDir(), CHAT_META_FILENAME)

    for (const filePath of [runStatePath, messagesPath, metaPath]) {
      fs.rmSync(filePath, { force: true })
    }

    logger.debug(
      { runStatePath, messagesPath, metaPath },
      'Cleared chat state files',
    )
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Failed to clear chat state',
    )
  }
}
