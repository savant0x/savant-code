import { getPresenceService } from '../state/presence'
import { getSystemMessage } from '../utils/message-history'
import {
  SAVANT_DISCORD_CLIENT_ID,
  loadPresenceEnabled,
  savePresenceEnabled,
} from '../utils/settings'

import type { ChatMessage } from '../types/chat'

/**
 * FID-2026-0818-009: /presence enable | disable | status.
 * Mirrors the /telemetry pattern: the preference persists to settings.json and
 * the runtime service is enabled/disabled/queried. The Discord Application
 * Client ID is hardcoded (`SAVANT_DISCORD_CLIENT_ID`), not operator-mutable —
 * a configurable id would let a third-party application claim the Savant Rich
 * Presence asset as its own (feature theft), so there is no `client <id>`
 * subcommand (operator decision 2026-08-18).
 */

function statusMessage(): string {
  const enabled = loadPresenceEnabled()
  if (!enabled) return 'Discord Rich Presence is **disabled**.'
  const state = getPresenceService(SAVANT_DISCORD_CLIENT_ID).getState()
  return `Discord Rich Presence is **enabled** — transport: ${state}.`
}

export function handlePresenceCommand(
  action: string,
): (messages: ChatMessage[]) => ChatMessage[] {
  const [sub] = action.trim().split(/\s+/)
  const normalized = (sub ?? '').toLowerCase()

  if (normalized === 'enable') {
    savePresenceEnabled(true)
    void getPresenceService(SAVANT_DISCORD_CLIENT_ID).enable()
    return (messages) => [
      ...messages,
      getSystemMessage('Discord Rich Presence enabled.'),
    ]
  }

  if (normalized === 'disable') {
    savePresenceEnabled(false)
    void getPresenceService(SAVANT_DISCORD_CLIENT_ID).disable()
    return (messages) => [
      ...messages,
      getSystemMessage(
        'Discord Rich Presence disabled and cleared. The preference persists across sessions.',
      ),
    ]
  }

  if (normalized === 'status' || normalized === '') {
    return (messages) => [...messages, getSystemMessage(statusMessage())]
  }

  return (messages) => [
    ...messages,
    getSystemMessage('Usage: /presence [status|enable|disable]'),
  ]
}
