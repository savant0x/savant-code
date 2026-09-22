/**
 * FID-2026-0919-021 pin — the `fid:verify --check` enforcement-information
 * tier (T69 ruling).
 *
 * A status outside `{fixed, verified}` is NOT enforced by the receipt
 * contract, by design (the closure ceremony edits a record after its last
 * stamp). Previously that skip was silent, so an unenforced record and a
 * clean enforced one printed the same PASS. This suite pins the live
 * behavior: the skip is stated with its reason, and it never becomes a
 * structural failure.
 *
 * Split from `fid-contract-sweep-widened.test.ts` on the FID-2026-0913-002
 * discipline (that file reached 304 lines against the 300 ceiling). The
 * fixture below is a minimal literal rather than the sweep suite's builder
 * because this tier needs no receipt — reusing the builder would import
 * fingerprint machinery only to discard it.
 */
import { spawnSync as nodeSpawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { afterAll, describe, expect, it } from 'bun:test'

const ROOT = path.resolve(import.meta.dir, '../..')
const FIXTURE = path.join(
  ROOT,
  'dev/fids/FID-2026-9999-1201-enforcement-info-fixture.md',
)

const UNENFORCED_FIXTURE = [
  '# FID: enforcement information fixture',
  '',
  '**Status:** analyzed',
  '',
  '## Verification Gates',
  '',
  '- gate: quality',
  '',
].join('\n')

describe('fid:verify --check reports a skipped contract explicitly (T69)', () => {
  afterAll(() => {
    fs.rmSync(FIXTURE, { force: true })
  })

  it('names an active non-fixed/verified FID as unenforced, without failing the scan', () => {
    fs.writeFileSync(FIXTURE, UNENFORCED_FIXTURE)
    const spawned = nodeSpawnSync('bun', ['run', 'fid:verify', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    })
    const stdout = spawned.stdout ?? ''
    // The skip is stated, not silent…
    expect(stdout).toContain('verification contract not enforced')
    expect(stdout).toContain('enforcement-info-fixture')
    expect(stdout).toContain('no live fingerprint guarantee')
    // …and it is NEVER attributed a structural violation.
    const errorLines = stdout
      .split('\n')
      .filter((line) => line.trim().startsWith('✗'))
    for (const line of errorLines) {
      expect(line).not.toContain('enforcement-info-fixture')
    }
  })
})
