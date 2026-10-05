import { RenderableEvents, TextAttributes } from '@opentui/core'
import React, { useEffect, useRef, useState } from 'react'

import { useTheme } from '../../../hooks/use-theme'
import {
  isSidebarActivateKey,
  SidebarFocusContext,
} from '../../right-sidebar-focus'

import type { BoxRenderable } from '@opentui/core'

export interface FidCardProps {
  id: string
  status: string
  severity: string
  summary: string
  onClick?: () => void
  expanded?: boolean
}

/**
 * FidCard — a single FID entry used inside the right sidebar's Active FIDs section.
 *
 * Renders a compact entry with:
 *   - an expand/collapse chevron and short FID ID
 *   - the full FID summary below the title
 *
 * Uses only native OpenTUI flexbox with no extra gaps so rows stay tight.
 *
 * FID-2026-1005-002: the title row toggles on mouse click (unchanged) and on
 * Enter/Space when focused; it registers with the sidebar's Ctrl+G focus
 * cycle so FID rows are keyboard reachable. A focused title inverts as the
 * focus indicator.
 */
export function FidCard({
  id,
  summary,
  onClick,
  expanded: initialExpanded = false,
}: FidCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(initialExpanded)
  const focusController = React.useContext(SidebarFocusContext)
  const titleRef = useRef<BoxRenderable | null>(null)
  const [titleFocused, setTitleFocused] = useState(false)

  // Parse ID to extract short number (e.g., "035" from "FID-2026-0721-035")
  const shortId = id.replace(/^FID-\d{4}-\d{4}-/, '')

  const handleToggle = () => {
    setExpanded((prev) => !prev)
    onClick?.()
  }

  // Join the sidebar focus cycle (no-op without a provider).
  useEffect(() => {
    if (!focusController) return undefined
    return focusController.register({
      focus: () => titleRef.current?.focus(),
      blur: () => titleRef.current?.blur(),
    })
  }, [focusController])

  // Track focus for the title indicator.
  useEffect(() => {
    const title = titleRef.current
    if (!title) return undefined
    const onFocus = () => setTitleFocused(true)
    const onBlur = () => setTitleFocused(false)
    title.on(RenderableEvents.FOCUSED, onFocus)
    title.on(RenderableEvents.BLURRED, onBlur)
    return () => {
      title.off(RenderableEvents.FOCUSED, onFocus)
      title.off(RenderableEvents.BLURRED, onBlur)
    }
  }, [])

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      {/* Title row: chevron + short FID ID. onMouseDown is placed on a
          content-width box (alignSelf="flex-start") so empty space to the
          right is not clickable/highlightable. */}
      <box
        ref={titleRef}
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={handleToggle}
        onKeyDown={(key) => {
          if (isSidebarActivateKey(key)) {
            key.preventDefault?.()
            key.stopPropagation?.()
            handleToggle()
          }
        }}
        focusable={true}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text
          fg={theme.foreground}
          attributes={
            titleFocused
              ? TextAttributes.BOLD | TextAttributes.INVERSE
              : TextAttributes.BOLD
          }
          wrapMode="none"
          selectable={false}
        >
          {`FID-${shortId}`}
        </text>
      </box>

      {/* Full summary (preserve paragraph breaks from the FID) */}
      {expanded && (
        <box
          flexDirection="column"
          paddingLeft={2}
          focusable={false}
          selectable={false}
        >
          {summary.split(/\n\s*\n/).map((paragraph, index) => (
            <text
              key={index}
              fg={theme.muted}
              wrapMode="word"
              selectable={false}
            >
              {paragraph.trim()}
            </text>
          ))}
        </box>
      )}
    </box>
  )
}
