import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { blendHex } from '../../../utils/diff-stats'
import { glyph } from '../../../utils/glyphs'
import { phaseMapping } from '../../savant-ui/echo/phase-info'
import { TransitionPhaseComponent } from '../transition-phase'

import type { ChatTheme } from '../../../types/theme-system'

initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const options = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

function renderTransition(input: unknown): string {
  const config = TransitionPhaseComponent.render(
    {
      toolName: 'transition_phase',
      input,
      toolCallId: 'test-id',
      output: undefined,
    } as unknown as Parameters<typeof TransitionPhaseComponent.render>[0],
    theme,
    options,
  )
  return renderToStaticMarkup(<>{config.content}</>)
}

describe('TransitionPhaseComponent (FID-2026-0816-009)', () => {
  test('renders a full-width bordered bar with the SAVANT CODE header + phase label + reason', () => {
    const markup = renderTransition({
      phase: 'green',
      reason: 'All issues fixed',
    })

    expect(markup).toContain('SAVANT CODE')
    expect(markup).toContain('PHASE → GREEN')
    expect(markup).toContain('All issues fixed')
    // Bordered phase-colored notification chrome, not a bare text row.
    expect(markup).toContain('rounded')
    expect(markup).toContain('width')
  })

  test('renders the phase glyph from the shared phase mapping', () => {
    const markup = renderTransition({ phase: 'audit', reason: 'Verifying' })
    // phaseMapping('audit') → phaseAudit glyph; default tier is Unicode.
    expect(markup).toContain(glyph(phaseMapping('audit').glyph))
    expect(markup).toContain('PHASE → AUDIT')
  })

  test('renders the adversarial phase with its own violet color (not RED)', () => {
    const markup = renderTransition({
      phase: 'adversarial',
      reason: 'Re-audit',
    })
    expect(markup).toContain('PHASE → ADVERSARIAL')
    expect(markup).toContain('Re-audit')
    // ADVERSARIAL no longer shares RED's error color (FID-009 Loop 5).
    expect(markup).toContain(theme.phaseAdversarial)
    expect(markup).not.toContain(theme.error)
  })

  test('idle phase renders black text on the mid-tone gray fill', () => {
    const markup = renderTransition({ phase: 'idle', reason: 'Waiting' })
    expect(markup).toContain('PHASE → IDLE')
    expect(markup).toContain('Waiting')
    // Filled-chip design: the idle chip stays the approved mid-tone gray
    // (86% muted) with BLACK text — never muted-gray text on gray, which was
    // unreadable (operator feedback 2026-08-16).
    const idleFill = blendHex(theme.muted, theme.background, 0.14)
    expect(markup).toContain(idleFill)
    expect(markup).toContain('#000000')
    expect(markup).not.toContain(theme.muted)
  })

  test('red phase renders WHITE text on the solid error fill (black-on-red unreadable)', () => {
    const markup = renderTransition({ phase: 'red', reason: 'Issue found' })
    expect(markup).toContain('PHASE → RED')
    expect(markup).toContain(theme.error)
    // Operator spec: the only fill that gets white text is the red one.
    expect(markup).toContain('#ffffff')
    expect(markup).not.toContain('#000000')
  })

  test('bright phase fills (green) render black text', () => {
    const markup = renderTransition({ phase: 'green', reason: 'Fix applied' })
    expect(markup).toContain('PHASE → GREEN')
    expect(markup).toContain(theme.success)
    expect(markup).toContain('#000000')
    expect(markup).not.toContain('#ffffff')
  })

  test('uses the short label for self_correct (FIX, not SELF_CORRECT)', () => {
    const markup = renderTransition({
      phase: 'self_correct',
      reason: 'Addressing audit findings',
    })
    expect(markup).toContain('PHASE → FIX')
    expect(markup).not.toContain('SELF_CORRECT')
  })

  test('returns null content when phase is missing', () => {
    const config = TransitionPhaseComponent.render(
      {
        toolName: 'transition_phase',
        input: { reason: 'no phase' },
        toolCallId: 'test-id',
        output: undefined,
      } as unknown as Parameters<typeof TransitionPhaseComponent.render>[0],
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })
})
