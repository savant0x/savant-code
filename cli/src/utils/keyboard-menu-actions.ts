import type {
  ChatKeyboardAction,
  ChatKeyboardState,
} from './keyboard-action-types'

// FID-2026-0819-005 Loop 146: slash/mention menu navigation clusters,
// extracted from keyboard-actions.ts. Each helper returns the action for
// its priority block, or null to fall through to the next priority —
// preserving the original in-cascade fall-through semantics (e.g. history
// navigation enabled → "fall through to history navigation").

/** Key predicates the menu resolvers need (computed once in the caller). */
export type MenuKeyFlags = {
  isUp: boolean
  isDown: boolean
  isTab: boolean
  isShiftTab: boolean
  isEnter: boolean
}

/**
 * Priority 6: Slash menu navigation (when active and not disabled).
 * Skip menu navigation for Up/Down if history navigation is enabled (user is
 * paging through history).
 */
export function resolveSlashMenuAction(
  state: ChatKeyboardState,
  keys: MenuKeyFlags,
): ChatKeyboardAction | null {
  if (
    !state.slashMenuActive ||
    state.slashMatchesLength === 0 ||
    state.disableSlashSuggestions
  ) {
    return null
  }
  if (keys.isDown) {
    // If user is navigating history (historyNavDownEnabled), skip menu navigation entirely
    if (state.historyNavDownEnabled) {
      // Fall through to history navigation
      return null
    }
    if (state.slashSelectedIndex < state.slashMatchesLength - 1) {
      return { type: 'slash-menu-down' }
    }
    return { type: 'none' } // At bottom, don't navigate
  }
  if (keys.isUp) {
    // If user is navigating history (historyNavUpEnabled), skip menu navigation entirely
    if (state.historyNavUpEnabled) {
      // Fall through to history navigation
      return null
    }
    if (state.slashSelectedIndex > 0) {
      return { type: 'slash-menu-up' }
    }
    return { type: 'none' } // At top, don't navigate
  }
  if (keys.isTab || keys.isShiftTab) {
    // Tab accepts the highlighted command into the input without executing
    // it, leaving the cursor after it so the user can keep typing (e.g. extra
    // params for a skill). Tab no longer navigates between items — use the
    // arrow keys for that. Enter (below) selects and submits immediately.
    return { type: 'slash-menu-complete' }
  }
  if (keys.isEnter) {
    return { type: 'slash-menu-select' }
  }
  return null
}

/**
 * Priority 7: Mention menu navigation (when active).
 * Skip menu navigation for Up/Down if history navigation is enabled (user is
 * paging through history).
 */
export function resolveMentionMenuAction(
  state: ChatKeyboardState,
  keys: MenuKeyFlags,
): ChatKeyboardAction | null {
  if (!state.mentionMenuActive || state.totalMentionMatches === 0) {
    return null
  }
  if (keys.isDown) {
    // If user is navigating history (historyNavDownEnabled), skip menu navigation entirely
    if (state.historyNavDownEnabled) {
      // Fall through to history navigation
      return null
    }
    if (state.agentSelectedIndex < state.totalMentionMatches - 1) {
      return { type: 'mention-menu-down' }
    }
    return { type: 'none' } // At bottom, don't navigate
  }
  if (keys.isUp) {
    // If user is navigating history (historyNavUpEnabled), skip menu navigation entirely
    if (state.historyNavUpEnabled) {
      // Fall through to history navigation
      return null
    }
    if (state.agentSelectedIndex > 0) {
      return { type: 'mention-menu-up' }
    }
    return { type: 'none' } // At top, don't navigate
  }
  if (keys.isShiftTab) {
    return { type: 'mention-menu-shift-tab' }
  }
  if (keys.isTab) {
    // Multiple matches: cycle through options
    // Single match: complete the word without executing
    if (state.totalMentionMatches > 1) {
      return { type: 'mention-menu-tab' }
    }
    return { type: 'mention-menu-complete' }
  }
  if (keys.isEnter) {
    return { type: 'mention-menu-select' }
  }
  return null
}
