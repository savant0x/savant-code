import path from 'path'

import { CHAT_MESSAGES_FILENAME } from '../chat-meta'
import { resolveCurrentChatDir, RUN_STATE_FILENAME } from './state'

/**
 * Get the path to the run state file for the current chat
 */
export function getRunStatePath(): string {
  const chatDir = resolveCurrentChatDir()
  return path.join(chatDir, RUN_STATE_FILENAME)
}

/**
 * Get the path to the chat messages file for the current chat
 */
export function getChatMessagesPath(): string {
  const chatDir = resolveCurrentChatDir()
  return path.join(chatDir, CHAT_MESSAGES_FILENAME)
}
