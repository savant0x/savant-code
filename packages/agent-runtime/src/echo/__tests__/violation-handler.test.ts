/**
 * EHEL violation-handler tests — law mapping + compliance_warning chunk
 * builder (FID-2026-0805-007).
 *
 * Regression: the tool executor previously hardcoded `law: 'law1'` on every
 * enforcement advisory, mislabeling Law 7/8 warnings. The chunk builder now
 * carries each advisory's ACTUAL law (`law7` / `law8`), and the strict-mode
 * gate's advisory warnings are proven to flow through it unchanged.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'bun:test'

import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'
import {
  buildComplianceWarningChunks,
  lawNumberToComplianceLaw,
} from '../violation-handler'

describe('lawNumberToComplianceLaw', () => {
  it('maps numeric EHEL laws to wire law strings', () => {
    expect(lawNumberToComplianceLaw(7)).toBe('law7')
    expect(lawNumberToComplianceLaw(8)).toBe('law8')
  })

  it('accepts any future numeric law via the template-literal type', () => {
    expect(lawNumberToComplianceLaw(15)).toBe('law15')
  })
})

describe('buildComplianceWarningChunks', () => {
  it('emits one chunk per advisory with the ACTUAL law, severity, and message', () => {
    const chunks = buildComplianceWarningChunks([
      {
        law: 7,
        severity: 'warning',
        message: 'Law 7: Search for existing code before creating new',
        file: 'src/new.ts',
      },
      {
        law: 8,
        severity: 'info',
        message: 'Law 8: Log intent before coding',
      },
    ])
    expect(chunks).toEqual([
      {
        type: 'compliance_warning',
        law: 'law7',
        severity: 'warning',
        message: 'Law 7: Search for existing code before creating new',
        path: 'src/new.ts',
      },
      {
        type: 'compliance_warning',
        law: 'law8',
        severity: 'info',
        message: 'Law 8: Log intent before coding',
      },
    ])
  })

  it('omits path when the advisory has no file', () => {
    const [chunk] = buildComplianceWarningChunks([
      { law: 8, severity: 'info', message: 'no file' },
    ])
    expect(chunk).not.toHaveProperty('path')
  })

  it('returns an empty array for no advisories', () => {
    expect(buildComplianceWarningChunks([])).toEqual([])
  })
})

describe('strict-mode gate → advisory → wire chunk (pipeline)', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('carries a Law 7 advisory on the blocked result and maps it to law7', () => {
    const dir = mkdtempSync(join(tmpdir(), 'violation-handler-'))
    tempDirs.push(dir)

    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: join(dir, 'new-file.txt') },
      agentId: 'savant',
      state,
      mode: 'strict',
      tier: 'all_15',
    })

    // Strict Law 7 (search-before-create) blocks a never-searched write to a
    // new file AND attaches the advisory so it can surface on the wire.
    expect(result.blocked).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0].law).toBe(7)

    const chunks = buildComplianceWarningChunks(result.warnings)
    expect(chunks[0].law).toBe('law7')
    expect(chunks[0].type).toBe('compliance_warning')
  })
})
