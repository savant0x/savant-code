import React, { useEffect, useMemo, useState } from 'react'

import { Button } from './button'
import { KeyHint } from './savant-ui/primitives/key-hint'
import { ScrollToBottomButton } from './scroll-to-bottom-button'
import { useTheme } from '../hooks/use-theme'
import { formatElapsedTime } from '../utils/format-elapsed-time'
import { getRandomLoadingPhrase } from '../utils/loading-phrases'

import type { StatusIndicatorState } from '../utils/status-indicator-state'

// test comment: added for feature verification
// multi-line edit for diff demo
// line three of the test block

interface StatusActionButtonProps {
  onClick: () => void
  shortcut?: string
  label?: string
}

/** A small status-bar action button with hover-bold styling. */
const StatusActionButton = ({
  onClick,
  shortcut,
  label,
}: StatusActionButtonProps) => {
  const [hovered, setHovered] = useState(false)

  return (
    <Button
      style={{ paddingLeft: 1, paddingRight: 1 }}
      onClick={onClick}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <KeyHint shortcut={shortcut} label={label} bold={hovered} />
    </Button>
  )
}

interface StatusBarProps {
  timerStartTime: number | null
  isAtBottom: boolean
  scrollToLatest: () => void
  statusIndicatorState: StatusIndicatorState
  onStop?: () => void
}

export const StatusBar = ({
  timerStartTime,
  isAtBottom,
  scrollToLatest,
  statusIndicatorState,
  onStop,
}: StatusBarProps) => {
  const theme = useTheme()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Show timer when actively working (streaming or waiting for response) or paused (ask_user)
  // This uses statusIndicatorState as the single source of truth for "is the LLM working?"
  const shouldShowTimer =
    statusIndicatorState?.kind === 'waiting' ||
    statusIndicatorState?.kind === 'streaming' ||
    statusIndicatorState?.kind === 'paused'

  useEffect(() => {
    if (!timerStartTime || !shouldShowTimer) {
      setElapsedSeconds(0)
      return
    }

    // When paused, don't update the timer - just keep the frozen value
    if (statusIndicatorState?.kind === 'paused') {
      // Calculate current elapsed time once and freeze it
      const now = Date.now()
      const elapsed = Math.floor((now - timerStartTime) / 1000)
      setElapsedSeconds(elapsed)
      return
    }

    const updateElapsed = () => {
      const now = Date.now()
      const elapsed = Math.floor((now - timerStartTime) / 1000)
      setElapsedSeconds(elapsed)
    }

    updateElapsed()
    // ALLOWLIST (FID-2026-0816-005): 1 Hz wall-clock timer read, not a visual
    // animation — the timeline engine is overkill for a once-per-second read.
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [timerStartTime, shouldShowTimer, statusIndicatorState?.kind])

  // Pick a random loading phrase once per status transition, not on every render.
  // The 1s timer causes frequent re-renders; memoizing by kind prevents rapid cycling.
  const loadingPhrase = useMemo(
    () => getRandomLoadingPhrase(),
    [statusIndicatorState.kind],
  )

  const renderStatusIndicator = (): { text: string; color: string } | null => {
    switch (statusIndicatorState.kind) {
      case 'ctrlC':
        return { text: 'Press Ctrl-C again to exit', color: theme.secondary }

      case 'clipboard':
        // Use green color for feedback success messages.
        return {
          text: statusIndicatorState.message,
          color: statusIndicatorState.message.includes('Feedback sent')
            ? theme.success
            : theme.primary,
        }

      case 'reconnected':
        return { text: 'Reconnected', color: theme.success }

      case 'retrying':
        return { text: 'retrying...', color: theme.warning }

      case 'connecting':
        return { text: 'connecting...', color: theme.muted }

      case 'waiting':
        return { text: loadingPhrase, color: theme.secondary }

      case 'streaming':
        return { text: loadingPhrase, color: theme.primary }

      case 'paused':
        return null

      case 'idle':
        return null
    }
  }

  const renderElapsedTime = (): string | null => {
    if (!shouldShowTimer || elapsedSeconds === 0) {
      return null
    }

    return formatElapsedTime(elapsedSeconds)
  }

  const statusIndicatorContent = renderStatusIndicator()
  const elapsedTimeContent = renderElapsedTime()

  // Show the status surface only while there is content.
  const hasContent =
    statusIndicatorContent !== null || elapsedTimeContent !== null

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 1,
        paddingRight: 1,
        gap: 1,
        backgroundColor: hasContent ? theme.surface : 'transparent',
      }}
    >
      <box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
        }}
      >
        {statusIndicatorContent !== null && (
          <text fg={statusIndicatorContent.color} style={{ wrapMode: 'none' }}>
            {statusIndicatorContent.text}
          </text>
        )}
      </box>

      <box style={{ flexShrink: 0 }}>
        {!isAtBottom && <ScrollToBottomButton onClick={scrollToLatest} />}
      </box>

      <box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {elapsedTimeContent !== null && (
          <text fg={theme.secondary} style={{ wrapMode: 'none' }}>
            {elapsedTimeContent}
          </text>
        )}
        {onStop &&
          (statusIndicatorState.kind === 'waiting' ||
            statusIndicatorState.kind === 'streaming') && (
            <StatusActionButton onClick={onStop} shortcut="Esc" />
          )}
      </box>
    </box>
  )
}
