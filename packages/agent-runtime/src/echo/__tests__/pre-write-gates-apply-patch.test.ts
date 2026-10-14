/**
 * EHEL pre-write gates — apply_patch input shape (FID-2026-0820-014 EC-2).
 *
 * apply_patch nests its target under `operation.path` and its payload under
 * `operation.diff`. Before EC-2, getTargetPath read only `input.path`, so
 * every apply_patch call resolved an undefined target and silently bypassed
 * the Law 1 / Law 7 gates and the FID Recorder / anti-deferral checks —
 * while enforcement.ts's own getTargetPath tracked the write as dirty.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'
import { runLaw1Gate } from '../pre-write-gates-law1'

describe('runPreWriteGates — apply_patch input shape (FID-2026-0820-014 EC-2)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function existingFilePath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'apply-patch-gates-'))
    tempDirs.push(dir)
    const file = join(dir, 'existing.ts')
    writeFileSync(file, '// pre-existing content\n')
    return file
  }

  function runPatchGate(params: {
    targetPath: string
    tier: 'core_4' | 'all_15'
    readPaths?: string[]
    diff?: string
    agentId?: string
  }) {
    const state = createEnforcementState()
    for (const p of params.readPaths ?? []) state.filesRead.add(p)
    // Satisfy the strict-mode Law 7/8 preconditions so Law 1 is isolated.
    state.hasSearchedSinceGreen = true
    state.intentLogged = true
    return runPreWriteGates({
      toolName: 'apply_patch',
      input: {
        operation: {
          type: 'update_file',
          path: params.targetPath,
          diff: params.diff ?? '@@\n+const x = 1\n',
        },
      },
      agentId: params.agentId ?? 'savant',
      state,
      mode: params.tier === 'all_15' ? 'strict' : 'hybrid',
      tier: params.tier,
    })
  }

  it('BLOCKS an unread existing file targeted via operation.path in strict mode (Law 1)', () => {
    const target = existingFilePath()
    const result = runPatchGate({ targetPath: target, tier: 'all_15' })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 1')
    expect(result.reason).toContain('has not been read')
  })

  it('does NOT block an existing file that was read first (Law 1 via operation.path)', () => {
    const target = existingFilePath()
    const result = runPatchGate({
      targetPath: target,
      tier: 'all_15',
      readPaths: [target],
    })
    expect(result.blocked).toBe(false)
  })

  it('still BLOCKS re-editing a dirty-unverified target (Law 3 via resolved target, FID-2026-0918-005)', () => {
    const target = existingFilePath()
    const state = createEnforcementState()
    state.filesRead.add(target)
    state.dirtyFiles.add(target)
    const result = runPreWriteGates({
      toolName: 'apply_patch',
      input: {
        operation: { type: 'update_file', path: target, diff: '@@\n+x\n' },
      },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('Law 3')
  })

  it('routes apply_patch FID content through the anti-deferral gate via operation.diff', () => {
    const fidPath = '/proj/dev/fids/FID-2026-0820-014-x.md'
    const result = runPatchGate({
      targetPath: fidPath,
      tier: 'core_4',
      diff:
        '# FID: test\n\n**Status:** closed\n\n## Step Status\n' +
        '- [ ] 1. not done\n',
    })
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('FID gate')
    expect(result.reason).toContain('not done')
  })

  it('resolves relative targetPath against projectRoot in runLaw1Gate (FID-2026-1013-010 W1-2)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'law1-root-'))
    tempDirs.push(dir)
    const existingRel = 'sub/existing-in-root.ts'
    const existingAbs = join(dir, existingRel)
    rmSync(existingAbs, { force: true })
    writeFileSync(join(dir, 'root-existing.ts'), '// exists in projectRoot\n')

    // Unread existing relative file inside projectRoot must be blocked even though
    // `root-existing.ts` does not exist in process.cwd().
    const blocked = runLaw1Gate({
      targetPath: 'root-existing.ts',
      mutationTargets: [],
      filesRead: new Set(),
      projectRoot: dir,
    })
    expect(blocked.blocked).toBe(true)

    // When read under its absolute path, the relative targetPath is recognized as read.
    const allowedAfterAbsRead = runLaw1Gate({
      targetPath: 'root-existing.ts',
      mutationTargets: [],
      filesRead: new Set([join(dir, 'root-existing.ts')]),
      projectRoot: dir,
    })
    expect(allowedAfterAbsRead.blocked).toBe(false)

    // Brand-new relative file inside projectRoot is exempt.
    const allowedNew = runLaw1Gate({
      targetPath: 'brand-new-in-root.ts',
      mutationTargets: [],
      filesRead: new Set(),
      projectRoot: dir,
    })
    expect(allowedNew.blocked).toBe(false)
  })
})
