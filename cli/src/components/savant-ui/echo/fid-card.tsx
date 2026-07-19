import React from 'react'

import { TextAttributes } from '@opentui/core'

import { useTheme } from '../../../hooks/use-theme'
import { Badge } from '../data-display/badge'

export interface FidCardProps {
  id: string
  status: string
  severity: string
  summary: string
  onClick?: () => void
  expanded?: boolean
}

const SEVERITY_BADGE: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

const STATUS_BADGE: Record<string, 'open' | 'closed'> = {
  closed: 'closed',
}

export function FidCard({ id, status, severity, summary, onClick, expanded }: FidCardProps) {
  const theme = useTheme()

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="rounded"
      borderColor={theme.border}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={0}
      paddingBottom={0}
    >
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={theme.primary} attributes={TextAttributes.BOLD}>FID-{id}</text>
        <Badge variant={SEVERITY_BADGE[severity] ?? 'medium'}>{severity}</Badge>
        <Badge variant={STATUS_BADGE[status] ?? 'open'}>{status}</Badge>
      </box>
      <text fg={theme.muted}>{summary}</text>
    </box>
  )
}
