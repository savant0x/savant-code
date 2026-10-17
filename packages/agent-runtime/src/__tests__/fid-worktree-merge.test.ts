import { rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import {
  commitFile,
  realGit,
  realRepo,
  REAL_FID,
  REAL_GIT_TIMEOUT_MS,
} from './fid-worktree-real'
import { provisionFidWorktree } from '../echo/parallel/fid-worktree'
import { mergeFidWorktree } from '../echo/parallel/fid-worktree-merge'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
})

function fixture() {
  const root = realRepo()
  roots.push(root)
  const provided = provisionFidWorktree({ repoRoot: root, fidId: REAL_FID })
  if (!provided.ok) throw new Error(provided.detail)
  return { root, lane: provided.record.path }
}

test(
  'clean ff-only merge lands exactly the lane SHA, then refreshes main graph',
  async () => {
    const { root, lane } = fixture()
    const head = commitFile(lane, 'src.ts', 'export const value = 2\n')
    let refreshes = 0
    const result = await mergeFidWorktree({
      repoRoot: root,
      fidId: REAL_FID,
      refreshGraph: async (cwd) => {
        expect(cwd).toBe(root)
        expect(realGit(root, ['rev-parse', 'HEAD'])).toBe(head)
        refreshes += 1
      },
    })
    expect(result).toEqual({ ok: true, head, warnings: [] })
    expect(refreshes).toBe(1)
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'dirty main and dirty lane both refuse without refreshing or moving HEAD',
  async () => {
    const { root, lane } = fixture()
    const base = realGit(root, ['rev-parse', 'HEAD'])
    for (const cwd of [root, lane]) {
      writeFileSync(path.join(cwd, 'src.ts'), 'dirty\n')
      const result = await mergeFidWorktree({
        repoRoot: root,
        fidId: REAL_FID,
        refreshGraph: async () => {
          throw new Error('must not refresh')
        },
      })
      expect(result).toMatchObject({ ok: false, reason: 'dirty' })
      expect(realGit(root, ['rev-parse', 'HEAD'])).toBe(base)
      realGit(cwd, ['restore', 'src.ts'])
    }
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'non-conflicting divergent main refuses and preserves lane',
  async () => {
    const { root, lane } = fixture()
    const head = commitFile(root, 'main.txt', 'main\n')
    const laneHead = commitFile(lane, 'lane.txt', 'lane\n')
    expect(
      await mergeFidWorktree({ repoRoot: root, fidId: REAL_FID }),
    ).toMatchObject({ ok: false, reason: 'diverged' })
    expect(realGit(root, ['rev-parse', 'HEAD'])).toBe(head)
    expect(realGit(lane, ['rev-parse', 'HEAD'])).toBe(laneHead)
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'conflicts name the file, preserve both checkouts and never resolve',
  async () => {
    const { root, lane } = fixture()
    const head = commitFile(root, 'src.ts', 'main\n')
    const laneHead = commitFile(lane, 'src.ts', 'lane\n')
    expect(await mergeFidWorktree({ repoRoot: root, fidId: REAL_FID })).toEqual(
      expect.objectContaining({
        ok: false,
        reason: 'conflict',
        detail: expect.stringContaining('src.ts'),
      }),
    )
    expect(realGit(root, ['rev-parse', 'HEAD'])).toBe(head)
    expect(realGit(lane, ['rev-parse', 'HEAD'])).toBe(laneHead)
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'wrong branch refuses; post-merge graph failure reports success with warning',
  async () => {
    const { root, lane } = fixture()
    realGit(root, ['switch', '-c', 'wrong'])
    expect(
      await mergeFidWorktree({ repoRoot: root, fidId: REAL_FID }),
    ).toMatchObject({ ok: false, reason: 'wrong-branch' })
    realGit(root, ['switch', 'main'])
    const head = commitFile(lane, 'src.ts', 'changed\n')
    const result = await mergeFidWorktree({
      repoRoot: root,
      fidId: REAL_FID,
      refreshGraph: async () => {
        throw new Error('locked graph')
      },
    })
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        head,
        warnings: [expect.stringContaining('Merge landed')],
      }),
    )
  },
  REAL_GIT_TIMEOUT_MS,
)
