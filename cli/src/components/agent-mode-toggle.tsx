import { TextAttributes } from '@opentui/core'
import React, { useEffect, useRef, useState } from 'react'

import { resolveAgentModeClick } from './agent-mode-click'
import { Button } from './button'
import { ModeHovertip } from './mode-hovertip'
import { SegmentedControl } from './segmented-control'
import { useHoverToggle } from './use-hover-toggle'
import { useScaffoldConfirm } from '../hooks/use-scaffold-confirm'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import {
  AGENT_MODES,
  IS_SAVANT_FREE,
  MODE_DESCRIPTIONS,
} from '../utils/constants'
import { BORDER_CHARS } from '../utils/ui-constants'

import type { Segment } from './segmented-control'
import type { AgentMode } from '../utils/constants'

export { useHoverToggle } from './use-hover-toggle'
export {
  OPEN_DELAY_MS,
  CLOSE_DELAY_MS,
  REOPEN_SUPPRESS_MS,
} from './use-hover-toggle'
export { resolveAgentModeClick } from './agent-mode-click'
export type { AgentModeClickAction } from './agent-mode-click'

/**
 * Builds the segment configuration for the expanded state.
 * Shows all modes plus an active indicator with reversed arrow.
 */
export function buildExpandedSegments(currentMode: AgentMode): Segment[] {
  return [
    // All mode options (disabled for current mode)
    ...AGENT_MODES.map((m) => ({
      id: m,
      label: m,
      isBold: false,
      disabled: m === currentMode,
      description: MODE_DESCRIPTIONS[m],
    })),
    // Active mode indicator with reversed arrow
    {
      id: `active-${currentMode}`,
      label: `> ${currentMode}`,
      isSelected: true,
      defaultHighlighted: true,
      description: MODE_DESCRIPTIONS[currentMode],
    },
  ]
}

/**
 * AgentModeToggle
 *
 * Compact, hover-expandable segmented control for switching agent modes.
 * - Clicking the current mode toggles expansion (open/close)
 * - Clicking a different mode calls `onSelectMode` when provided,
 *   otherwise falls back to `onToggle`
 */
export const AgentModeToggle = ({
  mode,
  onToggle,
  onSelectMode,
}: {
  mode: AgentMode
  onToggle: () => void
  onSelectMode?: (mode: AgentMode) => void
}) => {
  const theme = useTheme()
  const inputFocused = useChatStore((state) => state.inputFocused)
  const [isCollapsedHovered, setIsCollapsedHovered] = useState(false)
  const [collapsedHovered, setCollapsedHovered] = useState(false)
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)
  const hoverToggle = useHoverToggle()
  // Hover-intent grace for the collapsed tip: delay clearing it so the cursor
  // can travel toward the tip without it flickering away (FID-2026-0805-001).
  const collapsedHoverGraceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const COLLAPSED_HOVER_GRACE_MS = 150

  useEffect(() => {
    return () => {
      if (collapsedHoverGraceRef.current) {
        clearTimeout(collapsedHoverGraceRef.current)
      }
    }
  }, [])
  const {
    confirmState,
    requestScaffoldMode,
    confirm: confirmScaffold,
    cancel: cancelScaffold,
  } = useScaffoldConfirm()

  if (IS_SAVANT_FREE) return null

  const handleMouseOver = () => {
    // Don't open on hover if terminal is not focused
    if (!inputFocused) return
    hoverToggle.clearCloseTimer()
    hoverToggle.scheduleOpen()
  }

  const handleMouseOut = () => {
    hoverToggle.scheduleClose()
    setIsCollapsedHovered(false)
  }

  const handleSegmentClick = (id: string) => {
    const action = resolveAgentModeClick(mode, id, !!onSelectMode)
    if (action.type === 'closeActive') {
      setHoveredSegmentId(null)
      hoverToggle.closeNow(true)
      return
    }
    if (action.type === 'selectMode') {
      if (action.mode === 'SCAFFOLD') {
        const canProceed = requestScaffoldMode('SCAFFOLD')
        if (!canProceed) return
        onSelectMode?.('SCAFFOLD')
        hoverToggle.closeNow(true)
        return
      }
      onSelectMode?.(action.mode)
      hoverToggle.closeNow(true)
      return
    }
    // Toggle fallback (no onSelectMode provided)
    hoverToggle.clearAllTimers()
    onToggle()
    hoverToggle.closeNow(true)
  }

  if (!hoverToggle.isOpen) {
    // When the input is not focused, hover does not expand the control — show
    // the current mode's description as a hovertip instead (FID-2026-0805-001).
    const showCollapsedTip = collapsedHovered && !inputFocused
    return (
      <box style={{ flexDirection: 'column' }}>
        <Button
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 1,
            paddingRight: 1,
            borderStyle: 'single',
            // Hover stroke is the brand cyan, not off-white (operator
            // feedback 2026-08-16: mode chip showed a white stroke on hover).
            borderColor: isCollapsedHovered ? theme.primary : theme.border,
          }}
          customBorderChars={BORDER_CHARS}
          onClick={() => {
            if (!inputFocused) return
            setHoveredSegmentId(null)
            hoverToggle.clearAllTimers()
            hoverToggle.openNow()
          }}
          onMouseOver={() => {
            if (collapsedHoverGraceRef.current) {
              clearTimeout(collapsedHoverGraceRef.current)
            }
            setCollapsedHovered(true)
            if (inputFocused) {
              setIsCollapsedHovered(true)
            }
            handleMouseOver()
          }}
          onMouseOut={() => {
            if (collapsedHoverGraceRef.current) {
              clearTimeout(collapsedHoverGraceRef.current)
            }
            collapsedHoverGraceRef.current = setTimeout(() => {
              setCollapsedHovered(false)
            }, COLLAPSED_HOVER_GRACE_MS)
            handleMouseOut()
          }}
        >
          <text
            wrapMode="none"
            fg={isCollapsedHovered ? theme.foreground : theme.muted}
          >
            {isCollapsedHovered ? (
              <span attributes={TextAttributes.BOLD}>{`< ${mode}`}</span>
            ) : (
              `< ${mode}`
            )}
          </text>
        </Button>
        {showCollapsedTip && (
          <ModeHovertip text={MODE_DESCRIPTIONS[mode]} offsetBottom={1} />
        )}
      </box>
    )
  }

  // Expanded state: delegate rendering to SegmentedControl
  const segments: Segment[] = buildExpandedSegments(mode)
  const hoveredSegment = hoveredSegmentId
    ? segments.find((s) => s.id === hoveredSegmentId)
    : undefined
  const hovertipText = hoveredSegment?.description ?? ''

  if (confirmState.kind === 'pending') {
    return (
      <box style={{ flexDirection: 'column', gap: 1 }}>
        <text fg={theme.foreground}>
          <span attributes={TextAttributes.BOLD}>
            SCAFFOLD mode opens project-root writes.
          </span>
        </text>
        <text fg={theme.muted}>
          Use only for first-time project scaffolding. Confirm?
        </text>
        <box style={{ flexDirection: 'row', gap: 2 }}>
          <Button
            onClick={() => {
              confirmScaffold()
              onSelectMode?.('SCAFFOLD')
              hoverToggle.closeNow(true)
            }}
          >
            <text fg={theme.foreground}>Confirm</text>
          </Button>
          <Button
            onClick={() => {
              cancelScaffold()
              hoverToggle.closeNow(true)
            }}
          >
            <text fg={theme.muted}>Cancel</text>
          </Button>
        </box>
      </box>
    )
  }

  return (
    <box style={{ flexDirection: 'column' }}>
      <SegmentedControl
        segments={segments}
        onSegmentClick={handleSegmentClick}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onHoverChange={setHoveredSegmentId}
      />
      {hovertipText !== '' && <ModeHovertip text={hovertipText} />}
    </box>
  )
}
