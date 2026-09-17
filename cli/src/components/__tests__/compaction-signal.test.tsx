import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
// Capture the REAL chat-store module before the stub below replaces it, so
// this suite can hand it back when it finishes.
import * as chatStoreActual from '../../state/chat-store'
// TrafficLights mounts useAnimationBudget (@opentui/react focus/renderer
// hooks) which throws under react-dom/server without these inert stubs.
import { mockOpentuiReactForStaticRender } from '../tools/__tests__/helpers/mock-opentui-react-static'

import type { CompactionLifecycleEvent } from '../../state/chat-store/chat-store-common-types'
import type { CompactionStatus } from '@savant-code/common/types/session-state'

const chatStoreActualSnapshot = { ...chatStoreActual }

// zustand v5 serves getInitialState() (not getState()) to selectors under
// react-dom/server, so useChatStore.setState() before renderToStaticMarkup
// never reaches a component selector. The characterization net therefore
// drives the store through a controllable stub module, registered BEFORE the
// component loads (dynamic import below).
const compactionState: {
  compactionStatus: CompactionStatus | null
  compactionEvents: CompactionLifecycleEvent[]
} = { compactionStatus: null, compactionEvents: [] }

mock.module('../../state/chat-store', () => ({
  useChatStore: (selector: (s: typeof compactionState) => unknown): unknown =>
    selector(compactionState),
}))

mockOpentuiReactForStaticRender()
initializeThemeStore()

// Loaded after the stub registration so the component binds the stubbed
// store; a dynamic import keeps the import/order groups intact while
// preserving evaluation order.
const { CompactionReportExcerpt, CompactionSignal } =
  await import('../compaction-signal')

// mock.module registrations are process-global under `bun test`; re-register
// the captured real store so suites loaded after this file (same process)
// see the genuine zustand store instead of the stub.
afterAll(() => {
  mock.module('../../state/chat-store', () => chatStoreActualSnapshot)
})

describe('CompactionSignal (FID-2026-0822-006 characterization)', () => {
  beforeEach(() => {
    compactionState.compactionStatus = null
    compactionState.compactionEvents = []
  })

  test('compacting phase renders the in-flight line inside the traffic-lights chrome', () => {
    compactionState.compactionStatus = { phase: 'compacting' }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('⚙')
    expect(markup).toContain('Compacting context…')
    expect(markup).toContain('●')
  })

  test('blocked phase renders the reasoned block line with its reason', () => {
    compactionState.compactionStatus = {
      phase: 'blocked',
      blockReason: 'circuit-breaker-open',
    }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('⛔')
    expect(markup).toContain('Auto-compact blocked (circuit-breaker-open)')
    expect(markup).toContain('●')
  })

  test('warning phase renders the one-shot threshold warning', () => {
    compactionState.compactionStatus = { phase: 'warning', percentUsed: 87 }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('⚠')
    expect(markup).toContain('Context at 87% of window')
  })

  test('terminal pruned event renders completion with tokens saved and percent', () => {
    compactionState.compactionEvents = [
      {
        at: Date.now(),
        outcome: 'pruned',
        tokensSaved: 1234,
        percentUsed: 61,
      },
    ]

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('✓ Compaction complete')
    expect(markup).toContain('(−1234 tokens)')
    expect(markup).toContain('61% of window')
    expect(markup).toContain('●')
  })

  test('terminal ineffective event renders the ineffective warning', () => {
    compactionState.compactionEvents = [
      { at: Date.now(), outcome: 'ineffective' },
    ]

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('⚠ Compaction ineffective')
    expect(markup).toContain('●')
  })

  test('compacted phase renders the micro-compact completion line', () => {
    compactionState.compactionStatus = { phase: 'compacted', tokensSaved: 850 }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('Micro-compacted')
    expect(markup).toContain('(−850 tokens)')
    expect(markup).toContain('●')
  })

  test('micro-compacted lifecycle event renders distinctly from ineffective', () => {
    compactionState.compactionEvents = [
      { at: Date.now(), outcome: 'compacted', tokensSaved: 420 },
    ]

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('Micro-compaction')
    expect(markup).toContain('−420 tokens')
    expect(markup).not.toContain('ineffective')
  })

  test('surfaces summary excerpt and removed-region counts when present', () => {
    compactionState.compactionEvents = [
      { at: Date.now(), outcome: 'pruned', tokensSaved: 1200 },
    ]
    ;(compactionState as Record<string, unknown>).lastCompactionReport = {
      summaryExcerpt: 'Folded oldest exchange: auth refactor notes',
      removedMessages: 3,
      tokensSaved: 1200,
    }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('removed 3 messages')
    expect(markup).toContain('Folded oldest exchange')
  })

  test('report excerpt is COLLAPSED by default: preview + fold affordance, full text hidden (FID-2026-0916-008)', () => {
    compactionState.compactionEvents = [
      { at: Date.now(), outcome: 'pruned', tokensSaved: 1200 },
    ]
    // A long excerpt whose tail lands past the 160-char preview window.
    const longExcerpt = [
      `Folded exchange: ${'x'.repeat(200)}`,
      '',
      'SECRET-BEYOND-PREVIEW-TEXT',
    ].join('\n')
    ;(compactionState as Record<string, unknown>).lastCompactionReport = {
      summaryExcerpt: longExcerpt,
      removedMessages: 3,
      tokensSaved: 1200,
    }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    // Collapsed affordance prompts to expand.
    expect(markup).toContain('▾ expand')
    // The preview line is present.
    expect(markup).toContain('removed 3 messages')
    // The full excerpt past the preview is folded away, not dumped.
    expect(markup).not.toContain('SECRET-BEYOND-PREVIEW-TEXT')
  })

  test('CompactionReportExcerpt renders the FULL excerpt when explicitly expanded (FID-2026-0916-008)', () => {
    const longExcerpt = [
      `Folded exchange: ${'x'.repeat(200)}`,
      '',
      'SECRET-BEYOND-PREVIEW-TEXT',
    ].join('\n')
    const report = {
      summaryExcerpt: longExcerpt,
      removedMessages: 3,
      tokensSaved: 1200,
    }

    // The static-render harness cannot simulate clicks, so the fold state is
    // driven by props (the same pattern CompactionSummaryBlock uses for
    // isCollapsed) rather than an act() round-trip.
    const markup = renderToStaticMarkup(
      <CompactionReportExcerpt
        report={report}
        reportExpanded={true}
        onToggleExpanded={() => {}}
      />,
    )

    // Expanded affordance prompts to collapse.
    expect(markup).toContain('▴ collapse')
    // The full excerpt — including text past the 160-char preview — renders.
    expect(markup).toContain('SECRET-BEYOND-PREVIEW-TEXT')
    expect(markup).toContain('removed 3 messages')
  })

  test('CompactionReportExcerpt COLLAPSED hides the full excerpt behind the preview (FID-2026-0916-008)', () => {
    const longExcerpt = [
      `Folded exchange: ${'x'.repeat(200)}`,
      '',
      'SECRET-BEYOND-PREVIEW-TEXT',
    ].join('\n')
    const report = {
      summaryExcerpt: longExcerpt,
      removedMessages: 3,
      tokensSaved: 1200,
    }

    const markup = renderToStaticMarkup(
      <CompactionReportExcerpt
        report={report}
        reportExpanded={false}
        onToggleExpanded={() => {}}
      />,
    )

    expect(markup).toContain('▾ expand')
    expect(markup).toContain('removed 3 messages')
    expect(markup).not.toContain('SECRET-BEYOND-PREVIEW-TEXT')
  })

  test('CompactionReportExcerpt omits the ellipsis when the excerpt fits the preview (FID-2026-0916-008)', () => {
    const markup = renderToStaticMarkup(
      <CompactionReportExcerpt
        report={{
          summaryExcerpt: 'Short summary.',
          removedMessages: 1,
          tokensSaved: 50,
        }}
        reportExpanded={false}
        onToggleExpanded={() => {}}
      />,
    )

    expect(markup).toContain('Short summary.')
    expect(markup).toContain('▾ expand')
    // No truncation ellipsis because the excerpt is shorter than the preview.
    expect(markup).not.toContain('…')
  })
  test('renders nothing without status or events', () => {
    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toBe('')
  })
})
