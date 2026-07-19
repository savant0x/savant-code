import React from 'react'
import { TextAttributes } from '@opentui/core'
import { useTheme } from '../../../hooks/use-theme'

export interface PanelProps {
  title?: string
  border?: 'single' | 'rounded' | 'none'
  padding?: number
  children: React.ReactNode
  [key: string]: any
}

export function Panel({
  title,
  border = 'rounded',
  padding = 1,
  children,
  ...props
}: PanelProps) {
  const theme = useTheme()

  return (
    <box
      border={border !== 'none'}
      borderStyle={border === 'none' ? undefined : border}
      borderColor={theme.border}
      title={title}
      paddingLeft={padding}
      paddingRight={padding}
      paddingTop={padding}
      paddingBottom={padding}
      flexDirection="column"
      {...props}
    >
      {children}
    </box>
  )
}
