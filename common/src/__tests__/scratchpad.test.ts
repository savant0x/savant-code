import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  acquireScratchpadLease,
  manageScratchpad,
  SCRATCHPAD_POLICY,
} from '../util/scratchpad'
import { deleteUnchanged } from '../util/scratchpad/scan'

const roots: string[] = []
const now = Date.now()
const hour = 60 * 60 * 1000

afterEach(async () => {
  for (const root of roots.splice(0))
    await fs.rm(root, { recursive: true, force: true })
})

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'savant-scratch-'))
  roots.push(root)
  const scratch = path.join(root, 'dev/scratchpad')
  await fs.mkdir(path.join(scratch, 'active'), { recursive: true })
  return { root, scratch }
}

async function file(
  scratch: string,
  name: string,
  ageHours: number,
  text = 'data',
) {
  const target = path.join(scratch, name)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, text)
  const date = new Date(now - ageHours * hour)
  await fs.utimes(target, date, date)
  return target
}

describe('managed scratchpad', () => {
  test('expires nested active/archive files and preserves recent files and root metadata', async () => {
    const { root, scratch } = await fixture()
    await file(scratch, 'active/old.log', 25)
    await file(scratch, 'archive/old.md', 48)
    await file(scratch, 'active/current.md', 0)
    await file(scratch, 'README.md', 48)
    await file(scratch, '.gitkeep', 48)
    const status = await manageScratchpad(root)
    expect(status.files).toBe(3)
    const report = await manageScratchpad(root, { clean: true, now })
    expect(report.removedFiles).toBe(2)
    expect(report.files).toBe(1)
    expect(await fs.readFile(path.join(scratch, 'README.md'), 'utf8')).toBe(
      'data',
    )
    expect(
      await fs.access(path.join(scratch, 'archive')).then(
        () => true,
        () => false,
      ),
    ).toBe(false)
  })

  test('quota prunes oldest eligible files but respects one-hour grace', async () => {
    const { root, scratch } = await fixture()
    await file(scratch, 'active/old', 3, '1234')
    await file(scratch, 'active/recent', 0, '123456789')
    const policy = { ...SCRATCHPAD_POLICY, maxFiles: 1, maxBytes: 5 }
    const report = await manageScratchpad(root, { clean: true, now, policy })
    expect(report.removedFiles).toBe(1)
    expect(report.overQuota).toBe(true)
    expect(await fs.readFile(path.join(scratch, 'active/recent'), 'utf8')).toBe(
      '123456789',
    )
  })

  test('overlapping live leases protect flat files until the last run settles', async () => {
    const { root, scratch } = await fixture()
    await file(scratch, 'old', 48)
    const first = await acquireScratchpadLease(root)
    const second = await acquireScratchpadLease(root)
    expect((await manageScratchpad(root, { clean: true, now })).protected).toBe(
      true,
    )
    await first()
    expect(
      (await manageScratchpad(root, { clean: true, now })).removedFiles,
    ).toBe(0)
    await second()
    expect(
      (await manageScratchpad(root, { clean: true, now })).removedFiles,
    ).toBe(1)
  })

  test('reclaims a dead subprocess lease after a crash', async () => {
    const { root, scratch } = await fixture()
    const process = Bun.spawn([processExecutable(), '-e', ''], {
      stdout: 'ignore',
    })
    await process.exited
    const control = path.join(root, '.savant/scratchpad-lifecycle')
    await fs.mkdir(control, { recursive: true })
    await fs.writeFile(
      path.join(control, 'dead.lease.json'),
      JSON.stringify({ pid: process.pid, token: 'dead' }),
    )
    await file(scratch, 'old', 48)
    expect(
      (await manageScratchpad(root, { clean: true, now })).removedFiles,
    ).toBe(1)
  })

  test('malformed leases block deletion with a diagnostic', async () => {
    const { root, scratch } = await fixture()
    const release = await acquireScratchpadLease(root)
    await release()
    await fs.writeFile(
      path.join(root, '.savant/scratchpad-lifecycle/bad.lease.json'),
      '{}',
    )
    await file(scratch, 'old', 48)
    const report = await manageScratchpad(root, { clean: true, now })
    expect(report.removedFiles).toBe(0)
    expect(report.complete).toBe(false)
    expect(report.warning).toContain('Invalid scratchpad owner')
  })

  test('does not follow directory links, including a linked scratch root', async () => {
    const { root, scratch } = await fixture()
    const outside = path.join(root, 'evidence')
    await fs.mkdir(outside)
    await file(outside, 'keep', 48)
    await fs.symlink(
      outside,
      path.join(scratch, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    expect(
      (await manageScratchpad(root, { clean: true, now })).skippedLinks,
    ).toBe(1)
    expect(await fs.readFile(path.join(outside, 'keep'), 'utf8')).toBe('data')
    await fs.rm(scratch, { recursive: true })
    await fs.symlink(
      outside,
      scratch,
      process.platform === 'win32' ? 'junction' : 'dir',
    )
    expect(
      (await manageScratchpad(root, { clean: true, now })).warning,
    ).toContain('linked paths')
    expect(await fs.readFile(path.join(outside, 'keep'), 'utf8')).toBe('data')
  })

  test('does not delete a file modified since its scan', async () => {
    const { root, scratch } = await fixture()
    const target = await file(scratch, 'active/old', 48)
    const stat = await fs.stat(target)
    await fs.writeFile(target, 'new content')
    expect(
      await deleteUnchanged(root, {
        file: target,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        dev: stat.dev,
        ino: stat.ino,
      }),
    ).toBe(false)
  })

  test('bounded scans report incomplete and progressively prune proven excess', async () => {
    const { root, scratch } = await fixture()
    for (let index = 0; index < 8; index++)
      await file(scratch, `active/${index}`, 2)
    const policy = { ...SCRATCHPAD_POLICY, scanLimit: 5, maxFiles: 1 }
    const first = await manageScratchpad(root, { clean: true, now, policy })
    expect(first.complete).toBe(false)
    expect(first.removedFiles).toBeGreaterThan(0)
    for (let index = 0; index < 5; index++)
      await manageScratchpad(root, { clean: true, now, policy })
    expect((await manageScratchpad(root)).files).toBe(1)
  })

  test('a project without scratch does not acquire control state', async () => {
    const { root, scratch } = await fixture()
    await fs.rm(scratch, { recursive: true })
    expect(
      (await manageScratchpad(root, { clean: true })).warning,
    ).toBeUndefined()
    expect(
      await fs.access(path.join(root, '.savant')).then(
        () => true,
        () => false,
      ),
    ).toBe(false)
  })
})

function processExecutable(): string {
  return process.execPath
}
