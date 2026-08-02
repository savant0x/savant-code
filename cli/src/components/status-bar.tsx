import { TextAttributes } from '@opentui/core'
import { getSavantFreeModel } from '@savant-code/common/constants/savant-free-models'
import React, { useEffect, useMemo, useState } from 'react'

import { Button } from './button'
import { KeyHint } from './savant-ui/primitives/key-hint'
import { ScrollToBottomButton } from './scroll-to-bottom-button'
import { useSavantFreeSessionProgress } from '../hooks/use-savant-free-session-progress'
import { useTheme } from '../hooks/use-theme'
import { formatElapsedTime } from '../utils/format-elapsed-time'
import { getRandomLoadingPhrase } from '../utils/loading-phrases'
import {
  SAVANT_FREE_COUNTDOWN_VISIBLE_MS,
  formatSavantFreeSessionCountdown,
  formatSavantFreeSessionRemaining,
} from '../utils/savant-free-session-display'

import type { SavantFreeSession } from '../types/savant-free-session'
import type { StatusIndicatorState } from '../utils/status-indicator-state'

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
  onEndSession?: () => void
  savantFreeSession: SavantFreeSession | null
}

export const StatusBar = ({
  timerStartTime,
  isAtBottom,
  scrollToLatest,
  statusIndicatorState,
  onStop,
  onEndSession,
  savantFreeSession,
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
    const interval = setInterval(updateElapsed, 1000)

    return () => clearInterval(interval)
  }, [timerStartTime, shouldShowTimer, statusIndicatorState?.kind])

  const sessionProgress = useSavantFreeSessionProgress(savantFreeSession)
  const isUnlimited =
    savantFreeSession?.status === 'active' && !savantFreeSession.rateLimit

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
        if (sessionProgress === null) return null
        {
          const isUrgent =
            sessionProgress.remainingMs < SAVANT_FREE_COUNTDOWN_VISIBLE_MS
          const modelName =
            savantFreeSession?.status === 'active'
              ? getSavantFreeModel(savantFreeSession.model).displayName
              : null
          return {
            text: `${modelName ? `${modelName} · ` : ''}${
              isUnlimited
                ? 'unlimited'
                : formatSavantFreeSessionRemaining(sessionProgress.remainingMs)
            }`,
            color: isUnlimited
              ? theme.secondary
              : isUrgent
                ? theme.warning
                : theme.secondary,
          }
        }
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

  // Show gray background when there's status indicator, timer, or when the
  // savant-free session fill is visible (otherwise the fill would float over
  // transparent space).
  const hasContent =
    statusIndicatorContent !== null ||
    elapsedTimeContent !== null ||
    sessionProgress !== null

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
      {sessionProgress !== null && (
        <box
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            // Fill anchors left and shrinks as time passes — the draining
            // bar is the countdown; no separate numeric readout needed.
            width: `${sessionProgress.fraction * 100}%`,
            backgroundColor: theme.surfaceHover,
          }}
        />
      )}
      <box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 0,
        }}
      >
        {statusIndicatorContent !== null && (
          <text
            fg={statusIndicatorContent.color}
            style={{ wrapMode: 'none' }}
          >
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
        {onEndSession &&
          statusIndicatorState.kind === 'idle' &&
          savantFreeSession?.status === 'active' && (
            <StatusActionButton onClick={onEndSession} shortcut="End" label="session" />
          )}
        {sessionProgress !== null &&
          sessionProgress.remainingMs < SAVANT_FREE_COUNTDOWN_VISIBLE_MS &&
          statusIndicatorState.kind !== 'idle' &&
          !isUnlimited && (
            <text
              fg={theme.warning}
              style={{ wrapMode: 'none' }}
              attributes={TextAttributes.BOLD}
            >
              {formatSavantFreeSessionCountdown(sessionProgress.remainingMs)}
            </text>
          )}
      </box>
    </box>
  )
}
