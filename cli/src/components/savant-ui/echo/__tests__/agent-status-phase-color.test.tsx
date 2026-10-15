// FID-2026-1009-007 — the FSM phase line carries the phase's OWN color
// again. The pre-v0.0.5 sidebar rendered each phase in its own color; the
// rebuild left `AgentStatus` hardcoding `theme.muted` while
// `phase-info.ts` kept the per-phase colorKeys unused on this path.
// These pins fail if the phase line ever goes monochrome again.
import { RGBA, rgbToHex } from '@opentui/core'
import { describe, expect, test } from 'bun:test'

import {
  initializeThemeStore,
  useThemeStore,
} from '../../../../hooks/use-theme'
import { sidebarPhase, sidebarPhaseColor } from '../../../right-sidebar-display'
import { resolveThemeColor } from '../../icon-theme-keys'

initializeThemeStore()

/** Every FSM phase the sidebar can render, with its expected colorKey. */
const PHASES: ReadonlyArray<readonly [string, string]> = [
  ['idle', 'muted'],
  ['red', 'error'],
  ['green', 'success'],
  ['audit', 'warning'],
  ['adversarial', 'phaseAdversarial'],
  ['self_correct', 'warning'],
  ['complete', 'primary'],
]

describe('sidebarPhaseColor (FID-2026-1009-007)', () => {
  test('every phase resolves to its own theme color', () => {
    const theme = useThemeStore.getState().theme
    for (const [phase, colorKey] of PHASES) {
      // The pin: the phase maps to the EXPECTED key — compared through the
      // same resolver the helper uses, so a remapped key fails here.
      expect(sidebarPhaseColor(theme, phase)).toBe(
        resolveThemeColor(
          theme,
          colorKey as Parameters<typeof resolveThemeColor>[1],
        ),
      )
    }
  })

  test('the phases are visually distinct — not one muted line', () => {
    const theme = useThemeStore.getState().theme
    const colors = new Set(
      PHASES.map(([phase]) => sidebarPhaseColor(theme, phase)),
    )
    // idle/red/green/audit/adversarial/complete are six distinct colors
    // (self_correct shares audit's warning by design).
    expect(colors.size).toBeGreaterThanOrEqual(6)
    expect(colors.has(theme.error)).toBe(true)
    expect(colors.has(theme.success)).toBe(true)
    expect(colors.has(theme.warning)).toBe(true)
  })

  test('an unknown phase degrades to the idle color, never throws', () => {
    const theme = useThemeStore.getState().theme
    expect(sidebarPhaseColor(theme, 'not-a-phase')).toBe(theme.muted)
    expect(sidebarPhase('not-a-phase')).toBe('Unknown phase: not-a-phase')
  })

  test('the resolved colors are valid hex the renderer can parse', () => {
    const theme = useThemeStore.getState().theme
    for (const [phase] of PHASES) {
      const hex = sidebarPhaseColor(theme, phase)
      expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(rgbToHex(RGBA.fromHex(hex))).toBe(hex.toLowerCase())
    }
  })
})
