import { useKeyboard } from '@opentui/react'
import { useCallback } from 'react'

import { SIDEBAR_TOOLS_AVAILABLE } from './styles'
import { RightSidebar } from '../components/right-sidebar'
import { SidebarRail } from '../components/sidebar-rail'
import { useTerminalBreakpoints } from '../hooks/use-terminal-breakpoints'
import { useChatStore } from '../state/chat-store'

import type { ChatSidebarProps } from './types'
import type { KeyEvent } from '@opentui/core'

/**
 * Right sidebar — session info, tools, history (FID-2026-0805-003).
 *
 * FID-2026-0816-007 step 1: wired to `useTerminalBreakpoints`. Below the
 * narrow breakpoint (< 60 cols) the sidebar collapses to an icon rail so the
 * chat column stays usable; at 60+ cols the full surface is restored.
 *
 * FID-2026-0816-010 follow-up (manual fold): the sidebar can also be folded to
 * the icon rail at ANY width via Ctrl+B (input unfocused/empty) or the `»` edge
 * handle, and restored via Ctrl+B or the rail's `«` handle. The manual fold is
 * stored in `sidebarCollapsed` and takes precedence over the width breakpoint.
 */
export function ChatSidebar(props: ChatSidebarProps) {
  const {
    contextTokensUsed,
    contextTokensMax,
    sessionCost,
    sidebarModel,
    agentId,
    toolsUsed,
    filesChanged,
    agentStack,
    toolHistory,
    isStreaming,
    isWaitingForResponse,
    fsmPhase,
    agentMode,
  } = props

  const { isNarrow } = useTerminalBreakpoints()
  const sidebarCollapsed = useChatStore((s) => s.sidebarCollapsed)
  const setSidebarCollapsed = useChatStore((s) => s.setSidebarCollapsed)

  // Ctrl+B toggles the manual fold. While the input is focused with text,
  // Ctrl+B is the Emacs backward-char edit command (navigation-character-keys)
  // — defer to it; the fold toggle is the global (unfocused or empty-input)
  // shortcut. Reading store state via getState keeps the handler fresh with no
  // re-subscription churn.
  useKeyboard(
    useCallback((key: KeyEvent) => {
      if (!(key.ctrl && key.name === 'b' && !key.meta && !key.option)) {
        return
      }
      const { inputFocused, inputValue } = useChatStore.getState()
      if (inputFocused && inputValue.length > 0) return
      key.preventDefault?.()
      key.stopPropagation?.()
      useChatStore
        .getState()
        .setSidebarCollapsed(!useChatStore.getState().sidebarCollapsed)
    }, []),
  )

  const sidebarProps = {
    tokensUsed: contextTokensUsed,
    tokensMax: contextTokensMax,
    cost: sessionCost,
    model: sidebarModel || 'unknown',
    mode: agentMode,
    agent: agentId ?? 'Savant',
    toolsUsed,
    toolsAvailable: SIDEBAR_TOOLS_AVAILABLE,
    filesChanged,
    agentStack,
    toolHistory,
    isStreaming,
    isWaitingForResponse,
    fsmPhase,
  }

  if (sidebarCollapsed || isNarrow) {
    return (
      <SidebarRail
        {...sidebarProps}
        // The `«` unfold handle only makes sense when the rail is shown by a
        // manual fold at a wide terminal (unfolding at <60 cols is a no-op —
        // the width breakpoint keeps it collapsed).
        onUnfold={!isNarrow ? () => setSidebarCollapsed(false) : undefined}
      />
    )
  }

  return (
    <RightSidebar
      {...sidebarProps}
      onCollapse={() => setSidebarCollapsed(true)}
    />
  )
}
