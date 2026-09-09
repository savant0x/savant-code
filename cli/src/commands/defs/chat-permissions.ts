import { useChatStore } from '../../state/chat-store'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { savePermissionModePreference } from '../../utils/settings'
import { clearInput } from '../command-shared'

import type { RouterParams } from '../command-shared'

// FID-2026-0819-005 Loop 142: /permissions handler, extracted from
// chat.ts. With no args, shows the current permission mode; with
// safe|prompt|unsafe, persists the new mode to the store and settings.
export function handlePermissionsCommand(params: RouterParams, args: string) {
  const trimmedArgs = args.trim().toLowerCase()
  const currentMode = useChatStore.getState().permissionMode
  const validModes = ['safe', 'prompt', 'unsafe'] as const
  const modeDescriptions: Record<(typeof validModes)[number], string> = {
    safe: 'Fully offline: network research tools are denied automatically; risky tools are denied automatically.',
    prompt:
      'Outbound research tools (web search, URL read, docs) run; side-effectful tools (shell, SQL writes, external connections) are still denied — interactive approval is not yet implemented.',
    unsafe: 'Risky tools are allowed. Use with caution.',
  }

  if (!trimmedArgs) {
    params.setMessages((prev) => [
      ...prev,
      getUserMessage(params.inputValue.trim()),
      getSystemMessage(
        `Current permission mode: **${currentMode}**\n\n${modeDescriptions[currentMode]}`,
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    clearInput(params)
    return
  }

  if (!validModes.includes(trimmedArgs as (typeof validModes)[number])) {
    params.setMessages((prev) => [
      ...prev,
      getUserMessage(params.inputValue.trim()),
      getSystemMessage(
        `Unknown permission mode: "${trimmedArgs}". Use "/permissions safe", "/permissions prompt", or "/permissions unsafe".`,
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    clearInput(params)
    return
  }

  const newMode = trimmedArgs as (typeof validModes)[number]
  useChatStore.getState().setPermissionMode(newMode)
  savePermissionModePreference(newMode)
  params.setMessages((prev) => [
    ...prev,
    getUserMessage(params.inputValue.trim()),
    getSystemMessage(
      `Permission mode set to **${newMode}**.\n\n${modeDescriptions[newMode]}`,
    ),
  ])
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)
}
