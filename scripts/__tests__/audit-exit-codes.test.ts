// FID-2026-0907-002 (Step 3) — exit-code-masking detector tests.
// Positive fixtures pin the incident shape (pipe into tail/head/tee then
// `echo $?` within the window, in shell, hooks, and YAML run blocks);
// negatives pin the exemptions (no pipe, outside the window, comments,
// non-shadowing echoes).

import { describe, expect, test } from 'bun:test'

import {
  detectMaskedExitCodes,
  AUDITED_SURFACE_ARGS,
  type ScriptLines,
} from '../audit-exit-codes'

function lines(...entries: string[]): ScriptLines {
  return { file: 'fixture.sh', lines: entries }
}

describe('detectMaskedExitCodes (FID-2026-0907-002)', () => {
  test('flags echo $? directly after a pipe into tail (the incident shape)', () => {
    const issues = detectMaskedExitCodes(
      lines('bun x eslint . 2>&1 | tail -20', 'echo $?'),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].file).toBe('fixture.sh')
    expect(issues[0].line).toBe(2)
    expect(issues[0].message).toContain('shadowed')
  })

  test('flags within the 3-line window in a YAML run block', () => {
    const issues = detectMaskedExitCodes(
      lines(
        'run: |',
        '  bun run quality:report | tail -5',
        '  name: done',
        '  echo "status"',
        '  echo $?',
      ),
    )
    expect(issues).toHaveLength(1)
    expect(issues[0].line).toBe(5)
  })

  test('flags tee and head pipes too', () => {
    const tee = detectMaskedExitCodes(
      lines('bun test | tee out.log', 'echo $?'),
    )
    const head = detectMaskedExitCodes(lines('bun build | head -40', 'echo $?'))
    expect(tee).toHaveLength(1)
    expect(head).toHaveLength(1)
  })

  test('does not flag echo $? without a preceding pipe', () => {
    const issues = detectMaskedExitCodes(lines('bun run ci', 'echo $?'))
    expect(issues).toHaveLength(0)
  })

  test('does not flag echo $? outside the masking window', () => {
    const issues = detectMaskedExitCodes(
      lines(
        'bun run ci | tail -5',
        'echo "--- summary ---"',
        'echo "--- done ---"',
        'echo "--- end ---"',
        'echo "--- after ---"',
        'echo $?',
      ),
    )
    expect(issues).toHaveLength(0)
  })

  test('comment lines are exempt from both pattern roles', () => {
    const issues = detectMaskedExitCodes(
      lines(
        '# example: bun ci | tail -5',
        '# echo $?   <- would shadow',
        'bun run ci',
        'echo $?',
      ),
    )
    expect(issues).toHaveLength(0)
  })

  test('a second piped command resets the window anchor', () => {
    const issues = detectMaskedExitCodes(
      lines(
        'a | tail -1',
        'echo "--- x ---"',
        'echo "--- y ---"',
        'b | tail -1',
        'echo "--- z ---"',
        'echo "--- w ---"',
        'echo $?',
        'echo "--- v ---"',
      ),
    )
    // echo $? is 3 lines after the SECOND pipe (line 4 → line 7): inside
    // the window relative to the latest anchor. Distance from the first
    // pipe would be 6 — outside — proving the anchor reset matters.
    expect(issues).toHaveLength(1)
    expect(issues[0].line).toBe(7)
  })

  test('audited surfaces cover scripts, hooks, and workflows', () => {
    expect(AUDITED_SURFACE_ARGS).toEqual([
      'scripts',
      '.githooks',
      '.github/workflows',
    ])
  })
})
