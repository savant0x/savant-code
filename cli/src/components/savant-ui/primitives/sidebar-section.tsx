import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useFoldCollapse } from '../../../hooks/use-fold-collapse'
import { glyph } from '../../../utils/glyphs'
import { useSidebarControl } from '../../right-sidebar-control'
import { SidebarFocusContext } from '../../right-sidebar-focus'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'

export interface SidebarSectionProps {
  title: string
  id?: string
  count?: string | number
  attention?: boolean
  defaultExpanded?: boolean
  children: React.ReactNode
}

/**
 * Collapsible sidebar section.
 *
 * Renders a bold neutral header with an expand/collapse chevron and a
 * padded body. The header toggles on mouse click (unchanged) and on
 * Enter/Space when focused (FID-2026-1005-002): the header is focusable and
 * registers with the sidebar's F6 focus cycle, so section controls are
 * keyboard reachable. A focused header underlines its title and accents the
 * row. Folding tweens the body height
 * to 0 (via `useFoldCollapse`) before unmounting.
 */
export function SidebarSection({
  title,
  id = title,
  count,
  attention = false,
  defaultExpanded = false,
  children,
}: SidebarSectionProps) {
  const theme = useTheme()
  const focusController = React.useContext(SidebarFocusContext)
  const { mounted, height, bodyRef, toggle, expanded } = useFoldCollapse(
    focusController?.folds.get(id) ?? defaultExpanded,
    focusController?.reducedMotion,
  )
  const { focused, hovered, ...events } = useSidebarControl(id, toggle)
  React.useEffect(() => {
    focusController?.folds.set(id, expanded)
  }, [focusController, id, expanded])

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
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
          attributes={
            focused
              ? TextAttributes.BOLD | TextAttributes.UNDERLINE
              : TextAttributes.BOLD
          }
          fg={focused ? theme.primary : theme.foreground}
          flexShrink={1}
          wrapMode="word"
          selectable={false}
        >
          {title}
        </text>
        {count !== undefined && (
          <text
            marginLeft="auto"
            flexShrink={0}
            fg={attention ? theme.warning : theme.muted}
            selectable={false}
          >
            {count}
          </text>
        )}
      </box>
      {mounted && (
        <box
          ref={bodyRef}
          flexDirection="column"
          paddingLeft={2}
          overflow="hidden"
          height={height}
          focusable={false}
          selectable={false}
        >
          {children}
        </box>
      )}
    </box>
  )
}
