import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { getStubProjectFileContext } from '@savant-code/common/util/file'
import { clearOpenTurnsForTesting } from '@savant-code/sdk'
import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../../../state/chat-store'
import { clearActiveRunAborter } from '../../../utils/active-run'
import { createBatchedMessageUpdater } from '../../../utils/message-updater'
import {
  clearLiveChatStateProvider,
  setChatDirOverrideForTesting,
} from '../../../utils/run-state-storage'
import { createStreamController } from '../../stream-state'
import { createRunLifecycle } from '../send-message-lifecycle'
import { finalizeRunStreaming } from '../send-message-stream'

import type { RunState } from '@savant-code/sdk'

const owner = 'audit-chat-isolation'
let fixtureDir: string | undefined

afterEach(() => {
  clearLiveChatStateProvider(owner)
  clearActiveRunAborter(owner)
  clearOpenTurnsForTesting()
  setChatDirOverrideForTesting(undefined)
  useChatStore.getState().resetSidebarData()
  if (fixtureDir) rmSync(fixtureDir, { recursive: true, force: true })
  fixtureDir = undefined
})

function snapshot(): RunState {
  const sessionState = getInitialSessionState(getStubProjectFileContext())
  sessionState.mainAgentState.contextTokenCount = 1234
  sessionState.mainAgentState.creditsUsed = 4.5
  return {
    traceSessionId: owner,
    output: { type: 'lastMessage', value: [] },
    sessionState,
  }
}

function fixture(settleCheckpointSave = async () => {}) {
  fixtureDir = mkdtempSync(join(tmpdir(), 'savant-chat-isolation-'))
  setChatDirOverrideForTesting(fixtureDir)
  let currentChat = fixtureDir
  let saves = 0
  let checkpoints = 0
  let isCurrentRun = true
  let adoptions = 0
  const abortController = new AbortController()
  const lifecycle = createRunLifecycle({
    previousRunStateRef: { current: null },
    abortController,
    aiMessageId: owner,
    finalContent: 'audit',
    setRunState: () => {
      adoptions += 1
    },
    isCurrentRun: () => isCurrentRun,
    setIsRetrying: () => {},
    storage: {
      resolveCurrentChatDir: () => currentChat,
      saveChatState: () => {
        saves += 1
      },
      scheduleCheckpointSave: () => {
        checkpoints += 1
      },
      settleCheckpointSave,
    },
  })
  lifecycle.start()
  useChatStore.getState().resetSidebarData()
  return {
    lifecycle,
    abortController,
    switchChat: () => {
      currentChat = 'another-chat'
    },
    saves: () => saves,
    checkpoints: () => checkpoints,
    adoptions: () => adoptions,
    replaceRun: () => {
      isCurrentRun = false
    },
  }
}

describe('run lifecycle chat ownership', () => {
  test('same-chat replacement prevents prior run state adoption', async () => {
    const run = fixture()
    run.abortController.abort()
    run.replaceRun()
    await run.lifecycle.adoptAndPersist(snapshot())
    expect(run.lifecycle.getRunChatIsCurrent()).toBe(false)
    expect(run.adoptions()).toBe(0)
    expect(run.saves()).toBe(1)
    expect(useChatStore.getState().contextTokensUsed).toBe(0)
  })
  test('current snapshots update sidebar meters and checkpoint', () => {
    const run = fixture()
    run.lifecycle.onStateSnapshot(snapshot())
    expect(useChatStore.getState().contextTokensUsed).toBe(1234)
    expect(useChatStore.getState().sessionCost).toBe(4.5)
    expect(run.checkpoints()).toBe(1)
  })

  test.each(['switch', 'abort'])(
    '%s prevents late snapshot delivery',
    (cause) => {
      const run = fixture()
      if (cause === 'switch') run.switchChat()
      else run.abortController.abort()
      const lateSnapshot = snapshot()
      run.lifecycle.onStateSnapshot(lateSnapshot)
      expect(useChatStore.getState().contextTokensUsed).toBe(0)
      expect(useChatStore.getState().sessionCost).toBe(0)
      expect(run.checkpoints()).toBe(0)
      expect(run.lifecycle.getLatestRunStateSnapshot()).toBe(lateSnapshot)
    },
  )

  test.each(['completion', 'failure'])(
    '%s rechecks chat after checkpoint drain',
    async (outcome) => {
      const drain = Promise.withResolvers<void>()
      const run = fixture(() => drain.promise)
      const pending =
        outcome === 'completion'
          ? run.lifecycle.adoptAndPersist(snapshot())
          : run.lifecycle.persistFailureState()
      run.switchChat()
      drain.resolve()
      await pending
      expect(run.saves()).toBe(1)
    },
  )

  test('stale finally preserves the new run stream and heartbeat', () => {
    const streamRefs = createStreamController()
    const heartbeat = setInterval(() => {}, 60_000)
    const heartbeatIntervalRef = { current: heartbeat }
    const chain = { current: true }
    const processing = { current: true }
    let stopped = 0
    let queueChanges = 0
    let statusChanges = 0
    const updater = createBatchedMessageUpdater(owner, () => {})
    const abortController = new AbortController()
    abortController.abort()
    try {
      finalizeRunStreaming({
        streamRefs,
        abortController,
        heartbeatIntervalRef,
        stalledWatcher: {
          start: () => {},
          stop: () => {
            stopped += 1
          },
        },
        isChainInProgressRef: chain,
        setStreamStatus: () => {
          statusChanges += 1
        },
        queueReset: {
          setCanProcessQueue: () => {
            queueChanges += 1
          },
          updateChainInProgress: (value) => {
            chain.current = value
          },
          isProcessingQueueRef: processing,
        },
        updater,
        isCurrentRun: false,
      })
      expect(streamRefs.state.runCompleted).toBe(false)
      expect(heartbeatIntervalRef.current).toBe(heartbeat)
      expect(chain.current).toBe(true)
      expect(processing.current).toBe(true)
      expect(stopped + queueChanges + statusChanges).toBe(0)
    } finally {
      clearInterval(heartbeat)
      updater.dispose()
    }
  })
})
