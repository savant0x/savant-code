/**
 * SEC-3 (`FID-2026-0919-010`) — the stderr-redirect exemption must be
 * SPAN-scoped, not segment-scoped.
 *
 * The archived record for that FID declares this file as one of its promised
 * test artifacts and marks its implementation step DONE. Neither the suite nor
 * the span-scoped scan existed at HEAD when this file was authored
 * (`git log --all --name-status -- '*redirect-waiver*'` shows only the record's
 * own add/archive commits — no implementation commit), and a probe of the HEAD
 * module accepted `cat .env > /tmp/exfil.txt 2>&1`.
 *
 * These pins therefore discharge the promise and hold the corrected behaviour:
 * the permitted redirect is removed from the segment and the remainder is
 * re-scanned, so a permitted token can never launder a violation.
 */
import { describe, expect, it } from 'bun:test'

import { isReadonlyCommand } from '../tool/readonly-command-validation'

describe('readonly redirect exemption is span-scoped (FID-2026-0919-010 SEC-3)', () => {
  it("rejects the record's worked example: an arbitrary write laundered by 2>&1", () => {
    const result = isReadonlyCommand('cat .env > /tmp/exfil.txt 2>&1')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('forbidden shell metacharacters')
  })

  it('rejects command substitution, separators, and backticks behind a permitted redirect', () => {
    const laundered = [
      'cat .env $(whoami) 2>&1',
      'echo `id` 2>&1',
      'ls; rm -rf build 2>&1',
      'cat .env > seeds.txt 2>&1',
      'cat .env | tee exfil.txt 2>&1',
    ]

    for (const command of laundered) {
      expect(isReadonlyCommand(command).valid).toBe(false)
    }
  })

  it('keeps the diagnostic usages the exemption was written for', () => {
    const diagnostics = [
      'cat foo.txt 2>&1',
      'echo hi 2>&1',
      'bun test 2>&1 | cat',
      'ls -la 2>nul',
      'ls -la > /dev/null',
    ]

    for (const command of diagnostics) {
      expect(isReadonlyCommand(command).valid).toBe(true)
    }
  })

  it('scopes the exemption per segment, so a clean `&&` leg cannot cover a dirty one', () => {
    expect(
      isReadonlyCommand('git status 2>&1 && cat .env > seeds.txt').valid,
    ).toBe(false)
    expect(isReadonlyCommand('git status 2>&1 && git diff --stat').valid).toBe(
      true,
    )
  })
})
