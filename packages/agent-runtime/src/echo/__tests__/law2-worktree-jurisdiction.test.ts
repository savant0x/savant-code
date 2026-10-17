import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import {
  realRepo,
  REAL_FID,
  REAL_GIT_TIMEOUT_MS,
} from '../../__tests__/fid-worktree-real'
import { provisionFidWorktree } from '../parallel/fid-worktree'
import { writeFidWorktreeRecord } from '../parallel/fid-worktree-record'
import { runLaw2Gate } from '../pre-write-gates-law2'

const originalCwd = process.cwd()
const roots: string[] = []
afterEach(() => {
  process.chdir(originalCwd)
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
})

function fixture() {
  const root = realRepo()
  roots.push(root)
  const provided = provisionFidWorktree({ repoRoot: root, fidId: REAL_FID })
  if (!provided.ok) throw new Error(provided.detail)
  process.chdir(root)
  return { root, record: provided.record, lane: provided.record.path }
}

test(
  'covered lane paths pass and uncovered paths block from main or lane cwd',
  () => {
    const { lane } = fixture()
    const attempt = (name: string) =>
      runLaw2Gate({ targets: [path.join(lane, name)] })
    expect(attempt('src.ts').blocked).toBe(false)
    expect(attempt('uncovered.ts').blocked).toBe(true)
    process.chdir(lane)
    expect(runLaw2Gate({ targets: ['src.ts'] }).blocked).toBe(false)
    expect(runLaw2Gate({ targets: ['uncovered.ts'] }).blocked).toBe(true)
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'lane scope wins over main scope and an explicit parent scope override',
  () => {
    const { root, lane } = fixture()
    writeFileSync(path.join(root, 'SCOPE.md'), '- WIDE: `**`\n')
    expect(
      runLaw2Gate({
        targets: [path.join(lane, 'other.ts')],
        scopePath: path.join(root, 'SCOPE.md'),
      }).blocked,
    ).toBe(true)
    rmSync(path.join(lane, 'SCOPE.md'))
    expect(runLaw2Gate({ targets: [path.join(lane, 'src.ts')] }).blocked).toBe(
      true,
    )
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'hand-made and unlisted directories gain no jurisdiction even with broad main scope',
  () => {
    const { root, record, lane } = fixture()
    writeFileSync(path.join(root, 'SCOPE.md'), '- WIDE: `**`\n')
    const fake = path.join(root, '.savant/worktrees/fake')
    mkdirSync(fake, { recursive: true })
    expect(runLaw2Gate({ targets: [path.join(fake, 'src.ts')] }).blocked).toBe(
      true,
    )
    rmSync(
      path.join(root, '.savant/worktrees/.records', `${record.fidId}.json`),
    )
    expect(runLaw2Gate({ targets: [path.join(lane, 'src.ts')] }).blocked).toBe(
      true,
    )
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'a record without git registration and a forged record path fail closed',
  () => {
    const { root, record, lane } = fixture()
    rmSync(path.join(lane, '.git'))
    expect(runLaw2Gate({ targets: [path.join(lane, 'src.ts')] }).blocked).toBe(
      true,
    )
    writeFidWorktreeRecord(root, { ...record, path: root })
    expect(runLaw2Gate({ targets: [path.join(lane, 'src.ts')] }).blocked).toBe(
      true,
    )
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'dependency junction escapes fail closed, and writeScope still narrows lane authority',
  () => {
    const { root, lane } = fixture()
    mkdirSync(path.join(root, 'shared'), { recursive: true })
    symlinkSync(
      path.join(root, 'shared'),
      path.join(lane, 'linked'),
      'junction',
    )
    writeFileSync(path.join(lane, 'SCOPE.md'), '- WIDE: `**`\n')
    expect(
      runLaw2Gate({ targets: [path.join(lane, 'linked/new.ts')] }).blocked,
    ).toBe(true)
    expect(
      runLaw2Gate({
        targets: [path.join(lane, 'src.ts')],
        allowedWriteGlobs: [['other.ts']],
      }).blocked,
    ).toBe(true)
    expect(
      runLaw2Gate({
        targets: [path.join(lane, 'src.ts')],
        allowedWriteGlobs: [['src.ts']],
      }).blocked,
    ).toBe(false)
  },
  REAL_GIT_TIMEOUT_MS,
)
