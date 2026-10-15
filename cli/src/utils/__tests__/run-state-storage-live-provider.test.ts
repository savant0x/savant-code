import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import { readChatMeta } from '../chat-meta'
import {
  saveChatState,
  setChatDirOverrideForTesting,
  setLiveChatStateProvider,
  clearLiveChatStateProvider,
  flushLiveChatState,
  scheduleCheckpointSave,
  settleCheckpointSave,
} from '../run-state-storage'

import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

describe('live chat state provider', () => {
  // Point persistence at a temp dir via the explicit test override — module
  // seams (mock.module, HOME, spyOn on auth) are unreliable across bun test
  // files and platforms.
  const chatDir = path.join(os.tmpdir(), 'savant-code-test-live-chatdir')
  const testRunState = (marker: string): RunState =>
    ({
      output: { type: 'error', message: marker },
    }) as unknown as RunState
  const testMessages = (marker: string): ChatMessage[] => [
    {
      id: 'msg-1',
      variant: 'user',
      content: marker,
      timestamp: new Date().toISOString(),
    },
  ]
  const readSavedMessages = () =>
    JSON.parse(
      fs.readFileSync(path.join(chatDir, 'chat-messages.json'), 'utf8'),
    ) as ChatMessage[]
  beforeEach(() => {
    fs.rmSync(chatDir, { recursive: true, force: true })
    setChatDirOverrideForTesting(chatDir)
  })
  afterEach(() => {
    clearLiveChatStateProvider('run-a')
    clearLiveChatStateProvider('run-b')
    setChatDirOverrideForTesting(undefined)
    fs.rmSync(chatDir, { recursive: true, force: true })
  })
  test('flushLiveChatState persists the provided state', () => {
    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('checkpoint'),
      messages: testMessages('in-flight prompt'),
    }))
    flushLiveChatState()
    expect(readSavedMessages()[0].content).toBe('in-flight prompt')
  })
  test('flushLiveChatState is a no-op with no provider registered', () => {
    flushLiveChatState()
    expect(fs.existsSync(path.join(chatDir, 'chat-messages.json'))).toBe(false)
  })
  test('clearLiveChatStateProvider stops flushing', () => {
    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('checkpoint'),
      messages: testMessages('in-flight prompt'),
    }))
    clearLiveChatStateProvider('run-a')
    flushLiveChatState()
    expect(fs.existsSync(path.join(chatDir, 'chat-messages.json'))).toBe(false)
  })
  test('a stale run cannot clear a newer run provider', () => {
    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('old'),
      messages: testMessages('old prompt'),
    }))
    setLiveChatStateProvider('run-b', () => ({
      runState: testRunState('new'),
      messages: testMessages('new prompt'),
    }))
    // The old run settling late must not remove the new run's provider.
    clearLiveChatStateProvider('run-a')
    flushLiveChatState()
    expect(readSavedMessages()[0].content).toBe('new prompt')
  })
  test('flushLiveChatState swallows provider errors', () => {
    setLiveChatStateProvider('run-a', () => {
      throw new Error('boom')
    })
    expect(() => flushLiveChatState()).not.toThrow()
  })
  // FID-2026-0804-008: the exit flush must not downgrade a chat the turn-end
  // save already marked complete, or /history shows every session as
  // interrupted.
  test('flush preserves completed:true for a chat the turn-end save completed', () => {
    // Turn-end authoritative save marks the chat complete.
    saveChatState(testRunState('final'), testMessages('final prompt'))
    expect(readChatMeta(chatDir)?.completed).toBe(true)

    // A later process exit flushes a still-registered live provider. It must
    // preserve the existing completion flag, not rewrite completed:false.
    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('checkpoint'),
      messages: testMessages('in-flight prompt'),
    }))
    flushLiveChatState()
    expect(readChatMeta(chatDir)?.completed).toBe(true)
  })

  // FID-2026-0806-012: a circular reference in the run state must never throw
  // and lose the checkpoint (which would break --continue/resume).
  test('saveChatState survives a cyclic run state (sync path)', () => {
    const cyclicRunState = testRunState('cyclic') as Record<string, unknown>
    cyclicRunState.self = cyclicRunState

    expect(() =>
      saveChatState(
        cyclicRunState as unknown as RunState,
        testMessages('cyclic prompt'),
      ),
    ).not.toThrow()

    const onDisk = fs.readFileSync(path.join(chatDir, 'run-state.json'), 'utf8')
    expect(onDisk).toContain('[Circular]')
    expect(readSavedMessages()[0].content).toBe('cyclic prompt')
  })

  test('scheduleCheckpointSave survives a cyclic run state (async path)', async () => {
    const cyclicRunState = testRunState('cyclic-async') as Record<
      string,
      unknown
    >
    cyclicRunState.self = cyclicRunState

    scheduleCheckpointSave(
      cyclicRunState as unknown as RunState,
      testMessages('cyclic async prompt'),
    )
    await settleCheckpointSave()

    const onDisk = fs.readFileSync(path.join(chatDir, 'run-state.json'), 'utf8')
    expect(onDisk).toContain('[Circular]')
    expect(readSavedMessages()[0].content).toBe('cyclic async prompt')
  })
  test('flush preserves completed:true across queued checkpoint writes', () => {
    // Completed chat whose chat dir still holds a queued checkpoint (e.g. an
    // abort-then-switch queued a final checkpoint for the original chat).
    saveChatState(testRunState('final'), testMessages('final prompt'))
    scheduleCheckpointSave(
      testRunState('checkpoint'),
      testMessages('checkpoint prompt'),
      chatDir,
    )
    flushLiveChatState()
    expect(readChatMeta(chatDir)?.completed).toBe(true)
  })
  test('flush keeps completed:false for genuinely interrupted chats', () => {
    // Mid-run chat with no turn-end save: the exit flush must keep it
    // incomplete so the /history interrupted marker stays meaningful.
    saveChatState(
      testRunState('checkpoint'),
      testMessages('in-flight prompt'),
      chatDir,
      '',
      false,
    )
    expect(readChatMeta(chatDir)?.completed).toBe(false)

    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('checkpoint'),
      messages: testMessages('in-flight prompt'),
    }))
    flushLiveChatState()
    expect(readChatMeta(chatDir)?.completed).toBe(false)
  })
  test('flush keeps a brand-new in-flight chat incomplete (no sidecar yet)', () => {
    // No prior save at all: the first exit-flush write marks it incomplete.
    setLiveChatStateProvider('run-a', () => ({
      runState: testRunState('checkpoint'),
      messages: testMessages('in-flight prompt'),
    }))
    flushLiveChatState()
    expect(readChatMeta(chatDir)?.completed).toBe(false)
  })
})
