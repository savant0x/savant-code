import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../hooks/use-theme'
import { ReadFilesComponent } from '../read-files'
import { SimpleToolCallItem } from '../tool-call-item'

import type { ChatTheme } from '../../../types/theme-system'

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
      {} as ChatTheme,
      {
        availableWidth: 80,
        indentationOffset: 0,
        labelWidth: 0,
      },
    )

    const markup = renderToStaticMarkup(<>{result.content}</>)
    const richDescriptionBox = markup.match(
      /<box style="flex-direction:row;flex-shrink:1">([\s\S]*?)<\/box>/,
    )?.[1]

    expect(richDescriptionBox).toBeDefined()
    expect(richDescriptionBox).toMatch(/^<text(?:\s[^>]*)?>/)
    expect(richDescriptionBox).toContain('wrap-mode:word')
    expect(richDescriptionBox).toContain('(blocked)')
  })
})
