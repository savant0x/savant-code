import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { manageScratchpad } from '@savant-code/common/util/scratchpad'
import { afterEach, expect, test } from 'bun:test'

import { withRunScratchpad } from '../scratchpad'

import type { RunExecutionOptions } from '../../types'

const roots: string[] = []
afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true })
})

async function options(): Promise<RunExecutionOptions> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'savant-sdk-scratch-'))
  roots.push(cwd)
  await fs.mkdir(path.join(cwd, 'dev/scratchpad'), { recursive: true })
  return { cwd, fingerprintId: 'test', agent: 'test-agent', prompt: 'test' }
}

test('native execution holds a live lease and releases after a rejected operation', async () => {
  const input = await options()
  await expect(
    withRunScratchpad(input, async () => {
      expect((await manageScratchpad(input.cwd ?? '')).protected).toBe(true)
      throw new Error('injected run failure')
    }),
  ).rejects.toThrow('injected run failure')
  expect((await manageScratchpad(input.cwd ?? '')).protected).toBe(false)
})

test('native completion sweeps aged artifacts created during the run', async () => {
  const input = await options()
  const value = await withRunScratchpad(input, async () => {
    const target = path.join(input.cwd ?? '', 'dev/scratchpad/test.log')
    await fs.writeFile(target, 'retained while running')
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000)
    await fs.utimes(target, old, old)
    expect(
      (await manageScratchpad(input.cwd ?? '', { clean: true })).removedFiles,
    ).toBe(0)
    return 'completed'
  })
  expect(value).toBe('completed')
  expect((await manageScratchpad(input.cwd ?? '')).files).toBe(0)
})

test('injected filesystem factories resolve once without host housekeeping', async () => {
  const input = await options()
  let calls = 0
  const injected = { ...fs }
  input.fsSource = () => {
    calls++
    return injected
  }
  await withRunScratchpad(input, async (resolved) => {
    expect(resolved.fsSource).toBe(injected)
    expect(
      await fs.access(path.join(input.cwd ?? '', '.savant')).then(
        () => true,
        () => false,
      ),
    ).toBe(false)
  })
  expect(calls).toBe(1)
  expect(
    await fs.access(path.join(input.cwd ?? '', '.savant')).then(
      () => true,
      () => false,
    ),
  ).toBe(false)
})
