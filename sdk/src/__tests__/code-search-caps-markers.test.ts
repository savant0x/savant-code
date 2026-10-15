import { codeSearchParams } from '@savant-code/common/tools/params/tool/code-search'
import { describe, expect, it } from 'bun:test'

import {
  buildCloseOutput,
  buildLimitedOutput,
} from '../tools/code-search/format'

// FID-2026-0908-003 — code_search cap parameters in the tool schema +
// self-remedying truncation markers. The schema pins guard the silent-strip
// defect (zod v4 object default is strip: a model passing globalMaxResults
// today is silently ignored); the marker pins guard the dead-end defect
// (truncation markers named the cap that fired but never the remedy).

describe('code_search cap schema (FID-2026-0908-003)', () => {
  const schema = codeSearchParams.inputSchema

  it('applies executor-matching defaults', () => {
    const parsed = schema.parse({ pattern: 'x' })
    expect(parsed.maxResults).toBe(15)
    expect(parsed.globalMaxResults).toBe(250)
    expect(parsed.maxOutputStringLength).toBe(20000)
  })

  it('echoes explicit cap values instead of stripping them', () => {
    const parsed = schema.parse({
      pattern: 'x',
      globalMaxResults: 1000,
      maxOutputStringLength: 50000,
    })
    expect(parsed.globalMaxResults).toBe(1000)
    expect(parsed.maxOutputStringLength).toBe(50000)
  })

  it('rejects zero, negative, non-integer, and over-ceiling caps', () => {
    expect(() => schema.parse({ pattern: 'x', globalMaxResults: 0 })).toThrow()
    expect(() => schema.parse({ pattern: 'x', globalMaxResults: -5 })).toThrow()
    expect(() =>
      schema.parse({ pattern: 'x', maxOutputStringLength: 1.5 }),
    ).toThrow()
    expect(() =>
      schema.parse({ pattern: 'x', globalMaxResults: 5001 }),
    ).toThrow()
    expect(() =>
      schema.parse({ pattern: 'x', maxOutputStringLength: 200001 }),
    ).toThrow()
  })
})

describe('code_search self-remedying truncation markers (FID-2026-0908-003)', () => {
  it('size-cap marker names the cap and both remedies', () => {
    const fileGroups = new Map([['a.ts', ['a.ts:1:foo']]])
    const { stdout } = buildLimitedOutput(fileGroups, 5, 250, 20000)
    expect(stdout).toContain('cap 20000 chars')
    expect(stdout).toContain('narrower')
    expect(stdout).toContain('maxOutputStringLength')
  })

  it('global-cap marker names the cap and both remedies', () => {
    const fileGroups = new Map([['a.ts', ['a.ts:1:foo']]])
    const { stdout } = buildLimitedOutput(fileGroups, 250, 250, 20000)
    expect(stdout).toContain('Global limit of 250 results reached')
    expect(stdout).toContain('narrower')
    expect(stdout).toContain('globalMaxResults')
  })

  it('close per-file and global messages carry their remedies', () => {
    const { stdout } = buildCloseOutput({
      fileGroups: new Map([['a.ts', ['a.ts:1:foo']]]),
      filesLimitedByMaxResults: new Set(['a.ts']),
      matchesGlobal: 250,
      killedForLimit: true,
      maxResults: 15,
      globalMaxResults: 250,
      maxOutputStringLength: 20000,
      stderrBuf: '',
    })
    expect(stdout).toContain('maxResults')
    expect(stdout).toContain('globalMaxResults')
    expect(stdout).toContain('maxOutputStringLength')
  })
})
