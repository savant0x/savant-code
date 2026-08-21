import { TextAttributes } from '@opentui/core'
import { useState } from 'react'

import { Button } from './button'
import { CopyButton } from './copy-button'
import {
  buildTerminalCopyText,
  computeTerminalDisplayOutput,
  getTerminalStatus,
} from './terminal-status-utils'
import { TrafficLights } from './traffic-lights'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { formatTimeout } from '../utils/format-timeout'

// Re-export the pure helpers from the original path (focused-test call-graph).
export {
  GLOW_BRIGHTNESS,
  GLOW_BRIGHT_ANCHOR,
  GLOW_CYCLE_MS,
  TRAFFIC_LIGHT_COLOR_KEYS,
  buildTerminalCopyText,
  getTerminalStatus,
  trafficLightFg,
  type TerminalCopyTextParts,
  type TerminalStatus,
  type TerminalStatusColorKey,
} from './terminal-status-utils'

interface TerminalCommandDisplayProps {
  command: string
  output: string | null
  /** Whether to show an expandable "Show more" button for long output */
  expandable?: boolean
  /** Max lines to show before truncation (default 5 for expandable, 10 for non-expandable) */
  maxVisibleLines?: number
  /** Whether command is still running */
  isRunning?: boolean
  /** Working directory where the command was run */
  cwd?: string
  /** Timeout in seconds for the command */
  timeoutSeconds?: number
  /** Optional width override for wrapping calculations */
  availableWidth?: number
  /** Exit code of the command: 0 = success, non-zero = failure, null = signal/timeout, undefined = no result yet */
  exitCode?: number | null
}

/**
 * Shared bordered terminal panel used by the ghost message and message history.
 * Rich Terminal redesign (FID-2026-0816-011) + panel-owned copy footer
 * (FID-2026-0817-001): traffic-light title bar, command row + status badge,
 * meta pills, line-numbered gutter, and an expand/collapse toggle.
 */
export const TerminalCommandDisplay = ({
  command,
  output,
  expandable = true,
  maxVisibleLines,
  isRunning = false,
  cwd,
  timeoutSeconds,
  availableWidth,
  exitCode,
}: TerminalCommandDisplayProps) => {
  const theme = useTheme()
  const { separatorWidth } = useTerminalDimensions()
  const [isExpanded, setIsExpanded] = useState(false)

  // Default max lines depends on whether expandable
  const defaultMaxLines = expandable ? 5 : 10
  const maxLines = maxVisibleLines ?? defaultMaxLines

  // Format timeout display - show when provided and not the default (30s)
  const DEFAULT_TIMEOUT_SECONDS = 30
  const timeoutLabel =
    timeoutSeconds !== undefined && timeoutSeconds !== DEFAULT_TIMEOUT_SECONDS
      ? formatTimeout(timeoutSeconds)
      : null

  // Status badge logic based on exitCode + running state.
  const status = getTerminalStatus(exitCode, isRunning)
  const statusBadge = status
    ? { char: status.char, word: status.word, color: theme[status.colorKey] }
    : null

  // Plain-text status for the copy footer (mirrors the rendered badge label).
  const statusLabel = status ? `${status.char} ${status.word}` : null

  // Copy text = the entire block: command line + status/meta line + raw output.
  const copyText = buildTerminalCopyText({
    command,
    output,
    statusLabel,
    cwd,
    timeoutLabel,
  })

  // Line-number gutter is only shown when there's enough room
  const width = Math.max(10, availableWidth ?? separatorWidth)
  const showGutter = width >= 50

  // Command header - shared between output and no-output cases
  const commandHeader = (
    <text style={{ wrapMode: 'word' }}>
      <span fg={theme.success}>$ </span>
      <span fg={theme.foreground} attributes={TextAttributes.BOLD}>
        {command}
      </span>
      {timeoutLabel && (
        <span fg={theme.muted} attributes={TextAttributes.DIM}>
          {' '}
          ({timeoutLabel})
        </span>
      )}
    </text>
  )

  // Title bar — traffic lights, right-aligned, glowing.
  const titleBar = (
    <box
      style={{
        width: '100%',
        paddingLeft: 1,
        paddingRight: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
      }}
    >
      <TrafficLights />
    </box>
  )

  // Copy footer — right-aligned, hidden while the command is still running.
  const copyFooter = !isRunning ? (
    <box
      style={{
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      <CopyButton textToCopy={copyText} leadingSpace={false} />
    </box>
  ) : null

  // No output case
  if (!output) {
    return (
      <box
        style={{
          width: '100%',
          flexDirection: 'column',
          backgroundColor: theme.surface,
          border: true,
          borderStyle: 'rounded',
          borderColor: theme.border,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 0,
          paddingBottom: 0,
        }}
      >
        {titleBar}
        {/* Command row. */}
        <box
          style={{
            width: '100%',
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          {commandHeader}
        </box>
        {/* Status / running indicator. */}
        <box
          style={{
            width: '100%',
            paddingLeft: 1,
            paddingRight: 1,
            paddingBottom: 0,
          }}
        >
          {statusBadge && (
            <text fg={statusBadge.color} attributes={TextAttributes.BOLD}>
              {statusBadge.char} {statusBadge.word}
            </text>
          )}
          {isRunning && !statusBadge && <text fg={theme.muted}>...</text>}
        </box>
        {copyFooter}
      </box>
    )
  }

  // With output — truncation math is a pure function in terminal-status-utils
  const { displayOutput, hasMoreLines, hiddenLinesCount } =
    computeTerminalDisplayOutput({
      output,
      width,
      showGutter,
      maxLines,
      isExpanded,
    })

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        backgroundColor: theme.surface,
        border: true,
        borderStyle: 'rounded',
        borderColor: theme.border,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {titleBar}
      {/* Command row. */}
      <box
        style={{
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        {commandHeader}
      </box>
      {/* Meta row — status badge + cwd + timeout pills. */}
      <box
        style={{
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ wrapMode: 'word' }}>
          {statusBadge && (
            <>
              <span fg={statusBadge.color} attributes={TextAttributes.BOLD}>
                {statusBadge.char}
              </span>{' '}
              <span fg={theme.muted}>{statusBadge.word}</span>
            </>
          )}
          {cwd && (
            <span fg={theme.muted}>
              {statusBadge ? '   ' : ''}📁 {cwd}
            </span>
          )}
          {timeoutLabel && (
            <span fg={theme.muted}>
              {statusBadge || cwd ? '   ' : ''}⏱ {timeoutLabel}
            </span>
          )}
        </text>
      </box>
      {/* Output body. */}
      <box
        style={{
          flexDirection: 'column',
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
          paddingBottom: 0,
        }}
      >
        {hasMoreLines && !expandable && (
          <text fg={theme.muted} attributes={TextAttributes.DIM}>
            ... ({hiddenLinesCount} more lines above)
          </text>
        )}
        <text fg={theme.muted} style={{ wrapMode: 'word' }}>
          {displayOutput}
        </text>
        {hasMoreLines && expandable && (
          <Button
            style={{ marginTop: 0 }}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <text fg={theme.secondary} style={{ wrapMode: 'word' }}>
              {isExpanded
                ? 'Show less'
                : `Show ${hiddenLinesCount} more ${hiddenLinesCount === 1 ? 'line' : 'lines'}`}
            </text>
          </Button>
        )}
      </box>
      {copyFooter}
    </box>
  )
}
