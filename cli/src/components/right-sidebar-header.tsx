import React from 'react'

import { EasterEggLogo } from './savant-ui/easter-egg-logo'
import { useTheme } from '../hooks/use-theme'

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
      gap={1}
      paddingBottom={1}
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
