import React from 'react'

import { EasterEggLogo } from './savant-ui/easter-egg-logo'

/**
 * FID-2026-0915-002 — sidebar header (logo + tagline), moved verbatim from
 * right-sidebar.tsx (split 9: smallest cohesive subcomponent block).
 * The version line under the wordmark was removed (2026-10-10): the version
 * now sits above the footer's line break, separated from the context readout.
 */
export const SidebarHeader = React.memo(function SidebarHeader() {
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
        {/* FID-2026-1010-003: one empty row above the wordmark so the
            header's top is not flush against the sidebar's first row
            (operator report 2026-10-10: "no empty space above the
            'savant' logo"). The fold button (absolute, top 0, zIndex 10)
            spans three rows — top border, label, bottom border. The spacer
            below reserves that height so the scrollbox's first row (the
            Activity detail chevron) never lands under the button's bottom
            border. */}
        <box height={1} selectable={false} />
        {/* The fold button (absolute, top 0, zIndex 10) spans three rows —
            top border, label, bottom border. The header reserves that
            height so the scrollbox's first row (the Activity detail chevron)
            never lands under the button's bottom border. */}
        <box height={1} selectable={false} />
      </box>
    </box>
  )
})
