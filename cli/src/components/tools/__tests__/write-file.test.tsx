import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// TrafficLightPanel mounts TrafficLights whose hooks throw under static
// render without these inert @opentui/react stubs.
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { getToolComponent } from '../registry'
import { WriteFileComponent } from '../write-file'

import type { ChatTheme } from '../../../types/theme-system'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const theme: ChatTheme = useThemeStore.getState().theme
const baseOptions = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

type WriteFileToolBlock = Parameters<typeof WriteFileComponent.render>[0]

function renderWriteFile(
  input: Record<string, unknown>,
  extra?: Partial<{
    output: string
    isCollapsed: boolean
    onToggle: () => void
  }>,
): { markup: string; collapsedPreview?: string } {
  const config = WriteFileComponent.render(
    {
      toolName: 'write_file',
      input,
      toolCallId: 'test-id',
      output: extra?.output ?? 'message: Overwrote file successfully.',
    } as unknown as WriteFileToolBlock,
    theme,
    {
      ...baseOptions,
      isCollapsed: extra?.isCollapsed,
      onToggle: extra?.onToggle,
    },
  )
  return {
    markup: renderToStaticMarkup(<>{config.content}</>),
    collapsedPreview: config.collapsedPreview,
  }
}

const FID_DOC = `# FID: Test Document

**Status:** analyzed

## Summary

One paragraph.
`

describe('WriteFileComponent (FID-2026-0823-006)', () => {
  test('is registered for write_file tool calls', () => {
    expect(getToolComponent('write_file')).toBeDefined()
  })

  test('renders a compact summary by default (path + line count, no diff wall)', () => {
    const { markup, collapsedPreview } = renderWriteFile({
      path: 'dev/fids/FID-test.md',
      content: FID_DOC,
    })

    expect(markup).toContain('●')
    expect(markup).toContain('Write')
    expect(markup).toContain('dev/fids/FID-test.md')
    expect(markup).toContain('(8 lines)')
    // The wall is gone: no raw content, no `+ `-prefixed diff rows, no
    // `+5 -0` edit-style counter for a whole-file snapshot.
    expect(markup).not.toContain('+ FID:')
    expect(markup).not.toContain('+5 -0')
    expect(collapsedPreview).toContain('dev/fids/FID-test.md')
  })

  test('renders markdown content when expanded for .md targets', () => {
    const { markup } = renderWriteFile(
      {
        path: 'dev/fids/FID-test.md',
        content: FID_DOC,
      },
      { isCollapsed: false, onToggle: () => {} },
    )

    // Markdown is rendered, not dumped as raw source: the heading text is
    // present without the `# ` marker or a `+ ` diff prefix.
    expect(markup).toContain('FID: Test Document')
    expect(markup).toContain('One paragraph.')
    expect(markup).not.toContain('# FID: Test Document')
    expect(markup).not.toContain('+ FID:')
  })

  test('renders non-markdown content as a code block when expanded', () => {
    const { markup } = renderWriteFile(
      {
        path: 'src/app.ts',
        content: 'export const value = 1\n',
      },
      { isCollapsed: false, onToggle: () => {} },
    )

    expect(markup).toContain('export const value = 1')
    // Code-block fence rendering keeps the raw line (no `+ ` diff prefix).
    expect(markup).not.toContain('+ export const value = 1')
  })

  test('labels creates with Create and reports the operation', () => {
    const { markup } = renderWriteFile(
      {
        path: 'dev/fids/FID-new.md',
        content: FID_DOC,
      },
      { output: 'message: Created file successfully.' },
    )

    expect(markup).toContain('Create')
    expect(markup).not.toContain('>Write<')
  })

  test('shows the expand affordance when a toggle is supplied', () => {
    const collapsedMarkup = renderWriteFile(
      { path: 'dev/fids/FID-test.md', content: FID_DOC },
      { isCollapsed: true, onToggle: () => {} },
    ).markup
    expect(collapsedMarkup).toContain('▸ ')

    const expandedMarkup = renderWriteFile(
      { path: 'dev/fids/FID-test.md', content: FID_DOC },
      { isCollapsed: false, onToggle: () => {} },
    ).markup
    expect(expandedMarkup).toContain('▴ collapse')
    expect(expandedMarkup).toContain('▾ ')
  })

  test('renders header-only for empty content (no body, no line count noise)', () => {
    const { markup } = renderWriteFile(
      { path: 'dev/fids/empty.md', content: '' },
      { isCollapsed: false, onToggle: () => {} },
    )

    expect(markup).toContain('Write')
    expect(markup).toContain('dev/fids/empty.md')
    expect(markup).not.toContain('(0 lines)')
  })
})
