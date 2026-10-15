import React from 'react'

import { useTheme } from '../hooks/use-theme'

/**
 * Height of the expanded segmented control the tip anchors above (3 rows:
 * top border, content, bottom border). Coupled to SegmentedControl's row
 * structure — if that component gains padding/rows, re-measure here or anchor
 * dynamically. The collapsed button passes offsetBottom={1} instead.
 */
export const MODE_CONTROL_HEIGHT = 3

interface ModeHovertipProps {
  /** The description text to show. Renders nothing when empty. */
  text: string
  /**
   * Rows above the anchor box's bottom edge where the tip sits. The expanded
   * segmented control is 3 rows tall; the collapsed button is 1.
   */
  offsetBottom?: number
}

/**
 * ModeHovertip — a small floating description box anchored above the mode
 * toggle (FID-2026-0805-001).
 *
 * OpenTUI 0.2.2 ships no tooltip/hovertip primitive (full-package grep: 0
 * matches), so this is built on the verified primitives: `position: 'absolute'`
 * (status-bar precedent), `bottom` anchoring (avoids negative offsets), and
 * `zIndex`. The box is deliberately non-interactive — no mouse handlers — so it
 * can never capture hover and flicker. Tree order (rendered after the control)
 * keeps it painting on top.
 */
export function ModeHovertip({
  text,
  offsetBottom = MODE_CONTROL_HEIGHT,
}: ModeHovertipProps) {
  const theme = useTheme()
  if (!text) return null

  return (
    <box
      style={{
        position: 'absolute',
        bottom: offsetBottom,
        left: 0,
        zIndex: 10,
        borderStyle: 'single',
        borderColor: theme.border,
        backgroundColor: theme.surface,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text fg={theme.muted} style={{ wrapMode: 'none' }}>
        {text}
      </text>
    </box>
  )
}
