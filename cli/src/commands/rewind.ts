import path from 'path'

import { listTurns } from '@savant-code/sdk'

import { tryGetProjectRoot } from '../project-files'
import { openRewindPicker } from '../state/rewind-picker-store'
import { getSystemMessage } from '../utils/message-history'
import { executeRewind, resolveTurnArg } from '../utils/rewind'
import { resolveCurrentChatDir } from '../utils/run-state-storage'

import type { CommandResult, RouterParams } from './command-registry'
import type { RewindMode } from '../state/rewind-picker-store'

/** FID-2026-0803-004: directory where this chat's per-turn checkpoints live. */
export function getCheckpointDir(): string {
  return path.join(resolveCurrentChatDir(), 'checkpoints')
}

const REWIND_MODE_ALIASES: Record<string, RewindMode> = {
  code: 'code',
  files: 'code',
  conversation: 'conversation',
  chat: 'conversation',
  both: 'both',
  all: 'both',
  fork: 'fork',
  branch: 'fork',
}

function parseModeArg(arg: string | undefined): RewindMode {
  if (!arg) return 'both'
  return REWIND_MODE_ALIASES[arg.toLowerCase()] ?? 'both'
}

/**
 * /rewind — restore a previous turn's file state and/or conversation.
 *
 * Usage:
 *   /rewind              → open the interactive picker
 *   /rewind 2            → rewind the 2nd-most-recent turn (files + chat)
 *   /rewind <turnId>     → rewind a specific turn
 *   /rewind 2 code       → files only
 *   /rewind 2 conversation → chat only
 *   /rewind 2 fork       → restore files + fork a new session from there
 *
 * No checkpoints yet → informational system message.
 */
export async function handleRewindCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const checkpointDir = getCheckpointDir()
  const turns = listTurns(checkpointDir)

  const trimmed = args.trim()
  if (!trimmed) {
    if (turns.length === 0) {
      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(
          'No checkpoints yet. Checkpoints are saved per turn once the agent writes to a file — rewind to restore them.',
        ),
      ])
      params.saveToHistory(params.inputValue.trim())
      params.setInputValue({
        text: '',
        cursorPosition: 0,
        lastEditDueToNav: false,
      })
      return
    }
    openRewindPicker(turns)
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }

  const [targetArg, modeArg] = trimmed.split(/\s+/)
  const turn = resolveTurnArg(turns, targetArg)
  if (!turn) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `No checkpoint matching "${targetArg}". Use /rewind to list available turns.`,
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }

  const mode = parseModeArg(modeArg)
  const projectRoot = tryGetProjectRoot()
  if (!projectRoot) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage('⚠️ Project root is not set — cannot rewind files.'),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }
  const message = executeRewind({
    checkpointDir,
    projectRoot,
    turnId: turn.turnId,
    mode,
    setMessages: params.setMessages,
  })
  params.setMessages((prev) => [...prev, getSystemMessage(message)])
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({
    text: '',
    cursorPosition: 0,
    lastEditDueToNav: false,
  })
  return
}
