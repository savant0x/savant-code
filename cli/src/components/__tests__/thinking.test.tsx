import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { Thinking } from '../thinking'
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

mockOpentuiReactForStaticRender()
initializeThemeStore()

// FID-2026-0822-010: the reasoning preview wraps its lines inside the
// TrafficLightPanel chrome. At availableWidth 38 (a 90-col transcript's
// message-level panel interior) the panel text area is
// 38 - TRAFFIC_PANEL_WIDTH_ALLOWANCE (4) = 34 columns, and the first preview
// row may additionally carry the '...' prefix (3) — so no rendered row may
// exceed 34 columns.
const PANEL_TEXT_AREA_WIDTH = 38 - 4

describe('Thinking reasoning panel (FID-2026-0822-010)', () => {
  const noopToggle = () => {}

  // The preview text node carries the italic attribute group (attributes="4");
  // extract its inner text so width assertions measure the wrapped rows, not
  // the surrounding OpenTUI markup.
  const previewText = (markup: string): string => {
    const match = markup.match(/attributes="4">([\s\S]*?)<\/text>/)
    return match?.[1] ?? ''
  }

  const previewRows = (markup: string): string[] =>
    previewText(markup)
      .split('\n')
      .filter((row) => row.length > 0)

  test('preview state renders the reasoning label + rows inside the chrome', () => {
    const content = 'The smoke test is done and FSM is back to idle.'
    const markup = renderToStaticMarkup(
      <Thinking
        content={content}
        thinkingCollapseState="preview"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    expect(markup).toContain('reasoning')
    expect(markup).toContain('●') // traffic-lights title bar
    expect(previewText(markup).replace(/\s+/g, ' ').trim()).toContain(content)
  })

  test('preview rows never exceed the panel text area width (no border flush)', () => {
    const content =
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega'
    const markup = renderToStaticMarkup(
      <Thinking
        content={content}
        thinkingCollapseState="preview"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    const rows = previewRows(markup)
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.length).toBeLessThanOrEqual(PANEL_TEXT_AREA_WIDTH)
    }
  })

  test('oversize tokens in preview get an ellipsis marker instead of a bare word cut', () => {
    const content = `short intro ${'https://example.com/very-long-unbroken-token-'.repeat(3)}x tail words follow`
    const markup = renderToStaticMarkup(
      <Thinking
        content={content}
        thinkingCollapseState="preview"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    expect(markup).toContain('…')
    // Every preview row stays inside the text area even with markers.
    for (const row of previewRows(markup)) {
      expect(row.length).toBeLessThanOrEqual(PANEL_TEXT_AREA_WIDTH)
    }
  })

  test('cleanly wrapped preview content gets no ellipsis markers', () => {
    const content =
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau'
    const markup = renderToStaticMarkup(
      <Thinking
        content={content}
        thinkingCollapseState="preview"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    expect(markup).not.toContain('…')
  })

  test('expanded state renders the full content', () => {
    const content =
      'First paragraph of reasoning.\n\nSecond paragraph with more detail.'
    const markup = renderToStaticMarkup(
      <Thinking
        content={content}
        thinkingCollapseState="expanded"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    expect(markup).toContain('▾') // expanded toggle
    expect(markup).toContain(content)
  })

  test('single short bold string renders compactly (nothing to show)', () => {
    const markup = renderToStaticMarkup(
      <Thinking
        content="**Done**"
        thinkingCollapseState="preview"
        isThinkingComplete={true}
        onToggle={noopToggle}
        availableWidth={38}
      />,
    )

    expect(markup).toBe('')
  })
})
