/** Allowlisted gate execution, workspace isolation, and receipt stamping. */
import { describe, expect, it } from 'bun:test'

import {
  buildReceipt,
  checkAll,
  resolveGate,
  runGates,
  safeRepoPath,
  stampReceipt,
} from '../fid-verify'

const BT = String.fromCharCode(96)

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

  it.each(['cli', 'packages/agent-runtime'])(
    'runs %s tests from their workspace',
    (workspace) => {
      const file =
        workspace === 'cli'
          ? 'src/utils/__tests__/fid-loader.test.ts'
          : 'src/echo/__tests__/worktree-reconcile.test.ts'
      const resolved = resolveGate('test', `${workspace}/${file}`)
      if ('error' in resolved) throw new Error(resolved.error)
      expect(resolved.argv).toEqual(['bun', 'test', file])
      expect(resolved.cwd.replaceAll('\\', '/')).toEndWith(`/${workspace}`)
      expect(resolved.label).toBe(`test ${workspace}/${file}`)
    },
  )

  it('maps the no-arg quality gate to the quality:report script (Task 58)', () => {
    const resolved = resolveGate('quality', '')
    expect('error' in resolved ? resolved.error : resolved.argv).toEqual([
      'bun',
      'run',
      'quality:report',
    ])
  })

  it('rejects an argument on the quality gate (repo-wide, singular)', () => {
    const resolved = resolveGate('quality', 'cli')
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

  it('runs the quality gate and reports exit 0 (Task 58)', () => {
    const { results, errors } = runGates([{ kind: 'quality', arg: '' }])
    expect(errors).toEqual([])
    expect(results[0]?.exit).toBe(0)
  })
})

describe('buildReceipt + stampReceipt', () => {
  const FID = [
    '# FID: x',
    '',
    '**Status:** fixed',
    '',
    '## Verification Gates',
    '',
    '- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts',
    '',
  ].join('\n')

  const probeResult = [
    {
      label: 'probe scripts/__tests__/fixtures/fid-verify-echo.ts',
      exit: 0,
      signal: null,
    },
    { label: 'quality', exit: 0, signal: null },
  ]

  const VERIFIED_AT = '2026-09-28T00:00:00.000Z'

  it('builds a receipt with fingerprint + exit lines', () => {
    const receipt = buildReceipt(FID, probeResult, VERIFIED_AT)
    expect(receipt).toContain('### Verification Receipt')
    expect(receipt).toContain('- fingerprint: sha256:')
    expect(receipt).toContain('- verified: ')
    expect(receipt).toContain('exit 0')
  })

  it('stamps the receipt inside the gates section', () => {
    const receipt = buildReceipt(FID, probeResult, VERIFIED_AT)
    const stamped = stampReceipt(FID, receipt)
    expect(stamped).toContain('## Verification Gates')
    expect(stamped.indexOf('### Verification Receipt')).toBeGreaterThan(
      stamped.indexOf('## Verification Gates'),
    )
    const section = stamped.slice(stamped.indexOf('## Verification Gates'))
    expect(section).toContain('### Verification Receipt')
  })

  it('replaces an existing receipt on re-stamp', () => {
    const receipt = buildReceipt(FID, probeResult, VERIFIED_AT)
    const once = stampReceipt(FID, receipt)
    const twice = stampReceipt(once, receipt)
    expect(twice.match(/### Verification Receipt/g)?.length).toBe(1)
  })

  const PROSE_LINE = `The receipt heading ${BT}### Verification Receipt${BT} appears in prose here, and the gates heading too: ${BT}## Verification Gates${BT}.`

  const FID_WITH_PROSE_MENTION = [
    '# FID: x',
    '',
    '**Status:** fixed',
    '',
    '## Summary',
    '',
    PROSE_LINE,
    '',
    '## Verification Gates',
    '',
    '- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts',
    '- gate: quality',
    '',
    '## Perfection Loop',
    '',
    'loop text',
    '',
  ].join('\n')

  it('inserts the receipt into the gates section even when prose mentions the headings', () => {
    const receipt = buildReceipt(
      FID_WITH_PROSE_MENTION,
      probeResult,
      VERIFIED_AT,
    )
    const stamped = stampReceipt(FID_WITH_PROSE_MENTION, receipt)
    // The Summary prose survives untouched…
    expect(stamped).toContain(PROSE_LINE)
    // …and the receipt lands inside the gates section, not at the mention.
    const gatesAt = stamped.indexOf('## Verification Gates')
    const receiptAt = stamped.indexOf('### Verification Receipt\n')
    const perfectionAt = stamped.indexOf('## Perfection Loop')
    expect(receiptAt).toBeGreaterThan(gatesAt)
    expect(receiptAt).toBeLessThan(perfectionAt)
  })

  it('re-stamps at the real receipt, not at a prose mention', () => {
    const receipt = buildReceipt(
      FID_WITH_PROSE_MENTION,
      probeResult,
      VERIFIED_AT,
    )
    const once = stampReceipt(FID_WITH_PROSE_MENTION, receipt)
    const twice = stampReceipt(once, receipt)
    expect(twice.match(/^### Verification Receipt$/gm)?.length).toBe(1)
    expect(twice).toContain(PROSE_LINE)
  })

  it('ignores a fenced example of the receipt format (fence-aware anchor)', () => {
    const fence = BT.repeat(3)
    const fidFenced = [
      '# FID: x',
      '',
      '**Status:** fixed',
      '',
      '## Summary',
      '',
      `${fence}markdown`,
      '### Verification Receipt',
      '',
      `- fingerprint: sha256:${'0'.repeat(64)}`,
      fence,
      '',
      '## Verification Gates',
      '',
      '- gate: probe scripts/__tests__/fixtures/fid-verify-echo.ts',
      '',
      '## Perfection Loop',
      '',
      'loop text',
      '',
    ].join('\n')
    const receipt = buildReceipt(fidFenced, probeResult, VERIFIED_AT)
    const stamped = stampReceipt(fidFenced, receipt)

    // The fenced example survives intact, inside the Summary…
    expect(stamped).toContain(`${fence}markdown`)
    expect(stamped).toContain(`- fingerprint: sha256:${'0'.repeat(64)}`)
    // …and the REAL receipt (the one carrying a verified line) lands
    // inside the gates section, after it.
    const gatesAt = stamped.indexOf('## Verification Gates')
    const verifiedAt = stamped.indexOf('- verified: ')
    expect(verifiedAt).toBeGreaterThan(gatesAt)
    expect(
      stamped.lastIndexOf('### Verification Receipt', verifiedAt),
    ).toBeGreaterThan(gatesAt)
  })

  it('end-to-end: a stamped document validates against the agent-runtime contract', async () => {
    const receipt = buildReceipt(
      FID_WITH_PROSE_MENTION,
      probeResult,
      VERIFIED_AT,
    )
    const stamped = stampReceipt(FID_WITH_PROSE_MENTION, receipt)
    const { validateFidVerification } =
      await import('@savant-code/agent-runtime/echo/fid-verification-gates')
    expect(validateFidVerification(stamped)).toEqual([])
  })
})

describe('checkAll (structural --check)', () => {
  it('runs without throwing and returns 0 or 1 deterministically', () => {
    const exit = checkAll()
    expect([0, 1]).toContain(exit)
  })
})
