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
import type { JSONValue } from '@savant-code/common/types/json'

initializeThemeStore()

test('worktree lifecycle uses traffic lights through loading, results and refusals', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 30,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  const block: ToolContentBlock = {
    type: 'tool',
    toolCallId: 'lane-test',
    toolName: 'fid_worktree',
    input: { action: 'list' },
    isCollapsed: false,
  }
  async function render(expected: string) {
    root.render(
      <ErrorBoundary fallback={<text>ROOT FAILED</text>}>
        <ToolBranch
          toolBlock={{ ...block }}
          keyPrefix="lane"
          availableWidth={100}
          onToggleCollapsed={() => {}}
          markdownPalette={createMarkdownPalette(
            useThemeStore.getState().theme,
          )}
        />
      </ErrorBoundary>,
    )
    const frame = await waitForNativeFrame(
      setup,
      (text) => text.includes('ROOT FAILED') || text.includes(expected),
    )
    expect(frame).not.toContain('ROOT FAILED')
    expect(frame).toContain('● ● ●')
    return frame
  }
  function result(value: JSONValue) {
    block.outputRaw = [{ type: 'json', value }]
    block.output = JSON.stringify(value)
  }
  try {
    useChatStore.setState({ streamingAgents: new Set(['lane-test']) })
    expect(await render('running')).toContain('Waiting for the tool result')
    useChatStore.setState({ streamingAgents: new Set() })
    for (const action of ['list', 'create', 'merge', 'dispose']) {
      block.input = { action }
      result({ ok: true, detail: `${action} completed` })
      expect(await render(`${action} completed`)).toContain(
        `${action} completed`,
      )
    }
    result({
      ok: false,
      reason: 'dirty-lane',
      detail: 'Commit lane changes first',
    })
    expect(await render('dirty-lane')).toContain('Commit lane changes first')
    block.isCollapsed = true
    expect(await render('ok: false')).toContain('ok: false')
    setup.resize(40, 30)
    expect(await render('ok: false')).toContain('ok: false')
    block.isCollapsed = false
    block.outputRaw = []
    block.output = ''
    expect(await render('No results returned')).toContain('No results returned')
  } finally {
    useChatStore.setState({ streamingAgents: new Set() })
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)
