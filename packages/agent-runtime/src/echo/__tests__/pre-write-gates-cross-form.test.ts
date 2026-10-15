import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'

/**
 * FID-2026-0823-009 — Law 1 cross-form regression net.
 *
 * Reads register under the caller's literal spelling while writes can arrive
 * absolutized by SDK-side resolution. The gate must accept either form once
 * canonicalization is wired (enforcement.ts stores canonical; the gate also
 * probes the canonical form of the target).
 */
describe('runPreWriteGates — Law 1 cross-form reads (FID-2026-0823-009)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function existingFilePath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'law1-cross-form-'))
    tempDirs.push(dir)
    const file = join(dir, 'existing.ts')
    writeFileSync(file, '// pre-existing content\n')
    return file
  }

  function runGate(targetPath: string, readPaths: string[]) {
    const state = createEnforcementState()
    for (const p of readPaths) state.filesRead.add(p)
    return runPreWriteGates({
      toolName: 'write_file',
      input: { path: targetPath },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
  }

  it('does NOT block when the read was registered RELATIVE and the write arrives ABSOLUTE', () => {
    const target = existingFilePath()
    const result = runGate(target, [relative(process.cwd(), target)])
    expect(result.blocked).toBe(false)
  })

  it('does NOT block when the read was registered ABSOLUTE and the write arrives RELATIVE', () => {
    const target = existingFilePath()
    const result = runGate(relative(process.cwd(), target), [target])
    expect(result.blocked).toBe(false)
  })

  it('still BLOCKS when the file was never read in any form', () => {
    const target = existingFilePath()
    const otherDir = mkdtempSync(join(tmpdir(), 'law1-cross-form-other-'))
    tempDirs.push(otherDir)
    const unread = join(otherDir, 'unread.ts')
    writeFileSync(unread, '// x\n')
    const result = runGate(target, [unread])
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('has not been read')
  })
})
