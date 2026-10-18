import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import { FID, REPO, memoryFs, memoryGit } from './fid-worktree-fixtures'
import { REAL_FID, REAL_GIT_TIMEOUT_MS, realRepo } from './fid-worktree-real'
import {
  disposeFidWorktree,
  provisionFidWorktree,
} from '../echo/parallel/fid-worktree'
import { defaultWorktreeFs } from '../echo/parallel/fid-worktree-record'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

function fixture() {
  const root = realRepo()
  roots.push(root)
  const sentinels = ['node_modules', 'cli/node_modules'].map((relative) => {
    const directory = path.join(root, relative)
    mkdirSync(directory, { recursive: true })
    const file = path.join(directory, 'sentinel.txt')
    writeFileSync(file, `preserve ${relative}`)
    return { file, bytes: readFileSync(file, 'utf8') }
  })
  return { root, sentinels }
}

for (const recordless of [false, true]) {
  test(
    `real disposal preserves root and workspace link targets (recordless=${recordless})`,
    () => {
      const { root, sentinels } = fixture()
      const created = provisionFidWorktree({ repoRoot: root, fidId: REAL_FID })
      expect(created.ok).toBe(true)
      if (!created.ok) return
      expect(created.record.dependencyLinks).toEqual([
        'node_modules',
        'cli/node_modules',
      ])
      if (recordless)
        rmSync(path.join(root, `.savant/worktrees/.records/${REAL_FID}.json`))
      expect(
        disposeFidWorktree({ repoRoot: root, fidId: REAL_FID }).removed,
      ).toBe(true)
      expect(existsSync(created.record.path)).toBe(false)
      for (const { file, bytes } of sentinels) {
        expect(existsSync(file)).toBe(true)
        expect(readFileSync(file, 'utf8')).toBe(bytes)
      }
    },
    REAL_GIT_TIMEOUT_MS,
  )
}

test(
  'initialization rollback preserves linked targets before the record exists',
  () => {
    const { root, sentinels } = fixture()
    const outcome = provisionFidWorktree({
      repoRoot: root,
      fidId: REAL_FID,
      fs: {
        ...defaultWorktreeFs,
        write: () => {
          throw new Error('record persistence failed')
        },
      },
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'git-failed' })
    expect(existsSync(path.join(root, `.savant/worktrees/${REAL_FID}`))).toBe(
      false,
    )
    for (const { file, bytes } of sentinels) {
      expect(existsSync(file)).toBe(true)
      expect(readFileSync(file, 'utf8')).toBe(bytes)
    }
  },
  REAL_GIT_TIMEOUT_MS,
)

test('link detachment failure refuses git and fallback removal', () => {
  const fs = memoryFs()
  const lane = `${REPO}/.savant/worktrees/${FID}`
  fs.dirs.add(lane)
  const record = `${REPO}/.savant/worktrees/.records/${FID}.json`
  fs.write(record, 'retained record')
  fs.detachLinks = () => false
  const git = memoryGit({ fs })
  const outcome = disposeFidWorktree({
    repoRoot: REPO,
    fidId: FID,
    fs,
    run: git.runner,
  })
  expect(outcome.removed).toBe(false)
  expect(outcome.warnings.join(' ')).toContain('detach')
  expect(fs.exists(lane)).toBe(true)
  expect(fs.read(record)).toBe('retained record')
  expect(git.calls).toEqual([])
})
