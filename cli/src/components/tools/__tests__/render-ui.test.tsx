import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../hooks/use-theme'
import { chatThemes } from '../../../utils/theme-system'
import { RenderUIComponent } from '../render-ui'

import type { ToolBlock } from '../types'

initializeThemeStore()

const createToolBlock = (
  input: unknown,
): ToolBlock & { toolName: 'render_ui' } => ({
  type: 'tool',
  toolName: 'render_ui',
  toolCallId: 'test-render-ui-call-id',
  input,
})

const renderOptions = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 10,
}

describe('RenderUIComponent', () => {
  describe('button widget (existing)', () => {
    test('renders a button widget', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'button',
            text: 'Open preview',
            link: 'https://example.com/preview',
            variant: 'primary',
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.collapsedPreview).toBe(
        'Open preview -> https://example.com/preview',
      )
      expect(result.content).toBeDefined()
      expect(renderToStaticMarkup(<>{result.content}</>)).toContain(
        'Open preview',
      )
    })

    test('renders a secondary-variant button', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'button',
            text: 'Cancel',
            link: 'https://example.com/cancel',
            variant: 'secondary',
          },
        }),
        chatThemes.light,
        renderOptions,
      )
      expect(result.collapsedPreview).toContain('Cancel')
      expect(result.content).toBeDefined()
    })
  })

  describe('table widget', () => {
    test('renders a table with columns and rows', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'table',
            columns: [
              { key: 'id', label: 'ID' },
              { key: 'severity', label: 'Severity' },
            ],
            rows: [
              { id: 'FID-017', severity: 'critical' },
              { id: 'FID-016', severity: 'medium' },
            ],
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.collapsedPreview).toBe('table: 2 cols, 2 rows')
      expect(result.content).toBeDefined()
      const markup = renderToStaticMarkup(<>{result.content}</>)
      expect(markup).toContain('ID')
      expect(markup).toContain('Severity')
      expect(markup).toContain('FID-017')
      expect(markup).toContain('FID-016')
      expect(markup).toContain('critical')
      expect(markup).toContain('medium')
    })

    test('renders a table with a title', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'table',
            title: 'Open FIDs',
            columns: [{ key: 'name', label: 'Name' }],
            rows: [{ name: 'FID-017' }],
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeDefined()
      const markup = renderToStaticMarkup(<>{result.content}</>)
      expect(markup).toContain('Open FIDs')
    })

    test('renders a table with empty rows array (header still shows)', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'table',
            columns: [{ key: 'x', label: 'X' }],
            rows: [],
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.collapsedPreview).toBe('table: 1 cols, 0 rows')
      expect(result.content).toBeDefined()
      const markup = renderToStaticMarkup(<>{result.content}</>)
      expect(markup).toContain('X') // header still renders
    })

    test('handles missing row values gracefully (undefined -> empty string)', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'table',
            columns: [
              { key: 'a', label: 'A' },
              { key: 'b', label: 'B' },
            ],
            rows: [{ a: 'present' }],
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeDefined()
      const markup = renderToStaticMarkup(<>{result.content}</>)
      expect(markup).toContain('present')
      // Missing 'b' key should not crash; should render as empty
      expect(markup).not.toContain('undefined')
    })
  })

  describe('card widget (FID summaries)', () => {
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

  describe('stepper widget (Perfection Loop phases)', () => {
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

  describe('badge widget', () => {
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
      const variants = ['open', 'closed', 'critical', 'high', 'medium', 'low', 'info', 'success', 'warning', 'error'] as const
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

  describe('perfection_loop widget', () => {
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

  describe('edge cases', () => {
    test('returns no content for unsupported widget types', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'slider',
            text: 'Volume',
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('returns no content when widget is missing', () => {
      const result = RenderUIComponent.render(
        createToolBlock({}),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('returns no content when widget is null', () => {
      const result = RenderUIComponent.render(
        createToolBlock({ widget: null }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('returns no content when widget is not an object', () => {
      const result = RenderUIComponent.render(
        createToolBlock({ widget: 'string' }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('returns no content when widget has no type field', () => {
      const result = RenderUIComponent.render(
        createToolBlock({ widget: { text: 'no type' } }),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('returns no content when input is undefined', () => {
      const result = RenderUIComponent.render(
        createToolBlock(undefined),
        chatThemes.light,
        renderOptions,
      )

      expect(result.content).toBeNull()
    })

    test('treats a malformed button (missing link) as unknown widget', () => {
      const result = RenderUIComponent.render(
        createToolBlock({
          widget: {
            type: 'button',
            text: 'No link',
            // link missing
          },
        }),
        chatThemes.light,
        renderOptions,
      )

      // isRenderUIButtonWidget returns false (link required), and no other
      // widget matches type 'button', so we fall through to null.
      expect(result.content).toBeNull()
    })
  })
})
