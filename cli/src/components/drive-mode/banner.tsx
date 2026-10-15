import React from 'react'

import { useTheme } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'

/**
 * FID-2026-0818-002: status banner shown while a drive run is locked in. The
 * runtime has stripped the interactive tools and ordinary input is locked; the
 * banner makes that state legible to the operator (Esc pause/stop lands in
 * child 007).
 */
export const DriveBanner: React.FC = () => {
  const theme = useTheme()
  const driveState = useChatStore((state) => state.driveState)

  const label =
    driveState === 'driving'
      ? '🛡️ Auto Drive active — running the approved plan autonomously'
      : driveState === 'blocked'
        ? '🛡️ Auto Drive blocked — awaiting operator decision'
        : '🛡️ Auto Drive'

  return (
    <box
      style={{
        width: '100%',
        paddingLeft: 1,
        paddingRight: 1,
        borderStyle: 'single',
        borderColor: theme.primary,
      }}
    >
      <text style={{ fg: theme.primary }}>{label}</text>
    </box>
  )
}
