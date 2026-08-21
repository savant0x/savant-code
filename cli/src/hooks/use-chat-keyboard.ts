import { useKeyboard } from '@opentui/react'
import { useCallback, useRef } from 'react'

import {
  dispatchAction,
  type ChatKeyboardHandlers,
} from './chat-keyboard-dispatcher'
import { reportActivity } from '../utils/activity-tracker'
import { resolveChatKeyboardAction } from '../utils/keyboard-actions'
import { markReturnKeySeenForKey } from '../utils/terminal-enter-detection'

import type { ChatKeyboardState } from '../utils/keyboard-actions'
import type { KeyEvent } from '@opentui/core'

// Re-export the handlers contract from the original path (consumers:
// chat/keyboard.ts + chat/use-chat-keyboard.ts).
export type { ChatKeyboardHandlers } from './chat-keyboard-dispatcher'

// Throttle interval for keyboard activity reporting (ms)
const KEYBOARD_ACTIVITY_THROTTLE_MS = 1000

/**
 * Options for the useChatKeyboard hook.
 */
export type UseChatKeyboardOptions = {
  /** Current keyboard state extracted from stores */
  state: ChatKeyboardState
  /** Handlers for keyboard actions */
  handlers: ChatKeyboardHandlers
  /** Whether keyboard handling is disabled (e.g., during ask-user) */
  disabled?: boolean
}

/**
 * Hook for handling keyboard input in chat text input contexts.
 * Integrates priority-based action resolution (utils/keyboard-actions) with
 * the pure dispatcher (chat-keyboard-dispatcher).
 *
 * This hook handles:
 * - Mode switching (bash, etc.)
 * - Stream interruption
 * - Suggestion menu navigation (slash and mention menus)
 * - History navigation
 * - Agent mode toggle
 * - Exit handling
 *
 * For feedback mode, the hook respects the feedbackMode state and routes
 * escape/ctrl-c appropriately.
 */
export function useChatKeyboard({
  state,
  handlers,
  disabled = false,
}: UseChatKeyboardOptions): void {
  const lastKeyboardActivityRef = useRef<number>(0)

  useKeyboard(
    useCallback(
      (key: KeyEvent) => {
        if (disabled) return

        // Report keyboard activity for activity-aware features (throttled)
        const now = Date.now()
        if (
          now - lastKeyboardActivityRef.current >
          KEYBOARD_ACTIVITY_THROTTLE_MS
        ) {
          lastKeyboardActivityRef.current = now
          reportActivity()
        }

        markReturnKeySeenForKey(key)

        const action = resolveChatKeyboardAction(key, state)
        const handled = dispatchAction(action, handlers)

        // Prevent default for handled actions
        if (
          handled &&
          'preventDefault' in key &&
          typeof key.preventDefault === 'function'
        ) {
          key.preventDefault()
        }
      },
      [state, handlers, disabled],
    ),
  )
}
