import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test'

import type { CompactionStatus } from '@savant-code/common/types/session-state'
import type { RunState } from '@savant-code/sdk'

// Ensure required env vars exist so logger/env parsing succeeds in tests
// (same pattern as send-message.test.ts).
const ensureEnv = () => {
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT =
    process.env.NEXT_PUBLIC_CB_ENVIRONMENT || 'test'
  process.env.NEXT_PUBLIC_SAVANT_CODE_APP_URL =
    process.env.NEXT_PUBLIC_SAVANT_CODE_APP_URL ||
    'https://app.savant-code.test'
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@savant-code.test'
  process.env.NEXT_PUBLIC_POSTHOG_API_KEY =
    process.env.NEXT_PUBLIC_POSTHOG_API_KEY || 'phc_test_key'
  process.env.NEXT_PUBLIC_POSTHOG_HOST_URL =
    process.env.NEXT_PUBLIC_POSTHOG_HOST_URL ||
    'https://posthog.savant-code.test'
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_123'
  process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL =
    process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL ||
    'https://stripe.savant-code.test'
  process.env.NEXT_PUBLIC_WEB_PORT = process.env.NEXT_PUBLIC_WEB_PORT || '3000'
}
ensureEnv()

// Capture the REAL modules before the stubs below replace them, so this
// suite hands them back when it finishes (process-global mock.module).
const runStateStorageActual = await import('../../../utils/run-state-storage')
const savantFreeModelStoreActual =
  await import('../../../state/savant-free-model-store')

// adoptAndPersist must never touch the filesystem in tests: stub the
// persistence layer with inert mocks.
mock.module('../../../utils/run-state-storage', () => ({
  clearLiveChatStateProvider: () => {},
  getLiveChatStateProvider: () => undefined,
  resolveCurrentChatDir: () => '/tmp/test-chat',
  setChatDirOverrideForTesting: () => {},
  setLiveChatStateProvider: () => {},
  flushLiveChatState: async () => {},
  saveChatState: () => {},
  scheduleCheckpointSave: () => {},
  settleCheckpointSave: async () => {},
  clearChatState: () => {},
  loadMostRecentChatState: () => null,
  getAllToggleIdsFromMessages: () => [],
}))
mock.module('../../../state/savant-free-model-store', () => ({
  getSelectedSavantFreeModel: () => null,
}))

const { useChatStore } = await import('../../../state/chat-store')
const { createRunLifecycle } = await import('../send-message-lifecycle')

afterAll(() => {
  mock.module('../../../utils/run-state-storage', () => runStateStorageActual)
  mock.module(
    '../../../state/savant-free-model-store',
    () => savantFreeModelStoreActual,
  )
})

/**
 * FID-2026-0828-001: adoptAndPersist is the authoritative terminal-state
 * delivery for the sidebar compaction surfaces. The 2s heartbeat mirrors
 * compactionStatus/lastCompactionReport only while a run is alive, and
 * compact-and-stop runs (manual /compact) resolve before the next 5s
 * snapshot tick — the terminal `pruned` phase and summary report were
 * dropped on the floor. The final RunState carries them; adoptAndPersist
 * must mirror them exactly like contextTokenCount.
 */
describe('adoptAndPersist compaction mirror (FID-2026-0828-001)', () => {
  beforeEach(() => {
    useChatStore.getState().setCompactionStatus(null)
    useChatStore.getState().clearCompactionEvents()
    useChatStore.getState().setLastCompactionReport(null)
    useChatStore.getState().resetSidebarData()
  })

  const buildLifecycle = () =>
    createRunLifecycle({
      previousRunStateRef: { current: null },
      abortController: new AbortController(),
      aiMessageId: 'test-ai-message',
      finalContent: '/compact',
      setRunState: () => {},
      setIsRetrying: () => {},
    })

  const finalRunState = (overrides?: {
    compactionStatus?: CompactionStatus | null
  }) =>
    ({
      output: { type: 'finish' },
      sessionState: {
        mainAgentState: {
          contextTokenCount: 8421,
          compactionStatus: overrides?.compactionStatus ?? {
            phase: 'pruned',
            tokensSaved: 45123,
            percentUsed: 3,
          },
          lastCompactionReport: {
            summaryExcerpt:
              'Compaction summary: the operator listed workspace files and enabled the feature flag; the suite passed.',
            removedMessages: 14,
            tokensSaved: 45123,
            percentUsed: 3,
          },
        },
      },
    }) as unknown as RunState

  test('mirrors the terminal pruned phase from the final run state', async () => {
    // Simulate the heartbeat having mirrored the in-flight phase mid-run.
    useChatStore.getState().setCompactionStatus({ phase: 'compacting' })
    expect(useChatStore.getState().compactionCount).toBe(0)

    const lifecycle = buildLifecycle()
    await lifecycle.adoptAndPersist(finalRunState())

    const status = useChatStore.getState().compactionStatus
    expect(status?.phase).toBe('pruned')
  })

  test('the compacting → pruned transition records the lifecycle run + counter', async () => {
    useChatStore.getState().setCompactionStatus({ phase: 'compacting' })

    const lifecycle = buildLifecycle()
    await lifecycle.adoptAndPersist(finalRunState())

    const state = useChatStore.getState()
    expect(state.compactionCount).toBe(1)
    const last = state.compactionEvents[state.compactionEvents.length - 1]
    expect(last?.outcome).toBe('pruned')
    expect(last?.tokensSaved).toBe(45123)
    expect(last?.percentUsed).toBe(3)
  })

  test('mirrors lastCompactionReport (the summary excerpt source)', async () => {
    const lifecycle = buildLifecycle()
    await lifecycle.adoptAndPersist(finalRunState())

    const report = useChatStore.getState().lastCompactionReport
    expect(report?.summaryExcerpt).toContain('Compaction summary:')
    expect(report?.removedMessages).toBe(14)
  })

  test('mirrors the recounted token count exactly', async () => {
    const lifecycle = buildLifecycle()
    await lifecycle.adoptAndPersist(finalRunState())

    expect(useChatStore.getState().contextTokensUsed).toBe(8421)
  })

  test('a run ending in idle status records no lifecycle run', async () => {
    useChatStore.getState().setCompactionStatus({ phase: 'compacting' })

    const lifecycle = buildLifecycle()
    await lifecycle.adoptAndPersist(
      finalRunState({ compactionStatus: { phase: 'idle', percentUsed: 4 } }),
    )

    expect(useChatStore.getState().compactionCount).toBe(0)
    expect(useChatStore.getState().compactionStatus?.phase).toBe('idle')
  })
})
