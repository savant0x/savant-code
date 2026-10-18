import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { fidWorktreeParams } from '@savant-code/common/tools/params/tool/fid-worktree'
import { afterEach, expect, test } from 'bun:test'

import {
  commitFile,
  realGit,
  realRepo,
  REAL_FID,
  REAL_GIT_TIMEOUT_MS,
} from './fid-worktree-real'
import adversary from '../../../../agents/adversary/adversary'
import { createCodeEditor } from '../../../../agents/forge/forge'
import { createSavant } from '../../../../agents/savant/savant'
import scout from '../../../../agents/scout/scout'
import verifier from '../../../../agents/verifier/verifier'
import { classifyMutation } from '../echo/enforcement/helpers'
import {
  safeHostRoot,
  runFidWorktreeAction,
} from '../echo/parallel/fid-worktree-service'
import { savantCodeToolHandlers } from '../tools/handlers/list'
import { handleFidWorktree } from '../tools/handlers/tool/fid-worktree'

const roots: string[] = []
// Multiple real git processes take longer than Bun's 5s default under full-suite load.
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true, maxRetries: 3 })
})

function fixture() {
  const root = realRepo()
  roots.push(root)
  return root
}

test('root guard retries only a git process that could not run', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'fid-root-guard-'))
  roots.push(root)
  mkdirSync(path.join(root, '.git'))

  expect(
    safeHostRoot(root, () => ({ status: 0, stdout: root, stderr: '' })),
  ).toBe(true)

  // A spawn that never ran is retried once; the matching second answer wins.
  let calls = 0
  expect(
    safeHostRoot(root, () => {
      calls += 1
      return calls === 1
        ? { status: null, stdout: '', stderr: 'spawn failed' }
        : { status: 0, stdout: root, stderr: '' }
    }),
  ).toBe(true)
  expect(calls).toBe(2)

  // Two spawn failures stay refused, and the retry is bounded.
  let deadCalls = 0
  expect(
    safeHostRoot(root, () => {
      deadCalls += 1
      return { status: null, stdout: '', stderr: '' }
    }),
  ).toBe(false)
  expect(deadCalls).toBe(2)

  // A real answer is never retried: different root or non-zero status refuses.
  expect(
    safeHostRoot(root, () => ({ status: 0, stdout: `${root}x`, stderr: '' })),
  ).toBe(false)
  expect(
    safeHostRoot(root, () => ({
      status: 1,
      stdout: '',
      stderr: 'not a repository',
    })),
  ).toBe(false)
})

test('tool is registered and exposed only on effectful Orchestrator variants', () => {
  expect(savantCodeToolHandlers.fid_worktree).toBe(handleFidWorktree)
  expect(createSavant('default').toolNames).toContain('fid_worktree')
  expect(
    createSavant('default', { analyzeOnly: true }).toolNames,
  ).not.toContain('fid_worktree')
  expect(createSavant('default', { planOnly: true }).toolNames).not.toContain(
    'fid_worktree',
  )
  for (const agent of [
    createCodeEditor({ model: 'opus' }),
    scout,
    verifier,
    adversary,
  ]) {
    expect(agent.toolNames).not.toContain('fid_worktree')
  }
})

test('host merge enters Law 15 mutation reconciliation; lifecycle metadata does not', () => {
  expect(
    classifyMutation({
      toolName: 'fid_worktree',
      params: { action: 'merge', fid_id: REAL_FID },
    }),
  ).toEqual({ mutates: true, targets: [], scope: 'tree' })
  for (const action of ['create', 'list', 'dispose']) {
    expect(
      classifyMutation({
        toolName: 'fid_worktree',
        params: { action, fid_id: REAL_FID },
      }).mutates,
    ).toBe(false)
  }
})

test('handler independently refuses forbidden roles without touching git', async () => {
  for (const id of [
    'forge',
    'scout',
    'verifier',
    'adversary',
    'attacker-savant',
  ]) {
    const result = await handleFidWorktree({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolName: 'fid_worktree',
        toolCallId: 'test',
        input: { action: 'list' },
      },
      fileContext: { projectRoot: 'does-not-exist' },
      agentTemplate: { id },
    })
    expect(result.output[0].value).toMatchObject({
      ok: false,
      reason: 'forbidden-role',
    })
    expect(
      fidWorktreeParams.outputSchema.safeParse(result.output).success,
    ).toBe(true)
  }
})

test(
  'shared host service completes create/list/merge/dispose with typed outputs',
  async () => {
    const root = fixture()
    const created = await runFidWorktreeAction(root, {
      action: 'create',
      fid_id: REAL_FID,
    })
    expect(created.ok).toBe(true)
    if (!created.record) throw new Error(JSON.stringify(created))
    const listed = await runFidWorktreeAction(root, { action: 'list' })
    expect(listed.lanes?.[0]).toMatchObject({ registered: true, dirty: false })
    expect(
      await runFidWorktreeAction(created.record.path, {
        action: 'create',
        fid_id: REAL_FID,
      }),
    ).toMatchObject({ ok: false, reason: 'unsafe-root' })
    const head = commitFile(
      created.record.path,
      'src.ts',
      'export const value = 3\n',
    )
    const merged = await runFidWorktreeAction(root, {
      action: 'merge',
      fid_id: REAL_FID,
    })
    expect(merged).toMatchObject({ ok: true, head })
    expect(realGit(root, ['rev-parse', 'HEAD'])).toBe(head)
    const disposed = await runFidWorktreeAction(root, {
      action: 'dispose',
      fid_id: REAL_FID,
    })
    expect(disposed).toMatchObject({ ok: true, removed: true })
    for (const result of [created, listed, merged, disposed]) {
      expect(
        fidWorktreeParams.outputSchema.safeParse([
          { type: 'json', value: result },
        ]).success,
      ).toBe(true)
    }
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'nonconverged FID, occupied lifecycle lock and dirty disposal all refuse',
  async () => {
    const root = fixture()
    const fidPath = path.join(root, `dev/fids/${REAL_FID}-fixture.md`)
    writeFileSync(fidPath, '**Status:** analyzed\n')
    expect(
      await runFidWorktreeAction(root, { action: 'create', fid_id: REAL_FID }),
    ).toMatchObject({ ok: false, reason: 'not-converged' })
    writeFileSync(fidPath, '**Status:** converged\n')
    const lock = path.join(root, '.savant/fid-worktree.lock')
    mkdirSync(lock)
    const busy = await runFidWorktreeAction(root, {
      action: 'create',
      fid_id: REAL_FID,
    })
    expect(busy).toMatchObject({ ok: false, reason: 'busy' })
    expect(busy.detail).toContain('confirm no lifecycle writer remains')
    expect(busy.detail).toContain('confirmed abandoned, empty directory')
    expect(existsSync(lock)).toBe(true)
    const occupant = path.join(lock, 'occupant')
    writeFileSync(occupant, 'preserve\n')
    expect(
      await runFidWorktreeAction(root, { action: 'create', fid_id: REAL_FID }),
    ).toMatchObject({ ok: false, reason: 'busy' })
    expect(readFileSync(occupant, 'utf8')).toBe('preserve\n')
    rmSync(lock, { recursive: true })
    const created = await runFidWorktreeAction(root, {
      action: 'create',
      fid_id: REAL_FID,
    })
    if (!created.record) throw new Error(JSON.stringify(created))
    writeFileSync(path.join(created.record.path, 'src.ts'), 'uncommitted\n')
    expect(
      await runFidWorktreeAction(root, { action: 'dispose', fid_id: REAL_FID }),
    ).toMatchObject({ ok: false, reason: 'dirty' })
    expect(
      await runFidWorktreeAction(root, {
        action: 'dispose',
        fid_id: REAL_FID,
        discard_changes: true,
      }),
    ).toMatchObject({ ok: true, removed: true })
  },
  REAL_GIT_TIMEOUT_MS,
)

test(
  'list exposes orphan lanes and hand-made debris rather than silently hiding them',
  async () => {
    const root = fixture()
    const created = await runFidWorktreeAction(root, {
      action: 'create',
      fid_id: REAL_FID,
    })
    if (!created.record) throw new Error(JSON.stringify(created))
    rmSync(path.join(root, '.savant/worktrees/.records', `${REAL_FID}.json`))
    mkdirSync(path.join(root, '.savant/worktrees/fake'))
    const listed = await runFidWorktreeAction(root, { action: 'list' })
    expect(listed.lanes).toEqual([])
    expect(listed.warnings).toHaveLength(2)
    expect(
      listed.warnings?.some(
        (warning) =>
          warning.includes(REAL_FID.toLowerCase()) ||
          warning.includes(REAL_FID),
      ),
    ).toBe(true)
    expect(listed.warnings?.some((warning) => warning.includes('/fake'))).toBe(
      true,
    )
  },
  REAL_GIT_TIMEOUT_MS,
)
