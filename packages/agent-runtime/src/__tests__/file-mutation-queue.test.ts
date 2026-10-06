/**
 * Per-canonical-path file mutation queue (FID-2026-1006-002 WP4).
 *
 * Pins the three claims the FID makes for this work package:
 *   1. two parallel jobs against ONE canonical path never interleave;
 *   2. jobs against DIFFERENT paths still run concurrently (it is a per-path
 *      lane, not a global lock);
 *   3. a rejected job releases its lane — one failed write cannot deadlock
 *      later writes to the same file, and the rejection still reaches its own
 *      caller unchanged.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'bun:test'

import {
  canonicalMutationKey,
  pendingFileMutationLanes,
  withFileMutationQueue,
} from '../tools/tool-executor/file-mutation-queue'

type Trace = string[]

/** A job that records when it starts and ends, yielding the event loop. */
function tracedJob(name: string, trace: Trace, waitMs = 5) {
  return async () => {
    trace.push(`${name}:start`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    trace.push(`${name}:end`)
    return name
  }
}

describe('file mutation queue — serialization', () => {
  it('runs two jobs for one path strictly in order (no interleave)', async () => {
    const trace: Trace = []
    const target = path.join(os.tmpdir(), 'mutation-stage', 'same-file.ts')
    const first = withFileMutationQueue(target, tracedJob('first', trace))
    const second = withFileMutationQueue(target, tracedJob('second', trace))

    await expect(Promise.all([first, second])).resolves.toEqual([
      'first',
      'second',
    ])
    expect(trace).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ])
  })

  it('shares one lane across different spellings of the same path', async () => {
    const trace: Trace = []
    const base = path.join(os.tmpdir(), 'mutation-stage')
    const direct = path.join(base, 'spelled.ts')
    const detour = path.join(base, 'inner', '..', 'spelled.ts')

    expect(canonicalMutationKey(direct)).toBe(canonicalMutationKey(detour))

    const first = withFileMutationQueue(direct, tracedJob('direct', trace))
    const second = withFileMutationQueue(detour, tracedJob('detour', trace))
    await Promise.all([first, second])

    expect(trace).toEqual([
      'direct:start',
      'direct:end',
      'detour:start',
      'detour:end',
    ])
  })

  it('resolves an existing path through realpath (symlink-aware key)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-key-'))
    const file = path.join(dir, 'real.ts')
    fs.writeFileSync(file, '// x\n')
    expect(canonicalMutationKey(file)).toBe(fs.realpathSync.native(file))
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('file mutation queue — concurrency', () => {
  it('runs jobs for different paths concurrently (not a global lock)', async () => {
    const trace: Trace = []
    const dir = path.join(os.tmpdir(), 'mutation-stage')
    const a = withFileMutationQueue(
      path.join(dir, 'a.ts'),
      tracedJob('a', trace, 20),
    )
    const b = withFileMutationQueue(
      path.join(dir, 'b.ts'),
      tracedJob('b', trace, 20),
    )

    await Promise.all([a, b])

    // Both start before either ends — the lanes are independent.
    expect(trace.slice(0, 2).sort()).toEqual(['a:start', 'b:start'])
    expect(trace.slice(2).sort()).toEqual(['a:end', 'b:end'])
  })
})

describe('file mutation queue — failure isolation', () => {
  it('releases the lane on rejection, rethrowing to that caller only', async () => {
    const target = path.join(os.tmpdir(), 'mutation-stage', 'fails.ts')
    const boom = withFileMutationQueue(target, async () => {
      throw new Error('write failed')
    })
    const after = withFileMutationQueue(target, async () => 'after')

    await expect(boom).rejects.toThrow('write failed')
    await expect(after).resolves.toBe('after')
  })

  it('drains every lane once jobs settle (no leak)', async () => {
    const dir = path.join(os.tmpdir(), 'mutation-drain')
    await Promise.all([
      withFileMutationQueue(path.join(dir, 'one.ts'), async () => 1),
      withFileMutationQueue(path.join(dir, 'two.ts'), async () => 2),
    ])
    expect(pendingFileMutationLanes()).toBe(0)
  })
})
