import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { AgentBranchItem } from '../blocks/agent-branch-item'
// TrafficLights mounts useAnimationBudget (@opentui/react focus/renderer
// hooks) which throws under react-dom/server without these inert stubs.
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

mockOpentuiReactForStaticRender()
initializeThemeStore()

/**
 * FID-2026-0822-006: pins the agent-branch re-skin onto the unified
 * TrafficLightPanel chrome language — compact glowing lights in the header
 * row — while proving the collapse/streaming affordances survived unchanged.
 * (message-with-agents.test.tsx renders the single-agent path, which never
 * mounts AgentBranchItem, so this is the branch frame's coverage home.)
 */
describe('AgentBranchItem chrome (FID-2026-0822-006)', () => {
  test('expanded branch renders header lights around full content', () => {
    const markup = renderToStaticMarkup(
      <AgentBranchItem
        name="Recorder"
        isCollapsed={false}
        isStreaming={false}
        preview=""
        onToggle={() => {}}
      >
        <text>BRANCH_BODY_MARKER</text>
      </AgentBranchItem>,
    )

    expect(markup).toContain('●')
    expect(markup).toContain('▾')
    expect(markup).toContain('Recorder')
    expect(markup).toContain('BRANCH_BODY_MARKER')
  })

  test('collapsed branch keeps the preview and the header lights', () => {
    const markup = renderToStaticMarkup(
      <AgentBranchItem
        name="Thinker"
        isCollapsed
        isStreaming={false}
        preview="collapsed preview line"
        onToggle={() => {}}
      />,
    )

    expect(markup).toContain('●')
    expect(markup).toContain('▸')
    expect(markup).toContain('collapsed preview line')
  })
})
