import { TextAttributes } from '@opentui/core'
import { useState } from 'react'

import { Button } from './button'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { formatTimeout } from '../utils/format-timeout'
import { getLastNVisualLines } from '../utils/text-layout'

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
 * Shared component for displaying terminal command with output.
 * Used in both the ghost message (pending bash) and message history.
 *
 * Rich Terminal redesign (FID-2026-0816-011): a bordered rounded panel with
 * decorative traffic-light title bar, command row + status badge, meta row
 * (cwd/timeout pills), line-numbered output gutter, and a clean terminal-style
 * expand/collapse toggle.
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

  // Status badge logic based on exitCode
  const statusBadge = (() => {
    if (exitCode === 0) return { char: '✓', color: theme.success }
    if (exitCode !== undefined) return { char: '✗', color: theme.error }
    if (isRunning) return { char: '⏳', color: theme.warning }
    return null
  })()

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
        {/* Title bar — decorative traffic lights. */}
        <box
          style={{
            width: '100%',
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <text fg={theme.muted} attributes={TextAttributes.DIM}>
            ● ● ●
          </text>
        </box>
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
              {statusBadge.char}{' '}
              {exitCode === 0
                ? 'success'
                : exitCode !== undefined
                  ? 'failed'
                  : 'running'}
            </text>
          )}
          {isRunning && !statusBadge && <text fg={theme.muted}>...</text>}
        </box>
      </box>
    )
  }

  // With output - calculate visual lines
  const allLines = output.split('\n')

  // Calculate the gutter width based on line count
  const gutterWidth = showGutter ? String(allLines.length).length + 2 : 0
  const contentWidth = Math.max(10, width - gutterWidth)

  // Calculate total visual lines across all output lines
  let totalVisualLines = 0
  const visualLinesByOriginalLine: string[][] = []

  for (const line of allLines) {
    const { lines: wrappedLines } = getLastNVisualLines(
      line,
      contentWidth,
      Infinity,
    )
    visualLinesByOriginalLine.push(wrappedLines)
    totalVisualLines += wrappedLines.length
  }

  const hasMoreLines = totalVisualLines > maxLines
  const hiddenLinesCount = totalVisualLines - maxLines

  // Build display output with optional line numbers
  let displayOutput: string
  if (isExpanded || !hasMoreLines) {
    displayOutput = output
  } else {
    // Take first N visual lines
    const displayLines: string[] = []
    let count = 0
    let lineNumber = 1

    for (let i = 0; i < visualLinesByOriginalLine.length; i++) {
      const wrappedLines = visualLinesByOriginalLine[i]
      for (let j = 0; j < wrappedLines.length; j++) {
        if (count >= maxLines) break
        const prefix =
          showGutter && j === 0
            ? `${String(lineNumber).padStart(gutterWidth - 2)} │ `
            : showGutter
              ? ' '.repeat(gutterWidth)
              : ''
        displayLines.push(prefix + wrappedLines[j])
        count++
      }
      if (count >= maxLines) break
      lineNumber++
    }

    displayOutput = displayLines.join('\n')
  }

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
      {/* Title bar — decorative traffic lights. */}
      <box
        style={{
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text fg={theme.muted} attributes={TextAttributes.DIM}>
          ● ● ●
        </text>
      </box>
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
              <span fg={theme.muted}>
                {exitCode === 0
                  ? 'success'
                  : exitCode !== undefined
                    ? 'failed'
                    : 'running'}
              </span>
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
    </box>
  )
}
