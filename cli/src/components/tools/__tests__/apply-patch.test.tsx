import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

// ApplyPatchComponent renders DiffViewer → TrafficLightPanel, whose
// TrafficLights hooks throw under static render without these inert stubs.
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore } from '../../../hooks/use-theme'
import { chatThemes } from '../../../utils/theme-system'
import { getToolComponent, renderToolComponent } from '../registry'

import type { ToolBlock } from '../types'
import type { JSONValue } from '@savant-code/common/types/json'
import type React from 'react'

mockOpentuiReactForStaticRender()
initializeThemeStore()

const createToolBlock = (
  operation: Record<string, JSONValue>,
): ToolBlock & { toolName: 'apply_patch' } => ({
  type: 'tool',
  toolName: 'apply_patch',
  toolCallId: 'apply-patch-test-id',
  input: { operation },
})

const renderOptions = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 0,
}

describe('ApplyPatchComponent', () => {
  test('is registered for apply_patch tool calls', () => {
    expect(getToolComponent('apply_patch')).toBeDefined()
  })

  test('renders create_file operation', () => {
    const toolBlock = createToolBlock({
      type: 'create_file',
      path: 'src/new-file.ts',
      diff: '@@\n+export const value = 1\n',
    })

    const result = renderToolComponent(
      toolBlock,
      chatThemes.dark,
      renderOptions,
    )

    expect(result).toBeDefined()
    expect(result?.content).toBeDefined()

    const markup = renderToStaticMarkup(result?.content as React.ReactElement)
    expect(markup).toContain('Create')
    expect(markup).toContain('src/new-file.ts')
  })

  test('renders update_file operation with diff content', () => {
    const toolBlock = createToolBlock({
      type: 'update_file',
      path: 'src/existing.ts',
      diff: '@@\n-oldLine\n+newLine\n',
    })

    const result = renderToolComponent(
      toolBlock,
      chatThemes.dark,
      renderOptions,
    )

    expect(result).toBeDefined()
    expect(result?.content).toBeDefined()

    const markup = renderToStaticMarkup(result?.content as React.ReactElement)
    expect(markup).toContain('Edit')
    expect(markup).toContain('src/existing.ts')
    // FID-2026-0816-009: the +/- marker moved into the sign gutter column, so
    // the content column carries the line text without its prefix.
    expect(markup).toContain('oldLine')
    expect(markup).toContain('newLine')
  })

  test('renders the +N -N count in the DiffViewer header strip, not the footer (FID-2026-0823-005)', () => {
    const toolBlock = createToolBlock({
      type: 'update_file',
      path: 'src/existing.ts',
      diff: '@@\n-oldLine1\n-oldLine2\n+newLine1\n+newLine2\n+newLine3\n',
    })

    const result = renderToolComponent(
      toolBlock,
      chatThemes.dark,
      renderOptions,
    )

    // The count lives in the DiffViewer header (top); no footer counter.
    expect(result?.footerLeft).toBeUndefined()
    const contentMarkup = renderToStaticMarkup(
      result?.content as React.ReactElement,
    )
    expect(contentMarkup).toContain('+3 -2')
  })

  test('create_file renders no change counter (no diff body is shown)', () => {
    const toolBlock = createToolBlock({
      type: 'create_file',
      path: 'src/new-file.ts',
      diff: '@@\n+export const value = 1\n',
    })

    const result = renderToolComponent(
      toolBlock,
      chatThemes.dark,
      renderOptions,
    )

    // create_file renders the "Create" header only — no DiffViewer, so no
    // `+N -N` count anywhere in the block.
    expect(result?.footerLeft).toBeUndefined()
    const contentMarkup = renderToStaticMarkup(
      result?.content as React.ReactElement,
    )
    expect(contentMarkup).toContain('Create')
    expect(contentMarkup).not.toContain('+1 -0')
  })

  test('renders delete_file operation', () => {
    const toolBlock = createToolBlock({
      type: 'delete_file',
      path: 'src/remove-me.ts',
    })

    const result = renderToolComponent(
      toolBlock,
      chatThemes.dark,
      renderOptions,
    )

    expect(result).toBeDefined()
    expect(result?.content).toBeDefined()

    const markup = renderToStaticMarkup(result?.content as React.ReactElement)
    expect(markup).toContain('Delete')
    expect(markup).toContain('src/remove-me.ts')
    // delete_file carries no diff in the payload — no change counter.
    expect(result?.footerLeft).toBeUndefined()
  })
})
