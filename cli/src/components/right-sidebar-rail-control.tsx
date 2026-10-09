import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useSidebarControl } from './right-sidebar-control'
import { sidebarEllipsis } from './right-sidebar-display'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'

export function RailControl({
  id,
  label,
  detail,
  attention,
  activate,
}: {
  id: string
  label: string
  detail: string
  attention?: boolean
  activate: () => void
}) {
  const theme = useTheme()
  const { focused, hovered, ...events } = useSidebarControl(
    `rail-${id}`,
    activate,
  )
  return (
    <box
      {...events}
      flexDirection="column"
      alignItems="center"
      width="100%"
      focusable
      backgroundColor={focused || hovered ? theme.surfaceHover : undefined}
    >
      <text
        id={`rail-${id}-label`}
        fg={focused || hovered ? theme.primary : theme.foreground}
        attributes={
          focused
            ? TextAttributes.BOLD | TextAttributes.UNDERLINE
            : TextAttributes.BOLD
        }
        selectable={false}
      >
        {label}
      </text>
      <text
        fg={attention ? theme.warning : theme.muted}
        wrapMode="word"
        selectable={false}
      >
        {sidebarEllipsis(detail, 11)}
      </text>
    </box>
  )
}
