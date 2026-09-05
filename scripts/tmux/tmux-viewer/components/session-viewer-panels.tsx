import { TextAttributes } from '@opentui/core'
import React from 'react'

import type { Capture, SessionData } from '../types'
import type { ViewerTheme } from './theme'

// Header component
export const SessionHeader: React.FC<{
  data: SessionData
  theme: ViewerTheme
}> = ({ data, theme }) => {
  const { sessionInfo, commands, captures } = data

  return (
    <box
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <box style={{ flexDirection: 'row', gap: 2 }}>
        <text style={{ fg: theme.primary, attributes: TextAttributes.BOLD }}>
          Session: {sessionInfo.session}
        </text>
        <text style={{ fg: theme.muted }}>
          {sessionInfo.dimensions.width}x{sessionInfo.dimensions.height}
        </text>
      </box>
      <box style={{ flexDirection: 'row', gap: 2 }}>
        <text style={{ fg: theme.muted }}>{commands.length} cmds</text>
        <text style={{ fg: theme.muted }}>{captures.length} captures</text>
      </box>
    </box>
  )
}

// Capture panel component (top)
export const CapturePanel: React.FC<{
  capture: Capture | undefined
  theme: ViewerTheme
}> = ({ capture, theme }) => {
  if (!capture) {
    return (
      <box
        style={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <text style={{ fg: theme.muted }}>No capture selected</text>
      </box>
    )
  }

  const { content } = capture

  return (
    <box
      style={{
        flexDirection: 'column',
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Muted box around the terminal capture */}
      <box
        style={{
          borderStyle: 'single',
          borderColor: theme.muted,
        }}
        border={['top', 'bottom', 'left', 'right']}
      >
        <text style={{ fg: theme.foreground }}>{content}</text>
      </box>
    </box>
  )
}

// Footer component with help text and replay controls
export const Footer: React.FC<{
  theme: ViewerTheme
  isPlaying: boolean
  playbackSpeed: number
  currentIndex: number
  totalCaptures: number
}> = ({ theme, isPlaying, playbackSpeed, currentIndex, totalCaptures }) => {
  const position =
    totalCaptures > 0 ? `${currentIndex + 1}/${totalCaptures}` : '0/0'
  const speedDisplay = `${playbackSpeed.toFixed(1)}s`
  const playIcon = isPlaying ? '⏸' : '▶'

  return (
    <box
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderStyle: 'single',
        borderColor: theme.border,
        paddingLeft: 1,
        paddingRight: 1,
      }}
      border={['top']}
    >
      {/* Left: Replay status */}
      <box style={{ flexDirection: 'row', gap: 1 }}>
        <text style={{ fg: isPlaying ? theme.success : theme.muted }}>
          {playIcon}
        </text>
        <text style={{ fg: theme.foreground }}>{position}</text>
        <text style={{ fg: theme.muted }}>@{speedDisplay}</text>
      </box>

      {/* Center: Key hints */}
      <box style={{ flexDirection: 'row', gap: 2 }}>
        <text style={{ fg: theme.muted }}>space: play/pause</text>
        <text style={{ fg: theme.muted }}>+/-: speed</text>
        <text style={{ fg: theme.muted }}>←→: navigate</text>
        <text style={{ fg: theme.muted }}>r: restart</text>
        <text style={{ fg: theme.muted }}>q: quit</text>
      </box>

      {/* Right: Mode indicator */}
      <box>
        <text style={{ fg: theme.muted }}>--json for AI</text>
      </box>
    </box>
  )
}
