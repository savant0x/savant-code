import React from 'react'

import { useTheme } from '../hooks/use-theme'

interface UserErrorBannerProps {
  error: string
  title?: string
}

/** Displays runtime errors in the UI (not sent to LLM). */
export const UserErrorBanner = React.memo(function UserErrorBanner({
  error,
  title,
}: UserErrorBannerProps) {
  const theme = useTheme()

  // Handle empty and whitespace-only errors
  const trimmedError = error.trim()
  if (!trimmedError) {
    return null
  }

  return (
    <box
      style={{
        width: '100%',
        // No border — simple error display
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
        flexDirection: 'column',
        gap: 0,
        marginTop: 1,
      }}
    >
      <box
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <text style={{ fg: theme.error }}>
          {'✕ '}
        </text>
        <text style={{ fg: theme.error, wrapMode: 'word' }}>
          {title ?? 'error'}
        </text>
      </box>
      <text style={{ fg: theme.foreground, wrapMode: 'word', paddingLeft: 2 }}>
        {error}
      </text>
    </box>
  )
})
