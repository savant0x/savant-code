import React from 'react'

import { useSidebarTheme as useTheme } from './right-sidebar-theme'
import { EasterEggLogo } from './savant-ui/easter-egg-logo'

/**
 * FID-2026-0915-002 — sidebar header (logo + tagline), moved verbatim from
 * right-sidebar.tsx (split 9: smallest cohesive subcomponent block).
 */
export const SidebarHeader = React.memo(function SidebarHeader() {
  const theme = useTheme()
  return (
    <box
      flexDirection="column"
      alignItems="center"
      gap={0}
      focusable={false}
      selectable={false}
    >
      <box
        flexDirection="column"
        alignItems="center"
        flexShrink={1}
        width="100%"
        selectable={false}
      >
        <EasterEggLogo />
      </box>
      <box
        flexDirection="column"
        alignItems="center"
        flexShrink={1}
        width="100%"
        selectable={false}
      >
        <text fg={theme.muted} selectable={false}>
          One Mind. A Thousand Faces.
        </text>
      </box>
    </box>
  )
})
