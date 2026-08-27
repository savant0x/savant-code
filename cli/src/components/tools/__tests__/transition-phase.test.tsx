import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
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

describe('TransitionPhaseComponent (glow-frame redesign)', () => {
  test('renders a rounded phase-colored frame with label + reason', () => {
    const markup = renderTransition({
      phase: 'green',
      reason: 'All issues fixed',
    })

// Rounded border panel chrome, border tinted with the phase color.
    // Static markup cannot draw OpenTUI border glyphs; 'rounded' matches the
    // serialized borderstyle attribute (smoke-level pin for the prop itself).
    expect(markup).toContain('rounded')
    expect(markup).toContain(theme.success)
    expect(markup).toContain('PHASE // GREEN')
    expect(markup).toContain('All issues fixed')
    // Panel sits on the surface background — no inverted white-on-fill text.
    expect(markup).toContain(theme.surface)
  })

  test('carries the dim SAVANT CODE brand on the same row as the label', () => {
    const markup = renderTransition({ phase: 'green', reason: 'Fix applied' })
    expect(markup).toContain('SAVANT CODE')
    expect(markup).toContain(theme.muted)
  })

  test('renders the phase glyph from the shared phase mapping', () => {
    const markup = renderTransition({ phase: 'audit', reason: 'Verifying' })
    // phaseMapping('audit') → phaseAudit glyph; default tier is Unicode.
    expect(markup).toContain(glyph(phaseMapping('audit').glyph))
    expect(markup).toContain('PHASE // AUDIT')
  })

  test('carries the phase color as light only (border + bold label)', () => {
    const markup = renderTransition({ phase: 'green', reason: 'Fix applied' })
    expect(markup).toContain(theme.success)
  })

  test('renders the adversarial phase with its own violet color (not RED)', () => {
    const markup = renderTransition({
      phase: 'adversarial',
      reason: 'Re-audit',
    })
    expect(markup).toContain('PHASE // ADVERSARIAL')
    expect(markup).toContain('Re-audit')
    // ADVERSARIAL does not share RED's error color (FID-009 Loop 5).
    expect(markup).toContain(theme.phaseAdversarial)
    expect(markup).not.toContain(theme.error)
  })

  test('idle renders in the muted gray (dim signal, same structure)', () => {
    const markup = renderTransition({ phase: 'idle', reason: 'Waiting' })
    expect(markup).toContain('PHASE // IDLE')
    expect(markup).toContain('Waiting')
    // Light-only redesign: idle's muted gray is the border + label color.
    expect(markup).toContain(theme.muted)
  })

  test('red phase uses the error color without inverted white-on-fill text', () => {
    const markup = renderTransition({ phase: 'red', reason: 'Issue found' })
    expect(markup).toContain('PHASE // RED')
    expect(markup).toContain(theme.error)
    // Light-only redesign: no white/black inversion on fills.
    expect(markup).not.toContain('#ffffff')
  })

  test('uses the short label for self_correct (FIX, not SELF_CORRECT)', () => {
    const markup = renderTransition({
      phase: 'self_correct',
      reason: 'Addressing audit findings',
    })
    expect(markup).toContain('PHASE // FIX')
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