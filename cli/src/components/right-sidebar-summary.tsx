import { TextAttributes } from '@opentui/core'
import React from 'react'

import { sidebarEllipsis } from './right-sidebar-display'
import { formatCost } from './right-sidebar-format'
import { useSidebarTheme as useTheme } from './right-sidebar-theme'
import { getVersion } from '../utils/version'
import { TokenMeter } from './savant-ui/echo/token-meter'

export interface SidebarSummaryProps {
  model: string
  mode: string
  cost: number
  tokensUsed: number
  tokensMax: number
  windowSource: 'catalog' | 'fallback-table' | 'default'
  bounded?: boolean
  cells?: number
  showContext?: boolean
}

export function SidebarSessionSummary({
  model,
  mode,
  cost,
  tokensUsed,
  tokensMax,
  windowSource,
  bounded = false,
  cells = 35,
  showContext = true,
}: SidebarSummaryProps) {
  const theme = useTheme()
  return (
    <box flexDirection="column" flexShrink={0}>
      <text
        fg={theme.foreground}
        attributes={TextAttributes.BOLD}
        wrapMode="word"
        selectable={false}
      >
        {`Model · ${bounded ? sidebarEllipsis(model, cells - 8) : model}`}
      </text>
      <text fg={theme.muted} wrapMode="word" selectable={false}>
        {bounded
          ? sidebarEllipsis(`${mode} · ${formatCost(cost)}`, cells)
          : `${mode} · ${formatCost(cost)}`}
      </text>
      {showContext && (
        <SidebarContextSummary {...{ tokensUsed, tokensMax, windowSource }} />
      )}
    </box>
  )
}

export function SidebarContextSummary({
  tokensUsed,
  tokensMax,
  windowSource,
  showVersion = false,
}: Pick<SidebarSummaryProps, 'tokensUsed' | 'tokensMax' | 'windowSource'> & {
  showVersion?: boolean
}) {
  const theme = useTheme()
  return (
    <box
      id="sidebar-context"
      flexDirection="column"
      flexShrink={0}
      width="100%"
      alignItems="center"
    >
      {showVersion && (
        <text
          id="sidebar-version"
          fg={theme.muted}
          selectable={false}
        >{`v${getVersion()}`}</text>
      )}
      <TokenMeter used={tokensUsed} max={tokensMax} animate={false} centered />
      <text
        fg={theme.muted}
        selectable={false}
      >{`Window source · ${windowSource === 'fallback-table' ? 'table' : windowSource}`}</text>
    </box>
  )
}
