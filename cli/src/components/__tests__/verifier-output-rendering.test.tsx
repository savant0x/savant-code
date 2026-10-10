import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import {
  replayVerifier,
  VERDICT,
} from '../../utils/__tests__/verifier-output-fixture'
import { createMarkdownPalette } from '../../utils/theme-system'
import { AgentBranchWrapper } from '../blocks/agent-branch-wrapper'

import type { AgentContentBlock } from '../../types/chat'

initializeThemeStore()

function assertReview(frame: string) {
  const compact = frame.replace(/[│╭╮╰╯─\s]/g, '')
  expect(compact).toContain(VERDICT.replace(/\s/g, ''))
  expect(compact.match(/FAILart\/icons/g)).toHaveLength(1)
  expect(compact.match(/NEEDS-REVIEWrender/g)).toHaveLength(1)
  expect(frame).not.toContain('<think')
  expect(frame).not.toContain('</think')
}

function reviewElement(
  agent: AgentContentBlock,
  width: number,
  collapsed: boolean,
  reasoningExpanded: boolean,
) {
  return (
    <AgentBranchWrapper
      agentBlock={{
        ...agent,
        isCollapsed: collapsed,
        blocks: agent.blocks?.map((block) =>
          block.type === 'text' && block.textType === 'reasoning'
            ? {
                ...block,
                thinkingCollapseState: reasoningExpanded
                  ? 'expanded'
                  : 'hidden',
              }
            : block,
        ),
      }}
      keyPrefix="verifier"
      availableWidth={width}
      markdownPalette={createMarkdownPalette(useThemeStore.getState().theme)}
      onToggleCollapsed={() => {}}
      onBuildFast={() => {}}
      onBuildMax={() => {}}
      onBuildLite={() => {}}
    />
  )
}

async function createReviewRenderer() {
  const setup = await createTestRenderer({
    width: 160,
    height: 40,
    footerHeight: 0,
    exitOnCtrlC: false,
  })
  const root = createRoot(setup.renderer)
  const agent = replayVerifier()
  useChatStore.setState({ streamingAgents: new Set() })
  const render = async (
    width: number,
    collapsed = false,
    reasoningExpanded = false,
  ) => {
    setup.resize(width, 40)
    root.render(reviewElement(agent, width, collapsed, reasoningExpanded))
    await Bun.sleep(40)
    await setup.renderOnce()
    return setup.captureCharFrame()
  }
  return {
    render,
    destroy: () => {
      root.unmount()
      setup.renderer.destroy()
    },
  }
}

test('FID-2026-1010-002: native audit branch wraps once, resizes and folds without lost text', async () => {
  const { render, destroy } = await createReviewRenderer()
  try {
    for (const width of [160, 100, 60, 160]) {
      const frame = await render(width)
      assertReview(frame)
      expect(frame).not.toContain('Audit notes')
      if (width === 160) expect(frame).toContain('logo-sidebar-s.svg:15')
    }
    const collapsed = await render(100, true)
    expect(collapsed).toContain('Review visible evidence')
    expect(collapsed).not.toContain('wrong rect')
    assertReview(await render(100))
    const reasoning = await render(100, false, true)
    assertReview(reasoning)
    expect(reasoning).toContain('Audit notes')
  } finally {
    destroy()
  }
}, 30_000)
