import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

import {
  loadMostRecentChatState,
  saveChatState,
  setChatDirOverrideForTesting,
  scheduleCheckpointSave,
  settleCheckpointSave,
} from '../run-state-storage'

import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

describe('atomic save and resilient load', () => {
  const chatDir = path.join(os.tmpdir(), 'savant-code-test-resilient-chatdir')
  const runState = { output: { type: 'error', message: 'x' } } as RunState
  const messages: ChatMessage[] = [
    {
      id: 'msg-1',
      variant: 'user',
      content: 'the prompt',
      timestamp: new Date().toISOString(),
    },
  ]
  beforeEach(() => {
    fs.rmSync(chatDir, { recursive: true, force: true })
    setChatDirOverrideForTesting(chatDir)
  })
  afterEach(() => {
    setChatDirOverrideForTesting(undefined)
    fs.rmSync(chatDir, { recursive: true, force: true })
  })
  test('saveChatState leaves no .tmp files behind', () => {
    saveChatState(runState, messages)
    const leftovers = fs
      .readdirSync(chatDir)
      .filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toHaveLength(0)
    expect(
      JSON.parse(
        fs.readFileSync(path.join(chatDir, 'chat-messages.json'), 'utf8'),
      ),
    ).toHaveLength(1)
  })
  test('torn run-state.json still restores the transcript', () => {
    saveChatState(runState, messages)
    fs.writeFileSync(
      path.join(chatDir, 'run-state.json'),
      '{"sessionState": {"trunc',
    )
    const loaded = loadMostRecentChatState()
    expect(loaded).not.toBeNull()
    expect(loaded!.messages[0].content).toBe('the prompt')
    expect(loaded!.runState.output.type).toBe('error')
  })
  test('torn chat-messages.json still restores the run state', () => {
    saveChatState(runState, messages)
    fs.writeFileSync(path.join(chatDir, 'chat-messages.json'), '[{"id":')
    const loaded = loadMostRecentChatState()
    expect(loaded).not.toBeNull()
    expect(loaded!.messages).toHaveLength(0)
    expect((loaded!.runState.output as any).message).toBe('x')
  })
  test('returns null when both files are unreadable', () => {
    saveChatState(runState, messages)
    fs.writeFileSync(path.join(chatDir, 'run-state.json'), '{')
    fs.writeFileSync(path.join(chatDir, 'chat-messages.json'), '[')
    expect(loadMostRecentChatState()).toBeNull()
  })
  test('saveChatState marks the session as complete', () => {
    saveChatState(runState, messages)
    const meta = JSON.parse(
      fs.readFileSync(path.join(chatDir, 'chat-meta.json'), 'utf8'),
    )
    expect(meta.completed).toBe(true)
  })
})

describe('scheduleCheckpointSave (async, coalescing)', () => {
  const chatDir = path.join(os.tmpdir(), 'savant-code-test-checkpoint-chatdir')
  const runState = (marker: string) =>
    ({ output: { type: 'error', message: marker } }) as unknown as RunState
  const messages = (marker: string): ChatMessage[] => [
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
  afterEach(async () => {
    await settleCheckpointSave()
    setChatDirOverrideForTesting(undefined)
    fs.rmSync(chatDir, { recursive: true, force: true })
  })
  test('persists the scheduled state after settling', async () => {
    scheduleCheckpointSave(runState('a'), messages('first'))
    await settleCheckpointSave()
    expect(readSavedMessages()[0].content).toBe('first')
  })
  test('does not write synchronously (deferred off the calling tick)', () => {
    scheduleCheckpointSave(runState('a'), messages('deferred'))
    // Nothing on disk yet: the write is scheduled for a later tick.
    expect(fs.existsSync(path.join(chatDir, 'chat-messages.json'))).toBe(false)
  })
  test('coalesces a burst to the latest state', async () => {
    scheduleCheckpointSave(runState('a'), messages('one'))
    scheduleCheckpointSave(runState('b'), messages('two'))
    scheduleCheckpointSave(runState('c'), messages('three'))
    await settleCheckpointSave()
    // Whatever intermediate states were dropped, the newest wins.
    expect(readSavedMessages()[0].content).toBe('three')
  })
  test('an authoritative save after settling is the last write (no clobber)', async () => {
    scheduleCheckpointSave(runState('a'), messages('checkpoint'))
    // settle waits for the queued async write to flush, so the synchronous
    // final save below is guaranteed to land last.
    await settleCheckpointSave()
    saveChatState(runState('final'), messages('authoritative'))
    // Give any lingering async write a chance to (incorrectly) land on top.
    await new Promise((r) => setImmediate(r))
    await settleCheckpointSave()
    expect(readSavedMessages()[0].content).toBe('authoritative')
  })
  test('settleCheckpointSave is safe with nothing scheduled', async () => {
    await expect(settleCheckpointSave()).resolves.toBeUndefined()
  })
  test('checkpoint save marks the session as incomplete', async () => {
    scheduleCheckpointSave(
      runState('checkpoint'),
      messages('checkpoint prompt'),
    )
    await settleCheckpointSave()
    const meta = JSON.parse(
      fs.readFileSync(path.join(chatDir, 'chat-meta.json'), 'utf8'),
    )
    expect(meta.completed).toBe(false)
  })
})
