import { describe, expect, test } from 'bun:test'

import {
  LEARNINGS_CHAR_CEILING,
  LEARNINGS_LINE_CEILING,
  LEARNINGS_RESTORE_COMMAND,
  learningsSizeIssues,
  learningsSizeSummary,
  logicalLineCount,
} from '../learnings-size-policy'

/**
 * FID-2026-1012-011: both ceilings are pinned in both directions. A ledger at
 * the limit passes, one over fails, and each measure fails on its own unit so
 * neither can hide behind the other.
 */

const atLineCeiling = `${'line\n'.repeat(LEARNINGS_LINE_CEILING - 1)}line`

describe('logicalLineCount', () => {
  test('counts newline-delimited segments, the unit retirement measures', () => {
    expect(logicalLineCount('a\nb\nc')).toBe(3)
    expect(logicalLineCount('a\r\nb')).toBe(2)
    expect(logicalLineCount(atLineCeiling)).toBe(LEARNINGS_LINE_CEILING)
  })
})

describe('learningsSizeIssues', () => {
  test('passes a ledger exactly at both ceilings', () => {
    expect(learningsSizeIssues(atLineCeiling)).toEqual([])
  })

  test('fails one logical line over the ceiling, naming the measure and the repair', () => {
    const issues = learningsSizeIssues(`${atLineCeiling}\n`)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('learning.size.line-ceiling')
    expect(issues[0]?.message).toContain(
      `${(LEARNINGS_LINE_CEILING + 1).toLocaleString('en-US')} logical lines`,
    )
    expect(issues[0]?.message).toContain('1 over')
    expect(issues[0]?.message).toContain(LEARNINGS_RESTORE_COMMAND)
    expect(issues[0]?.message).toContain('move-only')
  })

  test('fails the character ceiling independently of the line count', () => {
    // Two logical lines, well under the line ceiling, over on characters.
    const wide = `x\n${'y'.repeat(LEARNINGS_CHAR_CEILING)}`
    expect(logicalLineCount(wide)).toBe(2)
    const issues = learningsSizeIssues(wide)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('learning.size.char-ceiling')
    expect(issues[0]?.message).toContain('JavaScript characters')
    expect(issues[0]?.message).toContain('UTF-16 code units')
  })

  test('reports both breaches when both are over', () => {
    const both = `${'line\n'.repeat(LEARNINGS_LINE_CEILING)}${'z'.repeat(LEARNINGS_CHAR_CEILING)}`
    const codes = learningsSizeIssues(both).map((issue) => issue.code)
    expect(codes).toEqual([
      'learning.size.line-ceiling',
      'learning.size.char-ceiling',
    ])
  })
})

describe('learningsSizeSummary', () => {
  test('reports headroom while the gate is green', () => {
    const summary = learningsSizeSummary('a\nb\nc\n')
    expect(summary).toContain(
      `4/${LEARNINGS_LINE_CEILING.toLocaleString('en-US')} logical lines`,
    )
    expect(summary).toContain('characters of headroom')
  })
})
