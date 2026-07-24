import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

export interface KeyValueRowProps {
  label: string
  value: React.ReactNode
  valueColor?: string
}

/**
 * A single label/value row used inside the right sidebar.
 *
 * Uses native OpenTUI flexbox to push the value to the right edge instead of
 * relying on manual space padding.
 */
export function KeyValueRow({
  label,
  value,
  valueColor,
}: KeyValueRowProps) {
  const theme = useTheme()

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      width="100%"
      gap={1}
      focusable={false}
      selectable={false}
    >
      <text fg={theme.muted} wrapMode="none" selectable={false}>
        {label}
      </text>
      <text
        fg={valueColor ?? theme.foreground}
        wrapMode="none"
        selectable={false}
      >
        {value}
      </text>
    </box>
  )
}
