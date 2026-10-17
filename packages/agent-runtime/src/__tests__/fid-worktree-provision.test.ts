/**
 * FID-2026-1017-007 — provisioning a FID-bound worktree.
 *
 * The lane path is derived from the FID id (never caller-supplied), the branch
 * is `savant/<fid>`, debris from a crashed run is cleared before `worktree add`,
 * dependencies are linked rather than installed, and the cap refuses instead of
 * piling checkouts on disk.
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
  DEFAULT_MAX_FID_WORKTREES,
  provisionFidWorktree,
} from '../echo/parallel/fid-worktree'

const LANE = `${REPO}/.savant/worktrees/${FID}`

function baseOptions() {
  const fs = memoryFs(['C:/repo/node_modules', 'C:/repo/cli/node_modules'])
  const git = memoryGit({ fs })
  return {
    fs,
    git,
    options: { repoRoot: REPO, fidId: FID, fs, run: git.runner },
  }
}

describe('provisionFidWorktree', () => {
  test('creates the lane branch, links dependencies and records it', () => {
    const { fs, git, options } = baseOptions()
    const outcome = provisionFidWorktree(options)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.record).toMatchObject({
      fidId: FID,
      path: LANE,
      relativePath: `.savant/worktrees/${FID}`,
      branch: `savant/${FID}`,
      baseSha: BASE_SHA,
    })
    expect(outcome.record.dependencyLinks).toEqual([
      'node_modules',
      'cli/node_modules',
    ])
    expect(outcome.warnings).toEqual([])
    expect(git.calls.map((args) => args.join(' '))).toContain(
      `worktree add -b savant/${FID} ${LANE} ${BASE_SHA}`,
    )
    const record = fs.read(`${REPO}/.savant/worktrees/.records/${FID}.json`)
    expect(record).toContain(`"branch": "savant/${FID}"`)
    expect(fs.links.get(`${LANE}/node_modules`)).toBe('C:/repo/node_modules')
  })

  test('refuses an id that is not a FID id, so the path cannot traverse', () => {
    const { fs, git } = baseOptions()
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: '../../etc',
      fs,
      run: git.runner,
    })
    expect(outcome).toEqual({
      ok: false,
      reason: 'invalid-fid',
      detail: expect.stringContaining('not a FID id'),
    })
    expect(git.calls).toEqual([])
  })

  test('refuses a second lane for the same FID', () => {
    const { fs, git } = baseOptions()
    provisionFidWorktree({ repoRoot: REPO, fidId: FID, fs, run: git.runner })
    const second = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(second).toMatchObject({ ok: false, reason: 'fid-in-use' })
  })

  test('refuses at the active cap', () => {
    const { fs, git } = baseOptions()
    const other = 'FID-2026-1017-008'
    fs.write(
      `${REPO}/.savant/worktrees/.records/${other}.json`,
      JSON.stringify({
        fidId: other,
        path: `${REPO}/.savant/worktrees/${other}`,
        relativePath: `.savant/worktrees/${other}`,
        branch: `savant/${other}`,
        baseSha: BASE_SHA,
        createdAt: '2026-10-17T00:00:00.000Z',
        dependencyLinks: [],
      }),
    )
    fs.dirs.add(`${REPO}/.savant/worktrees/${other}`)
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
      maxActive: 1,
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'cap-exceeded' })
    expect(DEFAULT_MAX_FID_WORKTREES).toBe(4)
  })

  test('refuses a lane branch that sits at a different base', () => {
    const fs = memoryFs()
    const git = memoryGit({
      fs,
      branchExists: true,
      branchSha: 'b'.repeat(40),
    })
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'branch-exists' })
    expect(git.calls.map((args) => args.join(' '))).not.toContain(
      `worktree add -b savant/${FID} ${LANE} ${BASE_SHA}`,
    )
  })

  test('reuses the lane branch when it already points at the base', () => {
    const fs = memoryFs()
    const git = memoryGit({ fs, branchExists: true })
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome.ok).toBe(true)
    const commands = git.calls.map((args) => args.join(' '))
    expect(commands).toContain(`worktree add ${LANE} savant/${FID}`)
    expect(commands).not.toContain(
      `worktree add -b savant/${FID} ${LANE} ${BASE_SHA}`,
    )
  })

  test('reports a git failure without writing a record', () => {
    const fs = memoryFs()
    const git = memoryGit({ fs, failPrefixes: ['worktree add'] })
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome).toMatchObject({ ok: false, reason: 'git-failed' })
    expect(fs.read(`${REPO}/.savant/worktrees/.records/${FID}.json`)).toBeNull()
  })

  test('record-write failure rolls back the already-created checkout', () => {
    const fs = memoryFs()
    const git = memoryGit({
      fs,
      onCreateLane: (lane) => {
        fs.dirs.add(lane)
      },
      onRemoveLane: (lane) => {
        fs.removeDir(lane)
      },
    })
    fs.write = () => {
      throw new Error('disk full')
    }
    expect(
      provisionFidWorktree({ repoRoot: REPO, fidId: FID, fs, run: git.runner }),
    ).toMatchObject({
      ok: false,
      reason: 'git-failed',
      detail: 'Lane initialization failed; checkout rolled back',
    })
    expect(fs.exists(LANE)).toBe(false)
    expect(
      git.calls.some(
        (args) => args.join(' ') === `worktree remove --force ${LANE}`,
      ),
    ).toBe(true)
  })

  test('a failed dependency link is a visible warning on an otherwise usable lane', () => {
    const { fs, options } = baseOptions()
    fs.linkDir = () => false
    const outcome = provisionFidWorktree(options)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.record.dependencyLinks).toEqual([])
    expect(outcome.warnings).toHaveLength(2)
  })

  test('clears debris from a crashed run before adding the lane', () => {
    const fs = memoryFs()
    fs.dirs.add(LANE)
    const git = memoryGit({
      fs,
      onRemoveLane: (lane) => {
        fs.removeDir(lane)
      },
      onCreateLane: (lane) => {
        fs.dirs.add(lane.replace(/\\/g, '/'))
      },
    })
    const outcome = provisionFidWorktree({
      repoRoot: REPO,
      fidId: FID,
      fs,
      run: git.runner,
    })
    expect(outcome.ok).toBe(true)
    const commands = git.calls.map((args) => args.join(' '))
    expect(commands).toContain(`worktree remove --force ${LANE}`)
    expect(commands).toContain(
      `worktree add -b savant/${FID} ${LANE} ${BASE_SHA}`,
    )
    expect(commands.indexOf(`worktree remove --force ${LANE}`)).toBeLessThan(
      commands.indexOf(`worktree add -b savant/${FID} ${LANE} ${BASE_SHA}`),
    )
  })
})
