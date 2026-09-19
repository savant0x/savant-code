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

describe('CompactionSignal (FID-2026-0919-017: in-flight-only slot)', () => {
  beforeEach(() => {
    compactionState.compactionStatus = null
    compactionState.compactionEvents = []
    delete (compactionState as Record<string, unknown>).lastCompactionReport
  })

  test('compacting phase renders the in-flight line inside the traffic-lights chrome', () => {
    compactionState.compactionStatus = { phase: 'compacting' }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toContain('⚙')
    expect(markup).toContain('Compacting context…')
    expect(markup).toContain('●')
  })

  test('IN-FLIGHT ONLY: terminal status paints nothing (FID-2026-0919-017)', () => {
    compactionState.compactionStatus = {
      phase: 'compacted',
      tokensSaved: 1_500,
      percentUsed: 62,
    }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    // The trailing scrollbox slot must not become a fake last message.
    expect(markup).toBe('')
  })

  test('IN-FLIGHT ONLY: warning status paints nothing (FID-2026-0919-017)', () => {
    compactionState.compactionStatus = { phase: 'warning', percentUsed: 87 }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toBe('')
  })

  test('IN-FLIGHT ONLY: blocked status paints nothing (FID-2026-0919-017)', () => {
    compactionState.compactionStatus = {
      phase: 'blocked',
      percentUsed: 91,
      blockReason: 'circuit-breaker-open',
    }

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toBe('')
  })

  test('IN-FLIGHT ONLY: terminal events paint nothing (FID-2026-0919-017)', () => {
    compactionState.compactionEvents = [
      {
        at: Date.now(),
        outcome: 'pruned',
        tokensSaved: 1_234,
        percentUsed: 61,
      },
    ]

    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toBe('')
  })

  test('renders nothing without status or events', () => {
    const markup = renderToStaticMarkup(<CompactionSignal />)

    expect(markup).toBe('')
  })
})

describe('CompactionReportExcerpt (FID-2026-0916-008: fold contract, prop-driven)', () => {
  test('renders the FULL excerpt when explicitly expanded', () => {
    const longExcerpt = [
      `Folded exchange: ${'x'.repeat(200)}`,
      '',
      'SECRET-BEYOND-PREVIEW-TEXT',
    ].join('\n')
    const report = {
      summaryExcerpt: longExcerpt,
      removedMessages: 3,
      tokensSaved: 1_200,
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

    expect(markup).toContain('▴ collapse')
    expect(markup).toContain('SECRET-BEYOND-PREVIEW-TEXT')
    expect(markup).toContain('removed 3 messages')
  })

  test('COLLAPSED hides the full excerpt behind the preview', () => {
    const longExcerpt = [
      `Folded exchange: ${'x'.repeat(200)}`,
      '',
      'SECRET-BEYOND-PREVIEW-TEXT',
    ].join('\n')
    const report = {
      summaryExcerpt: longExcerpt,
      removedMessages: 3,
      tokensSaved: 1_200,
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

  test('omits the ellipsis when the excerpt fits the preview', () => {
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
    expect(markup).not.toContain('…')
  })
})
