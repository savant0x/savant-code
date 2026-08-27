import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// FID-2026-0822-011: ReadFilesComponent renders in the TrafficLightPanel
// chrome, whose hooks throw under static render without these inert stubs
// (mirrors read-files.test.tsx).
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { ReadFilesComponent } from '../read-files'
import { SimpleToolCallItem } from '../tool-call-item'

mockOpentuiReactForStaticRender()
initializeThemeStore()

describe('SimpleToolCallItem', () => {
  test('keeps plain descriptions inline', () => {
    const markup = renderToStaticMarkup(
      <SimpleToolCallItem
        name="Read"
        description="src/index.ts"
        descriptionColor="#00ffff"
      />,
    )

    expect(markup).toContain('Read')
    expect(markup).toContain('src/index.ts')
    expect(markup).toContain('<span')
  })

  test('hosts rich descriptions in a layout box instead of text', () => {
    const markup = renderToStaticMarkup(
      <SimpleToolCallItem
        name="Read"
        description={
          <>
            <span fg="#00ffff">src/.env</span>
            <span fg="#888888"> (blocked)</span>
          </>
        }
      />,
    )

    expect(markup).toContain('src/.env')
    expect(markup).toContain('(blocked)')
    expect(markup).toMatch(/<text[^>]*>[^]*<\/text>/)
    expect(markup).toContain('<box')
  })

  test('hosts read_files safety labels inside a text node', () => {
    const result = ReadFilesComponent.render(
      {
        type: 'tool',
        toolName: 'read_files',
        toolCallId: 'read-files-host-test',
        input: { paths: ['.env', 'example.env'] },
      },
      useThemeStore.getState().theme,
      {
        availableWidth: 80,
        indentationOffset: 0,
        labelWidth: 0,
      },
    )

    const markup = renderToStaticMarkup(<>{result.content}</>)

    // FID-2026-0822-011 framed chrome: the panel carries the Read label and
    // the word-wrapped path description with the (blocked) label.
    expect(markup).toContain('Read')
    expect(markup).toContain('wrap-mode:word')
    expect(markup).toContain('(blocked)')
    expect(markup).toContain('.env')
    expect(markup).toContain('example.env')
  })
})
