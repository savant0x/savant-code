/**
 * FID-2026-1017-007 — disposing and listing FID worktrees.
 *
 * Teardown follows the recorded release-checkout contract: ask git to remove,
 * verify absence, fall back to a bounded filesystem removal only for survivors,
 * then prune. A surviving directory is a warning, never a silent success and
 * never a throw. Listing joins records against `git worktree list`.
 */
import { describe, expect, test } from 'bun:test'

import {
  BASE_SHA,
  FID,
  REPO,
  memoryFs,
  memoryGit,
} from './fid-worktree-fixtures'
import {
  disposeFidWorktree,
  listFidWorktrees,
} from '../echo/parallel/fid-worktree'

const LANE = `${REPO}/.savant/worktrees/${FID}`
const RECORD = `${REPO}/.savant/worktrees/.records/${FID}.json`

function seed() {
  const fs = memoryFs()
  fs.dirs.add(LANE)
  fs.write(
    RECORD,
    JSON.stringify({
      fidId: FID,
      path: LANE,
      relativePath: `.savant/worktrees/${FID}`,
      branch: `savant/${FID}`,
      baseSha: BASE_SHA,
      createdAt: '2026-10-17T00:00:00.000Z',
      dependencyLinks: ['node_modules'],
    }),
  )
  return fs
}

describe('disposeFidWorktree', () => {
  test('removes the registered lane, prunes and deletes the record', () => {
    const fs = seed()
    const git = memoryGit({
      fs,
      onRemoveLane: (lane) => {
        fs.removeDir(lane)
      },
    })
    const outcome = disposeFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome).toEqual({ removed: true, warnings: [] })
    expect(fs.exists(LANE)).toBe(false)
    expect(fs.read(RECORD)).toBeNull()
    const commands = git.calls.map((args) => args.join(' '))
    expect(commands).toContain(`worktree remove --force ${LANE}`)
    expect(commands).toContain('worktree prune')
  })

  test('falls back to the filesystem when git reports success but files survive', () => {
    const fs = seed()
    let fallbacks = 0
    const original = fs.removeDir
    fs.removeDir = (target) => {
      fallbacks += 1
      return original(target)
    }
    // git "succeeds" and leaves the directory: the incident class.
    const git = memoryGit({ fs })
    const outcome = disposeFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(fallbacks).toBe(1)
    expect(outcome.removed).toBe(true)
    expect(outcome.warnings).toEqual([])
    expect(fs.exists(LANE)).toBe(false)
  })

  test('warns and keeps the record when the directory cannot be removed', () => {
    const fs = seed()
    fs.removeDir = () => false
    const git = memoryGit({ fs })
    const outcome = disposeFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome.removed).toBe(false)
    expect(outcome.warnings).toHaveLength(1)
    expect(outcome.warnings[0]).toContain('survived cleanup')
    expect(fs.read(RECORD)).not.toBeNull()
  })

  test('refuses an invalid id without touching git', () => {
    const fs = memoryFs()
    const git = memoryGit({ fs })
    const outcome = disposeFidWorktree({
      repoRoot: REPO,
      fidId: 'not-a-fid',
      fs,
      run: git.runner,
    })
    expect(outcome.removed).toBe(false)
    expect(outcome.warnings[0]).toContain('invalid FID id')
    expect(git.calls).toEqual([])
  })
})

describe('listFidWorktrees', () => {
  test('joins records with registration and dirty state', () => {
    const fs = seed()
    const git = memoryGit({ fs })
    const listed = listFidWorktrees({ repoRoot: REPO, fs, run: git.runner })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.record.fidId).toBe(FID)
    // The fixture reports the main checkout, not the lane: unregistered.
    expect(listed[0]?.registered).toBe(false)
    expect(listed[0]?.dirty).toBe(false)
  })
})
