import React from 'react'

import { useTheme } from '../../../hooks/use-theme'

import type { BoxProps } from '@opentui/react'

export interface PanelProps extends Omit<
  BoxProps,
  'children' | 'title' | 'border'
> {
  title?: string
  border?: 'single' | 'rounded' | 'none'
  padding?: number
  children: React.ReactNode
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
