import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'

import { useTheme } from '../../../hooks/use-theme'

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
 */
export function FidCard({
  id,
  summary,
  onClick,
  expanded: initialExpanded = true,
}: FidCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(initialExpanded)

  // Parse ID to extract short number (e.g., "035" from "FID-2026-0721-035")
  const shortId = id.replace(/^FID-\d{4}-\d{4}-/, '')

  const handleToggle = () => {
    setExpanded((prev) => !prev)
    onClick?.()
  }

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      {/* Title row: chevron + short FID ID. onMouseDown is placed on a
          content-width box (alignSelf="flex-start") so empty space to the
          right is not clickable/highlightable. */}
      <box
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={handleToggle}
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text
          fg={theme.foreground}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
          selectable={false}
        >
          {`FID-${shortId}`}
        </text>
      </box>

      {/* Full summary (preserve paragraph breaks from the FID) */}
      {expanded && (
        <box flexDirection="column" paddingLeft={2} focusable={false} selectable={false}>
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
