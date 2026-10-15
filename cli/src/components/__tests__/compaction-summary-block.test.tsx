import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
// TrafficLights mounts useAnimationBudget (@opentui/react focus/renderer
// hooks) which throws under react-dom/server without these inert stubs.
// Same harness as compaction-signal.test.tsx.
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

import type { CompactionSummaryContentBlock } from '../../types/chat'

mockOpentuiReactForStaticRender()
initializeThemeStore()

// Loaded after the mock registration so the component binds the stubbed
// opentui react entry points.
const { CompactionSummaryBlock } = await import('../compaction-summary-block')
const { SingleBlock } = await import('../blocks/single-block')
const { defaultPalette } = await import('../../utils/markdown-palette')

const multiLineSummary = [
  '## Standing facts & constraints',
  '',
  'The workspace contains a README, a config file, and two source files.',
  'The compaction feature flag was enabled; the suite passed across the',
  'twelve workspaces.',
].join('\n')

const fullBlock: CompactionSummaryContentBlock = {
  type: 'compaction-summary',
  id: 'compaction-summary-1',
  summary: multiLineSummary,
  removedMessages: 12,
  tokensSaved: 45000,
  percentUsed: 3.4,
}

/**
 * FID-2026-0828-001: the post-compaction summary renders as a first-class
 * transcript entry through the shared TrafficLightPanel chrome — the turn's
 * visible output for manual /compact and a mid-turn block for auto-compact.
 * Operator directive 2026-08-28: COLLAPSED BY DEFAULT — the header + first
 * line render in a single row; the rest is folded until expanded.
 */
describe('CompactionSummaryBlock (FID-2026-0828-001)', () => {
  test('renders COLLAPSED by default: header + first line only', () => {
    const markup = renderToStaticMarkup(
      <CompactionSummaryBlock block={fullBlock} />,
    )

    expect(markup).toContain('✓ Compaction summary')
    expect(markup).toContain('removed 12 messages')
    expect(markup).toContain('−45000 tokens')
    expect(markup).toContain('3% of window')
    // The whole block carries the shared copy affordance.
    expect(markup).toContain('⎘')
    // Collapsed affordance prompts to expand.
    expect(markup).toContain('▾ expand')
    // Collapsed: only the first non-empty line of the summary is shown
    // (& is HTML-escaped in the static markup).
    expect(markup).toContain('## Standing facts &amp; constraints')
    expect(markup).not.toContain('two source files.')
    expect(markup).not.toContain('twelve workspaces.')
  })

  test('renders the FULL summary when explicitly expanded', () => {
    const markup = renderToStaticMarkup(
      <CompactionSummaryBlock block={{ ...fullBlock, isCollapsed: false }} />,
    )

    expect(markup).toContain('✓ Compaction summary')
    // Expanded affordance prompts to collapse.
    expect(markup).toContain('▴ collapse')
    expect(markup).toContain('## Standing facts &amp; constraints')
    expect(markup).toContain('The workspace contains a README, a config file')
    expect(markup).toContain('twelve workspaces.')
  })

  test('omits the metric segments the event did not carry', () => {
    const markup = renderToStaticMarkup(
      <CompactionSummaryBlock
        block={{
          type: 'compaction-summary',
          id: 'compaction-summary-2',
          summary: 'Minimal summary.',
          removedMessages: 1,
        }}
      />,
    )

    expect(markup).toContain('✓ Compaction summary')
    expect(markup).toContain('removed 1 messages')
    expect(markup).not.toContain('tokens')
    expect(markup).not.toContain('% of window')
    expect(markup).toContain('Minimal summary.')
  })

  test('SingleBlock dispatches the block to the TrafficLightPanel card', () => {
    const markup = renderToStaticMarkup(
      <SingleBlock
        block={fullBlock}
        idx={3}
        messageId="test-message"
        isLoading={false}
        isComplete={true}
        isUser={false}
        textColor="#ffffff"
        availableWidth={80}
        markdownPalette={defaultPalette}
        onToggleCollapsed={() => {}}
        onBuildFast={() => {}}
        onBuildMax={() => {}}
        onBuildLite={() => {}}
      />,
    )

    expect(markup).toContain('✓ Compaction summary')
    expect(markup).toContain('removed 12 messages')
    // Collapsed by default through the SingleBlock dispatch too.
    expect(markup).not.toContain('two source files.')
  })
})
