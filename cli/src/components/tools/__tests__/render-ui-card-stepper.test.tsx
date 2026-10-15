// RenderUIComponent — card and stepper widget rendering.
// Sibling of the Loop 332 decomposition (shared harness in
// render-ui-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { chatThemes } from '../../../utils/theme-system'
import { RenderUIComponent } from '../render-ui'
import { createToolBlock, renderOptions } from './render-ui-test-harness'

describe('RenderUIComponent - card widget (FID summaries)', () => {
  test('renders a card with title, summary, and body', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'card',
          title: 'Visual Enhancement',
          summary: 'Wires Savant-UI to the agent output pipeline.',
          body: 'Extended render_ui schema from 1 to 6 widget types.',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toContain('Visual Enhancement')
    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('Visual Enhancement')
    expect(markup).toContain('Wires Savant-UI')
    expect(markup).toContain('Extended render_ui')
  })

  test('renders a card with severity and status', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'card',
          title: 'FID-017',
          status: 'closed',
          severity: 'critical',
          summary: 'Critical visual feedback system.',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('FID-017')
    expect(markup).toContain('closed')
    expect(markup).toContain('critical')
  })

  test('renders a card with no optional fields', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'card',
          title: 'Minimal',
          summary: 'Just title and summary.',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('Minimal')
    expect(markup).toContain('Just title and summary')
  })
})

describe('RenderUIComponent - stepper widget (Perfection Loop phases)', () => {
  test('renders a stepper with all ECHO phases', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'stepper',
          steps: [
            { label: 'RED' },
            { label: 'GREEN' },
            { label: 'AUDIT' },
            { label: 'FIX' },
            { label: 'DONE' },
          ],
          current: 1,
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('stepper: 5 steps')
    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('RED')
    expect(markup).toContain('GREEN')
    expect(markup).toContain('AUDIT')
    expect(markup).toContain('FIX')
    expect(markup).toContain('DONE')
  })

  test('renders a stepper with explicit step statuses', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'stepper',
          steps: [
            { label: 'A', status: 'done' },
            { label: 'B', status: 'active' },
            { label: 'C', status: 'pending' },
          ],
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('A')
    expect(markup).toContain('B')
    expect(markup).toContain('C')
  })

  test('renders a stepper with a single step', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'stepper',
          steps: [{ label: 'SOLO' }],
          current: 0,
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('stepper: 1 steps')
    expect(result.content).toBeDefined()
  })
})
