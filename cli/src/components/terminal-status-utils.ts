import { blendHex } from '../utils/diff-stats'
import { getLastNVisualLines } from '../utils/text-layout'

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
export const GLOW_BRIGHT_ANCHOR = '#ffffff'
/** How far the glow brightens toward the anchor (0..1 blend). */
export const GLOW_BRIGHTNESS = 0.35
/** Full brightness pulse cycle (0 → 1 phase) in ms — ~1.2 s up + ~1.2 s down. */
export const GLOW_CYCLE_MS = 2400

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

export interface TerminalDisplayOutput {
  displayOutput: string
  hasMoreLines: boolean
  hiddenLinesCount: number
  gutterWidth: number
  contentWidth: number
}

/**
 * Compute the truncated display output for a terminal block: wraps each
 * original line to `contentWidth` visual lines, then takes the first
 * `maxLines` with an optional line-number gutter. Pure — no component state.
 */
export function computeTerminalDisplayOutput(params: {
  output: string
  width: number
  showGutter: boolean
  maxLines: number
  isExpanded: boolean
}): TerminalDisplayOutput {
  const { output, width, showGutter, maxLines, isExpanded } = params
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

  return {
    displayOutput,
    hasMoreLines,
    hiddenLinesCount,
    gutterWidth,
    contentWidth,
  }
}
