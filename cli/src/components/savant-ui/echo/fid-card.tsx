import { TextAttributes } from '@opentui/core'
import React, { useEffect, useState } from 'react'

import { glyph } from '../../../utils/glyphs'
import { useSidebarControl } from '../../right-sidebar-control'
import { SidebarFocusContext } from '../../right-sidebar-focus'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'

export interface FidCardProps {
  id: string
  title?: string
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
 *   - an expand/collapse chevron, document title and unambiguous FID suffix
 *   - the full FID summary below the title
 *
 * Uses only native OpenTUI flexbox with no extra gaps so rows stay tight.
 *
 * FID-2026-1005-002: the title row toggles on mouse click (unchanged) and on
 * Enter/Space when focused; it registers with the sidebar's F6 focus
 * cycle so FID rows are keyboard reachable. A focused title underlines as the
 * focus indicator.
 */
export function FidCard({
  id,
  title,
  status,
  severity,
  summary,
  onClick,
  expanded: initialExpanded = false,
}: FidCardProps) {
  const theme = useTheme()
  const focusController = React.useContext(SidebarFocusContext)
  const [expanded, setExpanded] = useState(
    focusController?.folds.get(id) ?? initialExpanded,
  )

  // Retain year/date/sequence so repeated sequence numbers stay distinct.
  const shortId = id.replace(/^FID-/, '')

  const handleToggle = () => {
    setExpanded((prev) => !prev)
    onClick?.()
  }

  const { focused, hovered, ...events } = useSidebarControl(id, handleToggle)
  useEffect(() => {
    focusController?.folds.set(id, expanded)
  }, [focusController, id, expanded])

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      {/* The complete title row is an actionable control. */}
      <box
        {...events}
        flexDirection="row"
        gap={1}
        width="100%"
        backgroundColor={focused || hovered ? theme.surfaceHover : undefined}
        focusable={true}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {glyph(expanded ? 'treeExpanded' : 'treeCollapsed')}
        </text>
        <text
          fg={theme.foreground}
          attributes={
            focused
              ? TextAttributes.BOLD | TextAttributes.UNDERLINE
              : TextAttributes.BOLD
          }
          wrapMode="word"
          flexShrink={1}
          selectable={false}
        >
          {title ?? id}
        </text>
      </box>
      <text
        paddingLeft={2}
        fg={
          severity === 'critical'
            ? theme.error
            : severity === 'high'
              ? theme.warning
              : theme.muted
        }
        wrapMode="word"
        selectable={false}
      >
        {`${shortId} · ${status} · ${severity}`}
      </text>

      {/* Full summary (preserve paragraph breaks from the FID) */}
      {expanded && (
        <box
          flexDirection="column"
          paddingLeft={2}
          focusable={false}
          selectable={false}
        >
          <text fg={theme.foreground} wrapMode="word" selectable={false}>
            {id}
          </text>
          {summary.split(/\n\s*\n/).map((paragraph, index) => (
            <text
              key={index}
              marginTop={index > 0 ? 1 : 0}
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
