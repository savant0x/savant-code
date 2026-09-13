import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { RouterParams } from './command-shared'

/**
 * Shared reply/echo helpers for the /provider subcommand handlers
 * (FID-2026-0913-002 split from provider-subcommands.ts). Both reply shapes
 * live here so the typed-grammar and picker-selection paths cannot drift on
 * echo semantics.
 */

export type ProviderParams = Pick<
  RouterParams,
  | 'setInputValue'
  | 'setInputFocused'
  | 'inputRef'
  | 'setMessages'
  | 'saveToHistory'
  | 'inputValue'
>

/** Echo the command into chat history, clear the input bar, restore focus. */
export function echoAndClear(params: ProviderParams): void {
  params.saveToHistory(params.inputValue.trim())
  params.setInputValue({
    text: '',
    cursorPosition: 0,
    lastEditDueToNav: false,
  })
  params.setInputFocused(true)
  params.inputRef.current?.focus()
}

/** Echo + system message + clear — the standard subcommand reply shape. */
export function replyAndClear(params: ProviderParams, message: string): void {
  params.setMessages((prev) => [
    ...prev,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(message),
  ])
  echoAndClear(params)
}

/**
 * Params for picker-sourced selection (FID-2026-0911-001 D2): no typed
 * command exists, so `saveToHistory`/`inputValue` are intentionally absent —
 * picker replies never echo anything into recall history.
 */
export type PickerSelectionParams = Pick<
  RouterParams,
  'setInputValue' | 'setInputFocused' | 'inputRef' | 'setMessages'
>

/** System message + clear input + focus, with NO history echo. */
export function replyWithoutTypedEcho(
  params: PickerSelectionParams,
  message: string,
): void {
  params.setMessages((prev) => [...prev, getSystemMessage(message)])
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
  params.setInputFocused(true)
  params.inputRef.current?.focus()
}
