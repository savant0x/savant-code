import {
  disableAnalytics,
  initAnalytics,
  isAnalyticsEnabled,
} from '../utils/analytics'
import { getSystemMessage } from '../utils/message-history'
import { loadAnalyticsEnabled, saveAnalyticsEnabled } from '../utils/settings'

import type { ChatMessage } from '../types/chat'

export type TelemetryAction = 'enable' | 'disable' | 'status'

function currentStatusMessage(): string {
  return `Remote analytics and error reporting are **${isAnalyticsEnabled() ? 'enabled' : 'disabled'}**.`
}

export function handleTelemetryCommand(
  action: string,
): (messages: ChatMessage[]) => ChatMessage[] {
  const normalized = action.trim().toLowerCase() as TelemetryAction | ''

  if (normalized === 'enable' || normalized === 'disable') {
    const enabled = normalized === 'enable'
    if (!enabled) {
      saveAnalyticsEnabled(false)
      disableAnalytics()
      return (messages) => [
        ...messages,
        getSystemMessage(
          'Remote analytics and error reporting disabled. Local logs remain available.',
        ),
      ]
    }

    try {
      initAnalytics(true)
      saveAnalyticsEnabled(true)
      return (messages) => [
        ...messages,
        getSystemMessage('Remote analytics and error reporting enabled.'),
      ]
    } catch {
      disableAnalytics()
      return (messages) => [
        ...messages,
        getSystemMessage(
          'Remote analytics could not be initialized. It remains disabled; check your analytics configuration and try again.',
        ),
      ]
    }
  }

  if (normalized === 'status' || normalized === '') {
    // Status is observational: it must not implicitly re-enable a runtime
    // client after a failed initialization.
    const persistedEnabled = loadAnalyticsEnabled()
    const status =
      persistedEnabled && isAnalyticsEnabled()
        ? currentStatusMessage()
        : `Remote analytics and error reporting are **${persistedEnabled ? 'configured but unavailable' : 'disabled'}**.`
    return (messages) => [...messages, getSystemMessage(status)]
  }

  return (messages) => [
    ...messages,
    getSystemMessage('Usage: /telemetry [status|enable|disable]'),
  ]
}
