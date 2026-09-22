/**
 * FID-2026-0918-006 Step 3 — verification-contract sweep fixtures.
 *
 * The `### Verification` prose contract is machine-checked by
 * `collectContractViolations` (echo/fid-verification-contract-sweep):
 * a promised "new (runtime )?test" artifact must be covered by a declared
 * `- gate: test <path>`. This suite pins the four fixture shapes the FID
 * promised plus the live `fid:verify --check` negative proof:
 *
 *   1. promise-with-gate  -> valid (no errors)
 *   2. promise-without-gate -> violation naming the uncovered artifact
 *   3. no-promise         -> valid
 *   4. grandfathered (receipt-less) -> warning tier, never an error
 *   5. live `--check`: a receipt-bearing fixture FID under dev/fids/
 *      promising an uncovered test FAILS the repo-wide sweep; the same
 *      fixture at a pre-stamp status passes with an enumerated warning.
 *      Fixtures are destroyed after the run.
 */
import { spawnSync as nodeSpawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'bun:test'

import { collectContractViolations } from '@savant-code/agent-runtime/echo/fid-verification-contract-sweep'
import {
  computeFidFingerprint,
  validateFidVerification,
} from '@savant-code/agent-runtime/echo/fid-verification-gates'

const ROOT = path.resolve(import.meta.dir, '../..')
const PROMISED = 'scripts/__tests__/contract-sweep-fixture.test.ts'

/** Build a FID-shaped fixture document. */
function fidDoc(opts: {
  status: string
  gates: string[]
  verification: string
  withReceipt: boolean
}): string {
  const lines = [
    '# FID: contract sweep fixture',
    '',
    `**Status:** ${opts.status}`,
    '',
    '## Proposed Solution',
    '',
    '### Verification',
    '',
    opts.verification,
    '',
    '## Verification Gates',
    '',
    ...opts.gates.map((gate) => `- gate: ${gate}`),
  ]
  if (opts.withReceipt) {
    // Mirror the stamp layout: receipt inside the gates section. The
    // fingerprint is computed over the receipt-less document, exactly as
    // `stampReceipt` does, so the fixture validates structurally.
    const base = fidDoc({ ...opts, withReceipt: false })
    const fingerprint = computeFidFingerprint(base)
    lines.push(
      '',
      '### Verification Receipt',
      '',
      `- fingerprint: sha256:${fingerprint}`,
      '- verified: 2026-09-19T00:00:00.000Z',
      ...opts.gates.map((gate) =>
        gate === 'quality' ? '- quality: exit 0' : `- ${gate}: exit 0`,
      ),
    )
  }
  return lines.join('\n') + '\n'
}

describe('collectContractViolations (fixture shapes)', () => {
  it('1. promise-with-gate: covered promise is valid on a receipt-bearing doc', () => {
    const doc = fidDoc({
      status: 'fixed',
      gates: [`test ${PROMISED}`, 'quality'],
      verification: `- New runtime test: \`${PROMISED}\` proves the sweep.`,
      withReceipt: true,
    })
    const { gates } = { gates: [`test ${PROMISED}`, 'quality'] }
    const declared = gates
      .filter((gate) => gate.startsWith('test '))
      .map((gate) => gate.slice('test '.length))
    const result = collectContractViolations(doc, declared)
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
    expect(validateFidVerification(doc)).toEqual([])
  })

  it('2. promise-without-gate: uncovered promise is a violation naming the artifact', () => {
    const doc = fidDoc({
      status: 'fixed',
      gates: ['quality'],
      verification: `- New runtime test: \`${PROMISED}\` proves the sweep.`,
      withReceipt: true,
    })
    const errors = validateFidVerification(doc)
    expect(
      errors.some((error) =>
        error.includes(`promised test artifact "${PROMISED}"`),
      ),
    ).toBe(true)
    expect(errors.some((error) => error.includes('FID-2026-0918-006'))).toBe(
      true,
    )
    const result = collectContractViolations(doc, [])
    expect(result.errors).toHaveLength(1)
  })

  it('3. no-promise: ordinary Verification prose stays untouched', () => {
    const doc = fidDoc({
      status: 'verified',
      gates: ['quality'],
      verification: '- Existing suites re-run green; typecheck exit 0.',
      withReceipt: true,
    })
    expect(collectContractViolations(doc, [])).toEqual({
      errors: [],
      warnings: [],
    })
    expect(validateFidVerification(doc)).toEqual([])
  })

  it('4. grandfathered: receipt-less document warns instead of failing', () => {
    const unstamped = fidDoc({
      status: 'analyzed',
      gates: ['quality'],
      verification: `- New runtime test: \`${PROMISED}\` proves the sweep.`,
      withReceipt: false,
    })
    const result = collectContractViolations(unstamped, [])
    expect(result.errors).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain(PROMISED)
  })

  it('fenced promise examples are documentation, never violations', () => {
    const fence = '```markdown'
    const doc = fidDoc({
      status: 'fixed',
      gates: ['quality'],
      verification: `${fence}\n- New runtime test: \`${PROMISED}\`\n${fence}`,
      withReceipt: true,
    })
    expect(collectContractViolations(doc, [])).toEqual({
      errors: [],
      warnings: [],
    })
  })
})

describe('fid:verify --check live negative proof (FID-2026-0918-006)', () => {
  const FIXTURE_ERROR = path.join(
    ROOT,
    'dev/fids/FID-2026-9999-1231-sweep-error-fixture.md',
  )
  const FIXTURE_WARN = path.join(
    ROOT,
    'dev/fids/FID-2026-9999-1232-sweep-warning-fixture.md',
  )

  afterAll(() => {
    for (const file of [FIXTURE_ERROR, FIXTURE_WARN]) {
      fs.rmSync(file, { force: true })
    }
  })

  function runCheck(): { exit: number; stdout: string } {
    const spawned = nodeSpawnSync('bun', ['run', 'fid:verify', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return { exit: spawned.status ?? 1, stdout: spawned.stdout ?? '' }
  }

  it('receipt-bearing fixture with an uncovered promise FAILS --check', () => {
    fs.writeFileSync(
      FIXTURE_ERROR,
      fidDoc({
        status: 'fixed',
        gates: ['quality'],
        verification: `- New runtime test: \`${PROMISED}\` proves the sweep.`,
        withReceipt: true,
      }),
    )
    const { exit, stdout } = runCheck()
    expect(exit).toBe(1)
    expect(stdout).toContain('FID-2026-9999-1231-sweep-error-fixture.md')
    expect(stdout).toContain('verification-contract gap')
    expect(stdout).toContain(PROMISED)
  })

  it('receipt-less fixture surfaces only an enumerated warning, never an error', () => {
    // The error fixture from the previous test is still present; this run
    // must judge the warning fixture alone.
    fs.rmSync(FIXTURE_ERROR, { force: true })
    fs.writeFileSync(
      FIXTURE_WARN,
      fidDoc({
        status: 'analyzed',
        gates: ['quality'],
        verification: `- New runtime test: \`${PROMISED}\` proves the sweep.`,
        withReceipt: false,
      }),
    )
    const { stdout } = runCheck()
    // The warning fixture is enumerated under the info header…
    expect(stdout).toContain('verification-contract warnings (info):')
    expect(stdout).toContain('FID-2026-9999-1232-sweep-warning-fixture.md')
    expect(stdout).toContain(PROMISED)
    // …and is NEVER attributed a violation: it appears in no ✗ error block.
    const errorLines = stdout
      .split('\n')
      .filter((line) => line.trim().startsWith('✗'))
    for (const line of errorLines) {
      expect(line).not.toContain('sweep-warning-fixture')
    }
    // Repo-wide exit is NOT asserted: it legitimately depends on other
    // FIDs' receipt freshness (e.g. a document mid-re-stamp in its own
    // closure ceremony). The fixture-level contract — warnings are
    // non-fatal, errors are fatal — is pinned by the unit shape above and
    // the error-fixture exit proof.
  })
})
