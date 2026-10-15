import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { SequentialThinkingComponent } from '../sequential-thinking'

import type { ChatTheme } from '../../../types/theme-system'

// FID-2026-0822-006: the framed renderer mounts TrafficLights, whose
// useAnimationBudget needs inert @opentui/react hook stubs under static render.
mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const options = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

type SequentialThinkingToolBlock = Parameters<
  typeof SequentialThinkingComponent.render
>[0]

function renderSequentialThinking(input: Record<string, unknown>): {
  markup: string
  collapsedPreview?: string
} {
  const config = SequentialThinkingComponent.render(
    {
      toolName: 'sequentialthinking',
      input,
      toolCallId: 'test-id',
      output: '{"message":"{\\"thoughtNumber\\":1}"}',
    } as unknown as SequentialThinkingToolBlock,
    theme,
    options,
  )
  return {
    markup: renderToStaticMarkup(<>{config.content}</>),
    collapsedPreview: config.collapsedPreview,
  }
}

describe('SequentialThinkingComponent (FID-2026-0821-008)', () => {
  test('renders the thought inline with a position label', () => {
    const { markup, collapsedPreview } = renderSequentialThinking({
      thought: 'Analyze the problem constraints first.',
      thoughtNumber: 3,
      totalThoughts: 5,
      nextThoughtNeeded: true,
    })

    expect(markup).toContain('Analyze the problem constraints first.')
    expect(markup).toContain('💭 Thought 3/5')
    expect(markup).toContain('●')
    expect(collapsedPreview).toContain('💭 Thought 3/5')
    expect(collapsedPreview).toContain('Analyze the problem constraints first.')
  })

  test('labels a revision distinctly and coerces stringified numbers', () => {
    const { markup } = renderSequentialThinking({
      thought: 'Revise the earlier assumption.',
      thoughtNumber: '4',
      totalThoughts: '5',
      isRevision: 'true',
      revisesThought: '2',
    })

    expect(markup).toContain('↩️ Revising thought #2')
    expect(markup).toContain('Revise the earlier assumption.')
  })

  test('returns null content for an empty thought', () => {
    const config = SequentialThinkingComponent.render(
      {
        toolName: 'sequentialthinking',
        input: { thought: '', thoughtNumber: 1, totalThoughts: 1 },
        toolCallId: 'test-id',
      } as unknown as SequentialThinkingToolBlock,
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })
})
