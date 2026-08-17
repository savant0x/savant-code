import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useFoldCollapse } from '../../../hooks/use-fold-collapse'
import { useTheme } from '../../../hooks/use-theme'

export interface SidebarSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

/**
 * Collapsible sidebar section.
 *
 * Renders a bold primary header with an expand/collapse chevron and a
 * padded body. The header toggles on mouse click; text is made non-selectable
 * so interactions don't leave a highlighted block. Folding tweens the body
 * height to 0 (via `useFoldCollapse`) before unmounting.
 */
export function SidebarSection({
  title,
  defaultExpanded = false,
  children,
}: SidebarSectionProps) {
  const theme = useTheme()
  const { mounted, height, bodyRef, toggle, expanded } =
    useFoldCollapse(defaultExpanded)

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
      <box
        flexDirection="row"
        gap={1}
        alignSelf="flex-start"
        onMouseDown={toggle}
        focusable={false}
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          {expanded ? '▼' : '▶'}
        </text>
        <text
          attributes={TextAttributes.BOLD}
          fg={theme.primary}
          selectable={false}
        >
          {title}
        </text>
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
