// FID-2026-0901-006 P17 — PhaseStepper live-activity chip tests.

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { PhaseStepper } from '../PhaseStepper'

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
}

describe('PhaseStepper', () => {
  test('renders all FSM chips', () => {
    const out = html(<PhaseStepper phase={null} />)
    for (const name of [
      'idle',
      'red',
      'green',
      'audit',
      'adversarial',
      'self_correct',
      'complete',
    ]) {
      expect(out).toContain(name)
    }
  })

  test('lights the matching FSM chip only (G2 — no guess)', () => {
    const out = html(<PhaseStepper phase="red" />)
    expect(out).toContain('fsm-chip fsm-active')
    // The live-activity chip is suppressed while an FSM phase is engaged.
    expect(out).not.toContain('fsm-activity')
  })

  test('lights idle while the system is at rest (P20 — no dark rail)', () => {
    const out = html(<PhaseStepper phase={null} />)
    // idle renders as an active chip on its own (resting state)…
    expect(out).toContain('fsm-chip fsm-active fsm-idle')
    // …and no other phase chip is active.
    expect(out).not.toContain('fsm-chip fsm-active"')
    const activeCount = (out.match(/fsm-active/g) ?? []).length
    expect(activeCount).toBe(1)
  })

  test('shows a live-activity chip when no FSM phase is engaged (P17)', () => {
    const out = html(
      <PhaseStepper
        phase={null}
        activity={{ kind: 'tool', toolName: 'code_search', startedAt: 1 }}
      />,
    )
    expect(out).toContain('fsm-activity')
    expect(out).toContain('tool: code_search')
  })

  test('suppresses the activity chip when phase is present', () => {
    const out = html(
      <PhaseStepper
        phase="green"
        activity={{ kind: 'thinking', startedAt: 1 }}
      />,
    )
    expect(out).not.toContain('fsm-activity')
  })
})
