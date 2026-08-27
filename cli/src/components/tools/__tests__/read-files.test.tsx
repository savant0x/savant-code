import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// TrafficLightPanel mounts TrafficLights whose hooks throw under static
// render without these inert @opentui/react stubs.
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { ReadFilesComponent } from '../read-files'

import type { ChatTheme } from '../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const options = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

type ReadFilesToolBlock = Parameters<typeof ReadFilesComponent.render>[0]

function renderReadFiles(paths: string[]): { markup: string } {
  const config = ReadFilesComponent.render(
    {
      toolName: 'read_files',
      input: { paths },
      toolCallId: 'test-id',
      output: 'ok',
    } as unknown as ReadFilesToolBlock,
    theme,
    options,
  )
  return { markup: renderToStaticMarkup(<>{config.content}</>) }
}

describe('ReadFilesComponent (FID-2026-0822-011)', () => {
  test('renders framed chrome with the Read label and paths', () => {
    const { markup } = renderReadFiles(['package.json', 'src/index.ts'])

    expect(markup).toContain('●')
    expect(markup).toContain('Read')
    expect(markup).toContain('package.json')
    expect(markup).toContain('src/index.ts')
  })

  test('labels sensitive files as blocked inside the frame', () => {
    const { markup } = renderReadFiles(['.env.local'])

    expect(markup).toContain('●')
    expect(markup).toContain('.env.local')
    expect(markup).toContain('(blocked)')
  })

  test('returns null content when there are no paths', () => {
    const config = ReadFilesComponent.render(
      {
        toolName: 'read_files',
        input: { paths: [] },
        toolCallId: 'test-id',
        output: 'ok',
      } as unknown as ReadFilesToolBlock,
      theme,
      options,
    )

    expect(config.content).toBeNull()
  })
})
