import { describe, expect, test } from 'bun:test'

import { childProcessToPromise } from '../run-state'

import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

type Handler = (...args: unknown[]) => void

function createFakeChildProcess() {
  const handlers = new Map<string, Handler[]>()
  const proc = {
    stdout: {
      on: (event: string, cb: Handler) => {
        handlers.set(`stdout:${event}`, [
          ...(handlers.get(`stdout:${event}`) ?? []),
          cb,
        ])
      },
    },
    stderr: {
      on: (event: string, cb: Handler) => {
        handlers.set(`stderr:${event}`, [
          ...(handlers.get(`stderr:${event}`) ?? []),
          cb,
        ])
      },
    },
    on: (event: string, cb: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), cb])
    },
    kill: () => {},
  } as unknown as ReturnType<SavantCodeSpawn>

  return {
    proc,
    emit: (event: string, ...args: unknown[]) => {
      for (const cb of handlers.get(event) ?? []) cb(...args)
    },
    emitStdout: (chunk: string) => {
      for (const cb of handlers.get('stdout:data') ?? []) cb(Buffer.from(chunk))
    },
  }
}

describe('childProcessToPromise (FID-2026-0802-008 T1)', () => {
  test('rejects with a timeout error when the child never closes', async () => {
    const { proc } = createFakeChildProcess()
    await expect(childProcessToPromise(proc, 30, 1024)).rejects.toThrow(
      'timed out',
    )
  })

  test('resolves normally on close code 0', async () => {
    const { proc, emitStdout, emit } = createFakeChildProcess()
    const promise = childProcessToPromise(proc, 1000, 1024)
    emitStdout('hello')
    emit('close', 0)
    await expect(promise).resolves.toEqual({ stdout: 'hello', stderr: '' })
  })

  test('caps accumulated stdout at the buffer limit', async () => {
    const { proc, emitStdout, emit } = createFakeChildProcess()
    const promise = childProcessToPromise(proc, 1000, 10)
    emitStdout('a'.repeat(5))
    emitStdout('b'.repeat(5))
    emitStdout('c'.repeat(5))
    emit('close', 0)
    const { stdout } = await promise
    // 5 + 5 fills the 10-byte budget; the third chunk is fully truncated.
    expect(stdout).toBe('aaaaabbbbb')
  })
})
