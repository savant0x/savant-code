import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'

import { handleChatGptAuthCode } from '../../components/chatgpt-connect-banner'
import { getProjectRoot } from '../../project-files'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { validateAndAddImage } from '../../utils/pending-attachments'
import {
  buildInterviewPrompt,
  buildPlanPrompt,
  buildReviewPrompt,
} from '../prompt-builders'

import type { InputMode } from '../../utils/input-modes'
import type { RouterParams } from '../command-shared'

/**
 * Shared prompt-mode submit for plan / interview / review input. Resets the
 * input to default, fires the mode-specific prompt through sendMessage, then
 * scrolls to the latest message. Extracted from route-user-prompt.ts.
 */
export function sendModePrompt(
  params: RouterParams,
  setInputMode: (mode: InputMode) => void,
  mode: 'plan' | 'interview' | 'review',
  trimmed: string,
): void {
  const {
    agentMode,
    saveToHistory,
    setInputValue,
    setInputFocused,
    inputRef,
    sendMessage,
    scrollToLatest,
  } = params
  if (!trimmed) return
  saveToHistory(trimmed)
  setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setInputMode('default')
  setInputFocused(true)
  inputRef.current?.focus()

  const content =
    mode === 'plan'
      ? buildPlanPrompt(trimmed)
      : mode === 'interview'
        ? buildInterviewPrompt(trimmed)
        : buildReviewPrompt('custom', trimmed)
  sendMessage({ content, agentMode })
  setTimeout(() => {
    scrollToLatest()
  }, 0)
}

/**
 * Handles image-mode input: validates + attaches the image path, surfacing a
 * system error when the file can't be used. Extracted from route-user-prompt.ts.
 */
export async function routeImageMode(
  params: RouterParams,
  setInputMode: (mode: InputMode) => void,
  trimmed: string,
): Promise<void> {
  const { saveToHistory, setInputValue, setMessages } = params
  const imagePath = trimmed
  const projectRoot = getProjectRoot()

  // Validate and add the image (handles path resolution, format check, and processing)
  const result = await validateAndAddImage(imagePath, projectRoot)
  if (!result.success) {
    setMessages((prev) => [
      ...prev,
      getUserMessage(trimmed),
      getSystemMessage(`❌ ${result.error}`),
    ])
  }

  // Note: No system message added here - the PendingImagesBanner shows attached images
  saveToHistory(trimmed)
  setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setInputMode('default')
}

/**
 * Handles connect:chatgpt mode input: exchanges the pasted authorization code
 * and surfaces the result. Extracted from route-user-prompt.ts.
 */
export async function routeChatGptCode(
  params: RouterParams,
  setInputMode: (mode: InputMode) => void,
  trimmed: string,
  exchangeChatGptAuthCode: typeof handleChatGptAuthCode = handleChatGptAuthCode,
): Promise<void> {
  const { saveToHistory, setInputValue, setMessages } = params
  if (!CHATGPT_OAUTH_ENABLED) {
    setInputMode('default')
    return
  }

  const code = trimmed
  if (code) {
    const result = await exchangeChatGptAuthCode(code)
    setMessages((prev) => [
      ...prev,
      getUserMessage(trimmed),
      getSystemMessage(result.message),
    ])
  }

  saveToHistory(trimmed)
  setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setInputMode('default')
}
