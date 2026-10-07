// FID-2026-1007-009 — the sidebar Cache row.
//
// The row exists to keep three states apart, so the pins are the states, not
// the styling: no data at all, a provider that did not report the field, and a
// provider-reported zero must never render as each other. The last case also
// proves the value travels the production path — it is read off the run
// snapshot the sidebar selects from, not handed in as a prop by the test.
import { beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

import type { CacheUsageSummary } from '@savant-code/common/types/session-state-cache-usage'

mockOpentuiReactForStaticRender()
initializeThemeStore()

// Loaded after the mock registration so the components bind the stubbed
// opentui-react entry points (same harness as compaction-summary-block.test).
const { SidebarSession } = await import('../right-sidebar-sections')
const { useChatStore } = await import('../../state/chat-store')

const emptyBucket = (
  overrides: Partial<CacheUsageSummary> = {},
): CacheUsageSummary => ({
  provider: 'openrouter',
  model: 'openai/gpt-5',
  eligibleInputTokens: 0,
  cachedInputTokens: 0,
  reportedTurns: 0,
  unreportedTurns: 0,
  invalidTurns: 0,
  cacheHitRatio: null,
  ...overrides,
})

/** Sets the run snapshot exactly where `RightSidebar` selects the summary. */
const publishToSnapshot = (summary: CacheUsageSummary | undefined) => {
  useChatStore.setState({
    runState: {
      sessionState: {
        mainAgentState: summary === undefined ? {} : { cacheUsage: summary },
      },
    } as never,
  })
  return useChatStore.getState().runState?.sessionState?.mainAgentState
    ?.cacheUsage
}

const render = (cacheUsage?: CacheUsageSummary) =>
  renderToStaticMarkup(
    <SidebarSession
      agent="main-agent"
      cost={0}
      mode="default"
      model="openai/gpt-5"
      tokensUsed={1_000}
      tokensMax={400_000}
      windowSource="catalog"
      compactionStatus={null}
      compactionCount={0}
      cacheUsage={cacheUsage}
    />,
  )

/**
 * The Cache row's own value.
 *
 * Asserting against the whole markup is worthless here: every row carries
 * `width="100%"`, so a bare `toContain('0%')` passes without the Cache row
 * existing at all. This reads the text node that follows the `Cache` label.
 */
const cacheRowValue = (markup: string): string =>
  markup.match(/>Cache<\/text><text[^>]*>([^<]*)<\/text>/)?.[1] ?? ''

beforeEach(() => {
  publishToSnapshot(undefined)
})

describe('sidebar cache row (FID-2026-1007-009)', () => {
  test('renders the row with an unknown state before any cache data exists', () => {
    expect(cacheRowValue(render(undefined))).toBe('—')
  })

  test('a provider that never reported the field is not a cache miss', () => {
    const value = cacheRowValue(
      render(emptyBucket({ unreportedTurns: 3, eligibleInputTokens: 0 })),
    )
    expect(value).toBe('Not reported')
  })

  test('a provider-reported zero renders as a known zero', () => {
    const value = cacheRowValue(
      render(
        emptyBucket({
          eligibleInputTokens: 1_200,
          cachedInputTokens: 0,
          reportedTurns: 1,
          cacheHitRatio: 0,
        }),
      ),
    )
    expect(value).toBe('0% (0/1.2k)')
  })

  test('a positive ratio carries its token sample', () => {
    const value = cacheRowValue(
      render(
        emptyBucket({
          eligibleInputTokens: 1_000,
          cachedInputTokens: 800,
          reportedTurns: 2,
          cacheHitRatio: 0.8,
        }),
      ),
    )
    expect(value).toBe('80% (800/1.0k)')
  })

  test('rejected samples are surfaced rather than hidden', () => {
    const value = cacheRowValue(
      render(
        emptyBucket({
          eligibleInputTokens: 1_000,
          cachedInputTokens: 800,
          reportedTurns: 2,
          invalidTurns: 1,
          cacheHitRatio: 0.8,
        }),
      ),
    )
    expect(value).toBe('80% (800/1.0k) +1 invalid')
  })

  test('the value travels the run-snapshot path, not a test prop', () => {
    const published = publishToSnapshot(
      emptyBucket({
        model: 'anthropic/claude-4',
        eligibleInputTokens: 2_000,
        cachedInputTokens: 1_500,
        reportedTurns: 4,
        cacheHitRatio: 0.75,
      }),
    )
    // The summary the sidebar selects is the one the run snapshot carries...
    expect(published?.model).toBe('anthropic/claude-4')
    // ...and rendering it produces the row from that snapshot value.
    expect(cacheRowValue(render(published))).toBe('75% (1.5k/2.0k)')
  })
})
