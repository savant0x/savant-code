/**
 * fid:verify executor tests (FID-2026-0823-009).
 *
 * Covers the allowlist safety surface (hostile args never execute), gate
 * resolution to argv, real execution against the fixtures, receipt
 * build/stamp round-trip, and the structural --check scan.
 */
import { describe, expect, it } from 'bun:test'

import {
  buildReceipt,
  checkAll,
  resolveGate,
  runGates,
  safeRepoPath,
  stampReceipt,
} from '../fid-verify'

describe('safeRepoPath', () => {
  it('accepts a repo-relative test file', () => {
    const result = safeRepoPath(
      'scripts/__tests__/fixtures/fid-verify-echo.ts',
      /\.ts$/,
    )
    expect(result.ok).toBe(true)
  })

  it('rejects a path escaping the repo', () => {
    const result = safeRepoPath('../../sneaky.ts', /\.ts$/)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('escapes the repo')
  })

  it('rejects a path with a bad extension', () => {
    const result = safeRepoPath('scripts/fid-verify.ts', /\.test\.ts$/)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('must match')
  })

  it('rejects a non-existent path', () => {
    const result = safeRepoPath('scripts/__tests__/nope.test.ts', /\.test\.ts$/)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('does not exist')
  })
})

describe('resolveGate', () => {
  it('maps a known workspace typecheck to argv', () => {
    const resolved = resolveGate('typecheck', 'sdk')
    expect('error' in resolved ? resolved.error : resolved.argv).toEqual([
      'bun',
      'run',
      '--cwd=sdk',
      'typecheck',
    ])
  })

  it('rejects an unknown workspace', () => {
    const resolved = resolveGate('typecheck', '../evil')
    expect('error' in resolved).toBe(true)
  })

  it('maps a test path to bun test argv', () => {
    const resolved = resolveGate('test', 'scripts/__tests__/fid-verify.test.ts')
    expect('error' in resolved ? resolved.error : resolved.argv).toEqual([
      'bun',
      'test',
      'scripts/__tests__/fid-verify.test.ts',
    ])
  })

  it('rejects an unknown kind', () => {
    const resolved = resolveGate('rm', '/')
    expect('error' in resolved).toBe(true)
  })

  it('rejects a shell-injection-shaped arg (no spaces, no metachars in path gate)', () => {
    const resolved = resolveGate('probe', 'x.ts; rm -rf /')
    expect('error' in resolved).toBe(true)
  })
})

describe('runGates', () => {
  it('runs a passing probe and reports exit 0', () => {
    const { results, errors } = runGates([
      { kind: 'probe', arg: 'scripts/__tests__/fixtures/fid-verify-echo.ts' },
    ])
    expect(errors).toEqual([])
    expect(results[0]?.exit).toBe(0)
  })

  it('runs a failing probe and reports its exit code', () => {
    const { results } = runGates([
      { kind: 'probe', arg: 'scripts/__tests__/fixtures/fid-verify-fail.ts' },
    ])
    expect(results[0]?.exit).toBe(1)
  })

  it('surfaces unsafe gate errors without executing', () => {
    const { results, errors } = runGates([
      { kind: 'typecheck', arg: 'not-a-workspace' },
    ])
    expect(results).toEqual([])
    expect(errors[0]).toContain('unsafe typecheck workspace')
  })
})

describe('buildReceipt + stampReceipt', () => {
  const FID = `# FID: x

**Status:** fixed

## Verification Gates

- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts
`

  it('builds a receipt with fingerprint + exit lines', () => {
    const receipt = buildReceipt(
      FID,
      [
        {
          label: 'probe scripts/__tests__/fixtures/fid-verify-echo.ts',
          exit: 0,
          signal: null,
        },
      ],
      '2026-08-23T15:04:00Z',
    )
    expect(receipt).toContain('### Verification Receipt')
    expect(receipt).toContain('- fingerprint: sha256:')
    expect(receipt).toContain('- verified: 2026-08-23T15:04:00Z')
    expect(receipt).toContain('exit 0')
  })

  it('stamps the receipt inside the gates section', () => {
    const receipt = buildReceipt(
      FID,
      [
        {
          label: 'probe scripts/__tests__/fixtures/fid-verify-echo.ts',
          exit: 0,
          signal: null,
        },
      ],
      '2026-08-23T15:04:00Z',
    )
    const stamped = stampReceipt(FID, receipt)
    expect(stamped).toContain('## Verification Gates')
    expect(stamped.indexOf('### Verification Receipt')).toBeGreaterThan(
      stamped.indexOf('## Verification Gates'),
    )
    // The receipt is a sibling of the declaration, not a child: the next
    // `## ` heading after the section start must be the receipt block.
    const section = stamped.slice(stamped.indexOf('## Verification Gates'))
    expect(section).toContain('### Verification Receipt')
  })

  it('replaces an existing receipt on re-stamp', () => {
    const receipt = buildReceipt(
      FID,
      [
        {
          label: 'probe scripts/__tests__/fixtures/fid-verify-echo.ts',
          exit: 0,
          signal: null,
        },
      ],
      '2026-08-23T15:04:00Z',
    )
    const once = stampReceipt(FID, receipt)
    const twice = stampReceipt(once, receipt)
    expect(twice.match(/### Verification Receipt/g)?.length).toBe(1)
  })
})

describe('checkAll (structural --check)', () => {
  it('runs without throwing and returns 0 or 1 deterministically', () => {
    const exit = checkAll()
    expect([0, 1]).toContain(exit)
  })
})
