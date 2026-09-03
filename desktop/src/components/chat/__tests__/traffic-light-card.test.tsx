// P21 — traffic-light card chrome + session status panel tests.
// Pins the CLI-parity chrome wrappers so the design can't silently regress.

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { SessionStatusPanel } from '../SessionStatusPanel'
import { TrafficLightCard } from '../TrafficLightCard'
import { TrafficLights } from '../TrafficLights'

function html(node: React.ReactElement): string {
  return renderToStaticMarkup(node)
}

describe('TrafficLights', () => {
  test('renders three dots', () => {
    const out = html(<TrafficLights />)
    expect((out.match(/traffic-light-dot/g) ?? []).length).toBe(3)
  })

  test('P23: dots order green → yellow → red (CLI TRAFFIC_LIGHT_COLOR_KEYS)', () => {
    const out = html(<TrafficLights />)
    const colors = [
      ...out.matchAll(/background:(var\(--(?:success|warning|error)\))/g),
    ].map((m) => m[1])
    expect(colors).toEqual(['var(--success)', 'var(--warning)', 'var(--error)'])
  })

  test('P23: the dim state is gone — CLI lights never dim', () => {
    const out = html(<TrafficLights />)
    expect(out).not.toContain('traffic-lights-dim')
    // Every dot keeps its full-brightness glow (the breathing itself lives
    // in styles.css, staggered per dot — same 2400ms cycle as the CLI).
    expect((out.match(/box-shadow:0 0 6px/g) ?? []).length).toBe(3)
  })
})

describe('TrafficLightCard', () => {
  test('wraps content with a traffic-light title bar and a label', () => {
    const out = html(
      <TrafficLightCard label="response">
        <div className="blk-text">hello</div>
      </TrafficLightCard>,
    )
    expect(out).toContain('tl-card')
    expect(out).toContain('tl-card-bar')
    expect(out).toContain('tl-card-label')
    expect(out).toContain('response')
    expect(out).toContain('blk-text')
    expect((out.match(/traffic-light-dot/g) ?? []).length).toBe(3)
  })

  test('applies the tone class', () => {
    expect(
      html(
        <TrafficLightCard label="x" tone="error">
          <div />
        </TrafficLightCard>,
      ),
    ).toContain('tl-card-error')
  })
})

describe('SessionStatusPanel', () => {
  test('renders no blank Model/Context rows when the store is empty (P21)', () => {
    const out = html(
      <SessionStatusPanel
        model={null}
        phase={null}
        running={false}
        activity={null}
        compaction={null}
      />,
    )
    // No blank junk rows — only the state row + an honest empty hint.
    expect(out).toContain('State')
    expect(out).toContain('Idle')
    expect(out).toContain('session-status-empty')
    // No '—' placeholders for model/context/phase.
    expect(out).not.toContain('Model')
    expect(out).not.toContain('Context')
    expect(out).not.toContain('Phase')
  })

  test('populates model, context tracker, and phase when present', () => {
    const out = html(
      <SessionStatusPanel
        model="openrouter/free"
        phase="red"
        running
        activity={{ kind: 'thinking', startedAt: 1 }}
        compaction={{
          type: 'compaction_status',
          phase: 'idle',
          percentUsed: 42,
          contextTokens: 84000,
          windowTokens: 200000,
        }}
      />,
    )
    expect(out).toContain('Model')
    expect(out).toContain('OpenRouter Free')
    expect(out).toContain('Context')
    expect(out).toContain('42%')
    expect(out).toContain('84k/200k')
    expect(out).toContain('Phase')
    expect(out).toContain('red')
    // The empty hint is suppressed once telemetry is present.
    expect(out).not.toContain('session-status-empty')
  })
})
