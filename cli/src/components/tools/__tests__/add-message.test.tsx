import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// TrafficLightPanel mounts TrafficLights whose hooks throw under static
// render without these inert @opentui/react stubs.
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { AddMessageComponent } from '../add-message'

import type { ChatTheme } from '../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const options = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

type AddMessageToolBlock = Parameters<typeof AddMessageComponent.render>[0]

function renderAddMessage(input: Record<string, unknown>): {
  markup: string
  collapsedPreview?: string
} {
  const config = AddMessageComponent.render(
    {
      toolName: 'add_message',
      input,
      toolCallId: 'test-id',
      output: 'Message added.',
    } as unknown as AddMessageToolBlock,
    theme,
    options,
  )
  return {
    markup: renderToStaticMarkup(<>{config.content}</>),
    collapsedPreview: config.collapsedPreview,
  }
}

describe('AddMessageComponent (FID-2026-0822-011)', () => {
  test('renders framed assistant narration with chrome and role label', () => {
    const { markup, collapsedPreview } = renderAddMessage({
      role: 'assistant',
      content: 'Narration line for the operator.',
    })

    expect(markup).toContain('●')
    expect(markup).toContain('Assistant message')
    expect(markup).toContain('Narration line for the operator.')
    expect(collapsedPreview).toContain('Assistant message — Narration line')
  })
  test('labels user-role messages distinctly', () => {
    const { markup } = renderAddMessage({
      role: 'user',
      content: 'Operator note.',
    })

    expect(markup).toContain('User message')
    expect(markup).toContain('Operator note.')
  })

  test('returns null content for an empty message', () => {
    const config = AddMessageComponent.render(
      {
        toolName: 'add_message',
        input: { role: 'assistant', content: '' },
        toolCallId: 'test-id',
        output: 'Message added.',
      } as unknown as AddMessageToolBlock,
      theme,
      options,
    )

    expect(config.content).toBeNull()
  })
})
