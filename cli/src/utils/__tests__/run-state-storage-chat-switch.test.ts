import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

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

describe('chat switches while saves are pending', () => {
  // Regression tests for /history threads being clobbered: save paths used to
  // be resolved at write time from the mutable current chat id, so a pending
  // write from chat A could land in chat B's directory after a /new or
  // /history resume rotated the id in between.
  const chatDirA = path.join(os.tmpdir(), 'savant-code-test-switch-chat-a')
  const chatDirB = path.join(os.tmpdir(), 'savant-code-test-switch-chat-b')
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
  const messagesFileIn = (dir: string) => path.join(dir, 'chat-messages.json')
  beforeEach(() => {
    fs.rmSync(chatDirA, { recursive: true, force: true })
    fs.rmSync(chatDirB, { recursive: true, force: true })
    setChatDirOverrideForTesting(chatDirA)
  })
  afterEach(async () => {
    await settleCheckpointSave()
    clearLiveChatStateProvider('run-a')
    setChatDirOverrideForTesting(undefined)
    fs.rmSync(chatDirA, { recursive: true, force: true })
    fs.rmSync(chatDirB, { recursive: true, force: true })
  })
  test('a checkpoint scheduled before a chat switch writes to the original chat dir', async () => {
    scheduleCheckpointSave(runState('a'), messages('chat A transcript'))
    // Simulate /new or a /history resume rotating the current chat while the
    // async checkpoint write is still queued.
    setChatDirOverrideForTesting(chatDirB)
    await settleCheckpointSave()
    const saved = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirA), 'utf8'),
    ) as ChatMessage[]
    expect(saved[0].content).toBe('chat A transcript')
    expect(fs.existsSync(messagesFileIn(chatDirB))).toBe(false)
  })
  test('checkpoints for different chats do not displace each other', async () => {
    // Chat A's final flush is queued, then the newly-active chat B schedules
    // its own checkpoint before the queue drains. Both must be written —
    // coalescing is per chat, not global.
    scheduleCheckpointSave(runState('a'), messages('chat A final'), chatDirA)
    scheduleCheckpointSave(runState('b'), messages('chat B first'), chatDirB)
    await settleCheckpointSave()
    const savedA = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirA), 'utf8'),
    ) as ChatMessage[]
    const savedB = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirB), 'utf8'),
    ) as ChatMessage[]
    expect(savedA[0].content).toBe('chat A final')
    expect(savedB[0].content).toBe('chat B first')
  })
  test('saveChatState with an explicit chatDir ignores a later chat switch', () => {
    setChatDirOverrideForTesting(chatDirB)
    // chatDirA was captured while chat A was current (run start).
    saveChatState(runState('a'), messages('chat A final'), chatDirA)
    const saved = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirA), 'utf8'),
    ) as ChatMessage[]
    expect(saved[0].content).toBe('chat A final')
    expect(fs.existsSync(messagesFileIn(chatDirB))).toBe(false)
  })
  test('flushLiveChatState after a chat switch writes nothing', () => {
    setLiveChatStateProvider('run-a', () => ({
      runState: runState('a'),
      // After the switch the store holds the NEW chat's messages; flushing
      // them into chat A's directory would replace A's transcript.
      messages: messages('chat B messages'),
    }))
    setChatDirOverrideForTesting(chatDirB)
    flushLiveChatState()
    expect(fs.existsSync(messagesFileIn(chatDirA))).toBe(false)
    expect(fs.existsSync(messagesFileIn(chatDirB))).toBe(false)
  })
  test('flushLiveChatState drains queued checkpoints synchronously on exit', () => {
    // A chat switch aborted the run and queued its final checkpoint, then the
    // process exits before the async drain runs. The exit flush must write
    // the queued checkpoint (to chat A) even though the current chat is B.
    scheduleCheckpointSave(runState('a'), messages('aborted turn'), chatDirA)
    setChatDirOverrideForTesting(chatDirB)
    flushLiveChatState()
    const saved = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirA), 'utf8'),
    ) as ChatMessage[]
    expect(saved[0].content).toBe('aborted turn')
    expect(fs.existsSync(messagesFileIn(chatDirB))).toBe(false)
  })
  test('flushLiveChatState still writes to the run chat dir when unswitched', () => {
    setLiveChatStateProvider('run-a', () => ({
      runState: runState('a'),
      messages: messages('in-flight prompt'),
    }))
    flushLiveChatState()
    const saved = JSON.parse(
      fs.readFileSync(messagesFileIn(chatDirA), 'utf8'),
    ) as ChatMessage[]
    expect(saved[0].content).toBe('in-flight prompt')
  })
})
