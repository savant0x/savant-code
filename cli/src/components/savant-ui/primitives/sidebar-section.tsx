import { TextAttributes } from '@opentui/core'
import React, { useState } from 'react'


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
 * so interactions don't leave a highlighted block.
 */
export function SidebarSection({
  title,
  defaultExpanded = true,
  children,
}: SidebarSectionProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(defaultExpanded)

  const handleToggle = () => {
    setExpanded((prev) => !prev)
  }

  return (
    <box flexDirection="column" focusable={false} selectable={false}>
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
        <text attributes={TextAttributes.BOLD} fg={theme.primary} selectable={false}>
          {title}
        </text>
      </box>
      {expanded && (
        <box flexDirection="column" paddingLeft={2} focusable={false} selectable={false}>
          {children}
        </box>
      )}
    </box>
  )
}
