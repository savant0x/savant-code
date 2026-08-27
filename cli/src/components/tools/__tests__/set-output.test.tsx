import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { SetOutputComponent } from '../set-output'

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

type SetOutputToolBlock = Parameters<typeof SetOutputComponent.render>[0]

function renderSetOutput(input: Record<string, unknown>): {
  markup: string
  collapsedPreview?: string
} {
  const config = SetOutputComponent.render(
    {
      toolName: 'set_output',
      input,
      toolCallId: 'test-id',
      output: 'message: Output set',
    } as unknown as SetOutputToolBlock,
    theme,
    options,
  )
  return {
    markup: renderToStaticMarkup(<>{config.content}</>),
    collapsedPreview: config.collapsedPreview,
  }
}

describe('SetOutputComponent (FID-2026-0821-006)', () => {
  test('renders the unwrapped `data` payload, not the "Output set" tool result', () => {
    const { markup, collapsedPreview } = renderSetOutput({
      data: { message: 'I found a bug in the code!' },
    })

    expect(markup).toContain('I found a bug in the code!')
    expect(markup).not.toContain('Output set')
    expect(markup).toContain('●')
    expect(collapsedPreview).toBe('I found a bug in the code!')
  })

  test('renders unwrapped top-level fields when `data` is not the only key', () => {
    const { markup } = renderSetOutput({
      message: 'Done',
      results: [{ file: 'a.ts' }],
    })

    expect(markup).toContain('Done')
    expect(markup).toContain('results')
  })

  test('returns null content for an empty payload', () => {
    const config = SetOutputComponent.render(
      {
        toolName: 'set_output',
        input: {},
        toolCallId: 'test-id',
        output: 'message: Output set',
      } as unknown as SetOutputToolBlock,
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })

  test('returns null content for an empty wrapped `data` object', () => {
    const config = SetOutputComponent.render(
      {
        toolName: 'set_output',
        input: { data: {} },
        toolCallId: 'test-id',
        output: 'message: Output set',
      } as unknown as SetOutputToolBlock,
      theme,
      options,
    )
    expect(config.content).toBeNull()
  })
})
