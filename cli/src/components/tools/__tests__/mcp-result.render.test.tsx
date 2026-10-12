import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { useChatStore } from '../../../state/chat-store'
import { createMarkdownPalette } from '../../../utils/theme-system'
import { waitForNativeFrame } from '../../__tests__/native-render-frame'
import { ToolBranch } from '../../blocks/tool-branch'
import { ErrorBoundary } from '../../error-boundary'

import type { ToolContentBlock } from '../../../types/chat'

initializeThemeStore()

test('namespaced MCP calls use traffic-light chrome through loading, result and folding', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 30,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  const block: ToolContentBlock = {
    type: 'tool',
    toolCallId: 'paper-test',
    toolName: 'scholars-search__search_papers' as ToolContentBlock['toolName'],
    input: { query: 'RAG' },
    isCollapsed: false,
  }
  async function render(expected = 'Search Papers') {
    root.render(
      <ErrorBoundary fallback={<text>ROOT FAILED</text>}>
        <ToolBranch
          toolBlock={{ ...block }}
          keyPrefix="papers"
          availableWidth={100}
          onToggleCollapsed={() => {}}
          markdownPalette={createMarkdownPalette(
            useThemeStore.getState().theme,
          )}
        />
      </ErrorBoundary>,
    )
    return waitForNativeFrame(
      setup,
      (frame) => frame.includes('ROOT FAILED') || frame.includes(expected),
    )
  }
  try {
    useChatStore.setState({ streamingAgents: new Set(['paper-test']) })
    let frame = await render('running')
    expect(frame).toContain('● ● ●')
    expect(frame).toContain('Search Papers')
    expect(frame).not.toContain('Scholars-Search')
    expect(frame).toContain('running')
    useChatStore.setState({ streamingAgents: new Set() })
    block.output = '# Evidence\n\nA supported paper.'
    block.outputRaw = [{ type: 'json', value: block.output }]
    frame = await render('supported paper')
    expect(frame).toContain('supported paper')
    expect(frame).not.toContain('ROOT FAILED')
    block.isCollapsed = true
    frame = await render()
    expect(frame).toContain('Search Papers')
    block.outputRaw = [
      { type: 'json', value: { errorMessage: 'service unavailable' } },
    ]
    block.output = 'service unavailable'
    expect(await render('service unavailable')).toContain('service unavailable')
    setup.resize(40, 30)
    expect(await render()).not.toContain('ROOT FAILED')
    block.outputRaw = []
    block.output = ''
    expect(await render('No results returned')).toContain('No results returned')
  } finally {
    useChatStore.setState({ streamingAgents: new Set() })
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)
