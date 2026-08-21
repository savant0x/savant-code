import { getSystemMessage } from '../../utils/message-history'

import type { InputMode } from '../../utils/input-modes'
import type { RouterParams } from '../command-shared'

type KeySetupParams = Pick<
  RouterParams,
  'setInputValue' | 'setInputFocused' | 'inputRef' | 'setMessages'
> & {
  trimmed: string
  setInputMode: (mode: InputMode) => void
  getInfo: () => { label: string } | undefined
  saveKey: (value: string) => void
  unavailableMessage: string
  successMessage: (label: string) => string
}

/**
 * Shared handler for API-key setup input modes (provider + research BYOK).
 * Both modes are structurally identical: resolve the active provider/service,
 * validate the pasted key, persist it locally, and never echo the secret into
 * chat history. Extracted from route-user-prompt.ts so the two branches share
 * one implementation.
 */
export function routeKeySetup({
  trimmed,
  setInputValue,
  setInputMode,
  setInputFocused,
  inputRef,
  setMessages,
  getInfo,
  saveKey,
  unavailableMessage,
  successMessage,
}: KeySetupParams): void {
  const info = getInfo()
  if (!info) {
    setMessages((prev) => [...prev, getSystemMessage(unavailableMessage)])
  } else if (!trimmed) {
    setMessages((prev) => [
      ...prev,
      getSystemMessage(`${info.label} API key cannot be empty.`),
    ])
  } else {
    try {
      saveKey(trimmed)
      setMessages((prev) => [
        ...prev,
        getSystemMessage(successMessage(info.label)),
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        getSystemMessage(
          `Could not save the ${info.label} API key. Check your local configuration permissions and try again.`,
        ),
      ])
    }
  }

  // Never save or display the secret itself, and always return to normal input.
  setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  setInputMode('default')
  setInputFocused(true)
  inputRef.current?.focus()
}
