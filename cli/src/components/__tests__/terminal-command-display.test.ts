import { describe, expect, test } from 'bun:test'

import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { blendHex } from '../../utils/diff-stats'
import {
  buildTerminalCopyText,
  getTerminalStatus,
  TRAFFIC_LIGHT_COLOR_KEYS,
  trafficLightFg,
} from '../terminal-command-display'

initializeThemeStore()

const theme = useThemeStore.getState().theme
const trafficColors = [theme.success, theme.warning, theme.error]

describe('getTerminalStatus (FID-2026-0817-001)', () => {
  test('exit code 0 resolves to success', () => {
    expect(getTerminalStatus(0, false)).toEqual({
      char: '✓',
      word: 'success',
      colorKey: 'success',
    })
  })

  test('non-zero exit code resolves to failure', () => {
    expect(getTerminalStatus(1, false)).toEqual({
      char: '✗',
      word: 'failed',
      colorKey: 'error',
    })
  })

  test('null exit code (signal/timeout) resolves to failure', () => {
    expect(getTerminalStatus(null, false)).toEqual({
      char: '✗',
      word: 'failed',
      colorKey: 'error',
    })
  })

  test('undefined exit code while running resolves to running', () => {
    expect(getTerminalStatus(undefined, true)).toEqual({
      char: '⏳',
      word: 'running',
      colorKey: 'warning',
    })
  })

  test('undefined exit code when not running resolves to null', () => {
    expect(getTerminalStatus(undefined, false)).toBeNull()
  })
})

describe('buildTerminalCopyText (FID-2026-0817-001)', () => {
  test('copies the entire block: command + status/meta + raw output', () => {
    const copyText = buildTerminalCopyText({
      command: 'grep -rn foo .',
      output: 'a.ts:1:foo\nb.ts:2:foo',
      statusLabel: '✓ success',
      cwd: '/proj',
      timeoutLabel: '30s',
    })

    expect(copyText).toBe(
      '$ grep -rn foo .\n\n✓ success   📁 /proj   ⏱ 30s\n\na.ts:1:foo\nb.ts:2:foo',
    )
  })

  test('omits the meta line entirely when no status/cwd/timeout', () => {
    const copyText = buildTerminalCopyText({
      command: 'ls',
      output: 'file1',
      statusLabel: null,
      timeoutLabel: null,
    })

    expect(copyText).toBe('$ ls\n\nfile1')
  })

  test('copies command + status when there is no output', () => {
    const copyText = buildTerminalCopyText({
      command: 'ls',
      output: null,
      statusLabel: '✓ success',
      timeoutLabel: null,
    })

    expect(copyText).toBe('$ ls\n\n✓ success')
  })

  test('copies the raw output verbatim — no line-number gutter, no title bar', () => {
    const copyText = buildTerminalCopyText({
      command: 'cat file',
      output: 'line1\nline2',
      statusLabel: '✓ success',
      timeoutLabel: null,
    })

    // The gutter would alter the string (" 1 │ line1"); verbatim equality proves
    // the raw output is copied un-guttered, and the title-bar dots never appear.
    expect(copyText).toBe('$ cat file\n\n✓ success\n\nline1\nline2')
    expect(copyText).not.toContain('●')
  })
})

describe('trafficLightFg (FID-2026-0817-001)', () => {
  test('returns static base colors when suspended', () => {
    expect(trafficLightFg(0, 0.5, trafficColors, true)).toBe(theme.success)
    expect(trafficLightFg(1, 0.5, trafficColors, true)).toBe(theme.warning)
    expect(trafficLightFg(2, 0.5, trafficColors, true)).toBe(theme.error)
  })

  test('stagger offsets each dot from its neighbors at the same phase', () => {
    const green = trafficLightFg(0, 0.5, trafficColors, false)
    const yellow = trafficLightFg(1, 0.5, trafficColors, false)
    const red = trafficLightFg(2, 0.5, trafficColors, false)
    expect(green).not.toBe(yellow)
    expect(yellow).not.toBe(red)
    expect(red).not.toBe(green)
  })

  test('brightens toward white at the glow peak (not the base color)', () => {
    const peak = trafficLightFg(0, 0.5, trafficColors, false)
    expect(peak).toBe(blendHex(theme.success, '#ffffff', 0.35))
    expect(peak).not.toBe(theme.success)
  })

  test('returns the base color at the glow trough (phase 0)', () => {
    expect(trafficLightFg(0, 0, trafficColors, false)).toBe(theme.success)
  })

  test('stays continuous at the phase wrap (phase 1 == phase 0)', () => {
    expect(trafficLightFg(0, 1, trafficColors, false)).toBe(
      trafficLightFg(0, 0, trafficColors, false),
    )
  })
})

describe('TRAFFIC_LIGHT_COLOR_KEYS (FID-2026-0817-001)', () => {
  test('dots are ordered green → yellow → red', () => {
    expect(TRAFFIC_LIGHT_COLOR_KEYS).toEqual(['success', 'warning', 'error'])
  })
})
