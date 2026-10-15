import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { OutputResultComponent } from '../output-result'

import type { ChatTheme } from '../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const options = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

type OutputResultToolBlock = Parameters<typeof OutputResultComponent.render>[0]

function renderOutputResult(outputRaw?: unknown): {
  markup: string
  collapsedPreview?: string
} {
  const config = OutputResultComponent.render(
    {
      toolName: 'deep_research',
      input: { question: 'What is X?' },
      toolCallId: 'test-id',
      outputRaw,
      output: undefined,
    } as unknown as OutputResultToolBlock,
    theme,
    options,
  )
  return {
    markup: renderToStaticMarkup(<>{config.content}</>),
    collapsedPreview: config.collapsedPreview,
  }
}

describe('OutputResultComponent (FID-2026-0822-014 structured cards)', () => {
  test('renders the result as a structured card (no YAML fallback)', () => {
    const { markup, collapsedPreview } = renderOutputResult([
      {
        type: 'json',
        value: {
          message: 'scanned',
          harvested: 3,
          ledger: 'dev/YAGNI-LEDGER.md',
        },
      },
    ])

    expect(markup).toContain('harvested')
    expect(markup).toContain('ledger')
    expect(markup).not.toContain('message:')
    expect(collapsedPreview).toBe('scanned')
  })

  test('sanitizes and truncates the collapsed preview to one line', () => {
    const long = `# A heading\n${'x'.repeat(300)}`
    const { collapsedPreview } = renderOutputResult([
      { type: 'text', text: long },
    ])

    expect(collapsedPreview).not.toContain('#')
    expect(collapsedPreview).not.toContain('\n')
    expect((collapsedPreview ?? '').length).toBeLessThanOrEqual(160)
  })

  test('returns null content when there are no raw parts', () => {
    const config = OutputResultComponent.render(
      {
        toolName: 'deep_research',
        input: { question: 'What is X?' },
        toolCallId: 'test-id',
        outputRaw: undefined,
      } as unknown as OutputResultToolBlock,
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })

  test('returns null content for whitespace-only text parts', () => {
    const config = OutputResultComponent.render(
      {
        toolName: 'deep_research',
        input: { question: 'What is X?' },
        toolCallId: 'test-id',
        outputRaw: [{ type: 'text', text: '   \n  ' }],
        output: '   \n  ',
      } as unknown as OutputResultToolBlock,
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })

  test('renders the TrafficLights panel chrome around the card (FID-2026-0822-005)', () => {
    const { markup } = renderOutputResult([
      { type: 'json', value: { message: 'scanned', harvested: 3 } },
    ])

    expect(markup).toContain('●')
    expect(markup).toContain('harvested')
  })
})
