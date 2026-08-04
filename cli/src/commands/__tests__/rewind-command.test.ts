import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  openTurn,
  captureSnapshot,
  closeTurn,
  getTurn,
  listTurns,
} from '@savant-code/sdk'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import {
  executeRewind,
  resolveTurnArg,
  truncateRunStateToHistoryLength,
} from '../../utils/rewind'
import { setChatDirOverrideForTesting } from '../../utils/run-state-storage'

import type { ChatMessage } from '../../types/chat'
import type { RunState } from '@savant-code/sdk'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rewind-cli-'))
  setChatDirOverrideForTesting(tmpDir)
  useChatStore.getState().reset()
})

afterEach(() => {
  setChatDirOverrideForTesting(undefined)
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

const checkpointDir = () => path.join(tmpDir, 'checkpoints')

function write(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, content, 'utf8')
}

/** Seeds a checkpoint for turnId with one modified file. */
function seedTurn(turnId: string, fileName: string): void {
  const file = path.join(tmpDir, fileName)
  write(file, 'original')
  openTurn({
    checkpointDir: checkpointDir(),
    turnId,
    prompt: `prompt ${turnId}`,
  })
  captureSnapshot({ checkpointDir: checkpointDir(), turnId, filePath: file })
  write(file, 'edited')
  closeTurn({
    checkpointDir: checkpointDir(),
    turnId,
    prompt: `prompt ${turnId}`,
  })
}

describe('resolveTurnArg', () => {
  const turns = [
    {
      turnId: 'aaa',
      startedAt: 3,
      endedAt: 3,
      prompt: 'newest',
      fileCount: 1,
      paths: ['x.ts'],
    },
    {
      turnId: 'bbb',
      startedAt: 2,
      endedAt: 2,
      prompt: 'older',
      fileCount: 1,
      paths: ['y.ts'],
    },
  ]

  test('resolves a 1-based index into newest-first order', () => {
    expect(resolveTurnArg(turns, '1')?.turnId).toBe('aaa')
    expect(resolveTurnArg(turns, '2')?.turnId).toBe('bbb')
  })

  test('resolves a full turnId', () => {
    expect(resolveTurnArg(turns, 'bbb')?.turnId).toBe('bbb')
  })

  test('returns undefined for out-of-range index or unknown id', () => {
    expect(resolveTurnArg(turns, '3')).toBeUndefined()
    expect(resolveTurnArg(turns, 'zzz')).toBeUndefined()
    expect(resolveTurnArg(turns, undefined)).toBeUndefined()
  })
})

describe('truncateRunStateToHistoryLength', () => {
  test('truncates messageHistory to the checkpoint boundary', () => {
    const runState = {
      output: { type: 'success' as const, message: '' },
      sessionState: {
        fileContext: {},
        mainAgentState: {
          messageHistory: [
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'user', content: 'c' },
          ],
        },
      },
    } as unknown as RunState

    const truncated = truncateRunStateToHistoryLength(runState, 1)
    expect(
      (
        truncated!.sessionState!.mainAgentState as unknown as {
          messageHistory: Array<{ role: string }>
        }
      ).messageHistory.map((m) => m.role),
    ).toEqual(['user'])
  })

  test('returns the state unchanged when history is already short enough', () => {
    const runState = {
      sessionState: {
        mainAgentState: {
          messageHistory: [{ role: 'user', content: 'a' }],
        },
      },
    } as unknown as RunState
    expect(truncateRunStateToHistoryLength(runState, 5)).toBe(runState)
  })

  test('returns null input untouched', () => {
    expect(truncateRunStateToHistoryLength(null, 5)).toBeNull()
  })
})

describe('executeRewind', () => {
  const setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void = (value) => {
    useChatStore.getState().setMessages(value)
  }

  test('code mode restores files to pre-edit content', () => {
    seedTurn('t1', 'a.ts')
    const file = path.join(tmpDir, 'a.ts')
    expect(fs.readFileSync(file, 'utf8')).toBe('edited')

    const message = executeRewind({
      checkpointDir: checkpointDir(),
      projectRoot: tmpDir,
      turnId: 't1',
      mode: 'code',
      setMessages,
    })
    expect(fs.readFileSync(file, 'utf8')).toBe('original')
    expect(message).toContain('Rewound 1 file')
  })

  test('conversation mode truncates the transcript to the turn boundary', () => {
    // Seed a checkpoint recording a 2-message boundary at turn start.
    const file = path.join(tmpDir, 'a.ts')
    write(file, 'original')
    openTurn({
      checkpointDir: checkpointDir(),
      turnId: 't1',
      prompt: 'p',
      messageCount: 2,
      historyLength: 1,
    })
    captureSnapshot({
      checkpointDir: checkpointDir(),
      turnId: 't1',
      filePath: file,
    })
    write(file, 'edited')
    closeTurn({
      checkpointDir: checkpointDir(),
      turnId: 't1',
      prompt: 'p',
      messageCount: 2,
      historyLength: 1,
    })

    // Store has more messages than the boundary.
    useChatStore
      .getState()
      .setMessages([
        { id: 'm1', role: 'user', content: 'one' } as never,
        { id: 'm2', role: 'assistant', content: 'two' } as never,
        { id: 'm3', role: 'user', content: 'three' } as never,
      ])

    executeRewind({
      checkpointDir: checkpointDir(),
      projectRoot: tmpDir,
      turnId: 't1',
      mode: 'conversation',
      setMessages,
    })

    expect(useChatStore.getState().messages.length).toBe(2)
  })

  test('unknown turn returns a warning message', () => {
    const message = executeRewind({
      checkpointDir: checkpointDir(),
      projectRoot: tmpDir,
      turnId: 'nope',
      mode: 'code',
      setMessages,
    })
    expect(message).toContain('No checkpoint found')
  })

  test('listTurns sees the persisted checkpoint after close', () => {
    seedTurn('t1', 'a.ts')
    const turns = listTurns(checkpointDir())
    expect(turns.length).toBe(1)
    expect(turns[0].prompt).toBe('prompt t1')
    expect(getTurn(checkpointDir(), 't1')).not.toBeNull()
  })
})
