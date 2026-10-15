import React from 'react'

export const createAppShellStyle = (backgroundColor: string) =>
  ({
    width: '100%',
    height: '100%',
    flexGrow: 1,
    flexDirection: 'column' as const,
    backgroundColor,
  }) as const

interface AppShellProps {
  backgroundColor: string
  children: React.ReactNode
}

/** Paint the complete OpenTUI viewport so host-terminal colors cannot leak through. */
export function AppShell({ backgroundColor, children }: AppShellProps) {
  return (
    <box style={createAppShellStyle(backgroundColor)} focusable={false}>
      {children}
    </box>
  )
}
