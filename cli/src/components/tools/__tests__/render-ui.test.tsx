// RenderUIComponent — button and table widget rendering.
// Parent of the Loop 332 decomposition (card/stepper, badge/perfection-loop,
// and edge-case suites live in sibling files; shared harness in
// render-ui-test-harness).

import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { chatThemes } from '../../../utils/theme-system'
import { RenderUIComponent } from '../render-ui'
import { createToolBlock, renderOptions } from './render-ui-test-harness'

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
})
