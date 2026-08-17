import { TextAttributes } from '@opentui/core'
import { useEffect, useRef, useState } from 'react'

import { Button } from './button'
import { CopyButton } from './copy-button'
import { useAnimationBudget } from '../hooks/use-animation-budget'
import { useAnimationTimeline } from '../hooks/use-animation-timeline'
import { useTerminalDimensions } from '../hooks/use-terminal-dimensions'
import { useTheme } from '../hooks/use-theme'
import { blendHex } from '../utils/diff-stats'
import { formatTimeout } from '../utils/format-timeout'
import { getLastNVisualLines } from '../utils/text-layout'

import type { TextRenderable } from '@opentui/core'

// ============================================================================
// Pure helpers (exported for testing)
// ============================================================================

export type TerminalStatusColorKey = 'success' | 'error' | 'warning'

export interface TerminalStatus {
  char: string
  word: 'success' | 'failed' | 'running'
  colorKey: TerminalStatusColorKey
}

/**
 * Traffic-light dot order: green → yellow → red (FID-2026-0817-001). The
 * semantic keys map onto the theme's `success`/`warning`/`error` colors.
 */
export const TRAFFIC_LIGHT_COLOR_KEYS = ['success', 'warning', 'error'] as const

/** Bright anchor the traffic-light glow blends toward. */
const GLOW_BRIGHT_ANCHOR = '#ffffff'
/** How far the glow brightens toward the anchor (0..1 blend). */
const GLOW_BRIGHTNESS = 0.35
/** Full brightness pulse cycle (0 → 1 phase) in ms — ~1.2 s up + ~1.2 s down. */
const GLOW_CYCLE_MS = 2400

/**
 * Resolve the terminal run status (char + word + color key) from the exit code
 * and running flag. Single source of truth shared by the status badge and the
 * copy-footer label.
 */
export function getTerminalStatus(
  exitCode: number | null | undefined,
  isRunning: boolean,
): TerminalStatus | null {
  if (exitCode === 0) return { char: '✓', word: 'success', colorKey: 'success' }
  if (exitCode !== undefined)
    return { char: '✗', word: 'failed', colorKey: 'error' }
  if (isRunning) return { char: '⏳', word: 'running', colorKey: 'warning' }
  return null
}

export interface TerminalCopyTextParts {
  command: string
  output: string | null
  statusLabel: string | null
  cwd?: string
  timeoutLabel: string | null
}

/**
 * Compose the copy text for the entire terminal block: the command line, the
 * status/meta line (status + cwd + timeout when present), and the raw output —
 * joined by newlines. Excludes the decorative traffic-light title bar and the
 * line-number gutter (FID-2026-0817-001).
 */
export function buildTerminalCopyText(parts: TerminalCopyTextParts): string {
  const metaLine = [
    parts.statusLabel,
    parts.cwd ? `📁 ${parts.cwd}` : null,
    parts.timeoutLabel ? `⏱ ${parts.timeoutLabel}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join('   ')
  return [`$ ${parts.command}`, metaLine, parts.output ?? '']
    .filter((part) => part !== '')
    .join('\n\n')
}

/**
 * Resolve a traffic-light dot's foreground color for a given animation phase.
 * When suspended, returns the static base color; otherwise blends toward the
 * bright anchor on a triangle wave, staggered by `index`.
 */
export function trafficLightFg(
  index: number,
  phase: number,
  baseColors: readonly string[],
  isSuspended: boolean,
): string {
  if (isSuspended) return baseColors[index]
  const wave = 1 - Math.abs(2 * ((phase + index / baseColors.length) % 1) - 1)
  return blendHex(baseColors[index], GLOW_BRIGHT_ANCHOR, wave * GLOW_BRIGHTNESS)
}

// ============================================================================
// Components
// ============================================================================

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
 * Decorative traffic lights — green/yellow/red dots (right-aligned by the
 * caller's title bar) that breathe a subtle brightness glow
 * (FID-2026-0817-001). Driven by the Phase 2 timeline engine (zero
 * `setInterval`), staggered per dot, and suspended to static dots under the
 * animation budget (blur/scissor-hidden).
 */
function TrafficLights() {
  const theme = useTheme()
  const [phase, setPhase] = useState(0)
  const timeline = useAnimationTimeline({
    loop: true,
    duration: Number.POSITIVE_INFINITY,
  })
  const rootRef = useRef<TextRenderable | null>(null)
  const { isSuspended } = useAnimationBudget(rootRef)

  useEffect(() => {
    setPhase(0)
    timeline.items.length = 0

    if (isSuspended) {
      timeline.pause()
      return
    }

    timeline.add(
      { phase: 0 },
      {
        phase: 1,
        duration: GLOW_CYCLE_MS,
        ease: 'linear',
        loop: true,
        onUpdate: (anim) => {
          setPhase(anim.targets[0]?.phase ?? 0)
        },
      },
    )
    timeline.restart()

    return () => {
      timeline.pause()
    }
  }, [timeline, isSuspended])

  const baseColors = TRAFFIC_LIGHT_COLOR_KEYS.map((key) => theme[key])

  return (
    <text ref={rootRef}>
      <span fg={trafficLightFg(0, phase, baseColors, isSuspended)}>●</span>
      <span> </span>
      <span fg={trafficLightFg(1, phase, baseColors, isSuspended)}>●</span>
      <span> </span>
      <span fg={trafficLightFg(2, phase, baseColors, isSuspended)}>●</span>
    </text>
  )
}

/**
 * Shared component for displaying terminal command with output.
 * Used in both the ghost message (pending bash) and message history.
 *
 * Rich Terminal redesign (FID-2026-0816-011): a bordered rounded panel with
 * decorative traffic-light title bar, command row + status badge, meta row
 * (cwd/timeout pills), line-numbered output gutter, and a clean terminal-style
 * expand/collapse toggle.
 *
 * FID-2026-0817-001 adds a panel-owned copy footer (copies the entire block:
 * command + status/meta + output) and recolors/right-aligns/glows the traffic
 * lights.
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
