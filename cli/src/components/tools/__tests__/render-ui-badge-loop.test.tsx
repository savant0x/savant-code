// RenderUIComponent — badge and perfection_loop widget rendering.
// Sibling of the Loop 332 decomposition (shared harness in
// render-ui-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { chatThemes } from '../../../utils/theme-system'
import { RenderUIComponent } from '../render-ui'
import { createToolBlock, renderOptions } from './render-ui-test-harness'

describe('RenderUIComponent - badge widget', () => {
  test('renders a badge with text', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'badge',
          variant: 'critical',
          text: 'FID-017',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('[FID-017]')
    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('FID-017')
  })

  test('renders a badge with default variant', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'badge',
          text: 'open',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('[open]')
    expect(result.content).toBeDefined()
  })

  test('renders a badge with all severity variants', () => {
    const variants = [
      'open',
      'closed',
      'critical',
      'high',
      'medium',
      'low',
      'info',
      'success',
      'warning',
      'error',
    ] as const
    for (const variant of variants) {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: { type: 'badge', variant, text: `test-${variant}` },
        }),
        chatThemes.light,
        renderOptions,
      )
      expect(result.content).toBeDefined()
      expect(result.collapsedPreview).toBe(`[test-${variant}]`)
    }
  })
})

describe('RenderUIComponent - perfection_loop widget', () => {
  test('renders a perfection loop with phase and iterations', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'perfection_loop',
          phase: 'green',
          iteration: 3,
          maxIterations: 10,
          fidName: 'FID-017',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('Perfection Loop: green')
    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('GREEN')
    expect(markup).toContain('iterations')
    expect(markup).toContain('3/10')
    expect(markup).toContain('FID-017')
  })

  test('renders a perfection loop with idle phase', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'perfection_loop',
          phase: 'idle',
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.collapsedPreview).toBe('Perfection Loop: idle')
    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('IDLE')
  })

  test('renders all 6 ECHO phases', () => {
    const phases = ['idle', 'red', 'green', 'audit', 'self_correct', 'complete']
    for (const phase of phases) {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: { type: 'perfection_loop', phase },
        }),
        chatThemes.light,
        renderOptions,
      )
      expect(result.content).toBeDefined()
      expect(result.collapsedPreview).toBe(`Perfection Loop: ${phase}`)
      const markup = renderToStaticMarkup(<>{result.content}</>)
      expect(markup).toContain(phase.toUpperCase())
    }
  })

  test('renders a perfection loop without fidName', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'perfection_loop',
          phase: 'audit',
          iteration: 5,
          maxIterations: 10,
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('AUDIT')
    expect(markup).toContain('5/10')
    expect(markup).not.toContain('FID:')
  })

  test('handles zero iterations and maxIterations', () => {
    const result = RenderUIComponent.render(
      createToolBlock({
        widget: {
          type: 'perfection_loop',
          phase: 'red',
          iteration: 0,
          maxIterations: 10,
        },
      }),
      chatThemes.light,
      renderOptions,
    )

    expect(result.content).toBeDefined()
    const markup = renderToStaticMarkup(<>{result.content}</>)
    expect(markup).toContain('0/10')
  })
})
