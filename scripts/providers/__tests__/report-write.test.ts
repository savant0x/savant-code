/**
 * FID-2026-0915-002 (split 4) — write/guard pins, moved verbatim from
 * harvest-core.test.ts (the `writeReportStable` half of the MQ8 describe
 * plus the `assertWithinDev (no-write-outside-dev guard)` describe; split
 * out of report-stable.test.ts when it measured 304 lines).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import { writeReportStable } from '../lib/report'
import { assertWithinDev } from '../lib/typosquat'

describe('writeReportStable (MQ8 replace-in-place)', () => {
  test('stable path: a second write REPLACES, never appends (MQ8)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-report-'))
    try {
      writeReportStable(
        'dev/provider-candidates',
        '# run one\nold content',
        undefined,
        () => dir,
      )
      const first = readFileSync(
        join(dir, 'dev/provider-candidates/report.md'),
        'utf8',
      )
      expect(first).toContain('run one')
      writeReportStable(
        'dev/provider-candidates',
        '# run two\nnew content',
        undefined,
        () => dir,
      )
      const second = readFileSync(
        join(dir, 'dev/provider-candidates/report.md'),
        'utf8',
      )
      expect(second).toContain('run two')
      expect(second).not.toContain('old content')
      expect(second).toBe('# run two\nnew content')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('writeReportStable also replaces candidates.json state in place', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fa-state-'))
    try {
      writeReportStable(
        'dev/provider-candidates',
        '# r',
        JSON.stringify({ v: 1 }),
        () => dir,
      )
      writeReportStable(
        'dev/provider-candidates',
        '# r',
        JSON.stringify({ v: 2 }),
        () => dir,
      )
      const state = JSON.parse(
        readFileSync(
          join(dir, 'dev/provider-candidates/candidates.json'),
          'utf8',
        ),
      )
      expect(state.v).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('assertWithinDev (no-write-outside-dev guard)', () => {
  test('accepts dev-relative output paths', () => {
    expect(() =>
      assertWithinDev('dev/provider-candidates/report.md'),
    ).not.toThrow()
    expect(() => assertWithinDev('dev/scratchpad/proposal.md')).not.toThrow()
  })

  test('throws on anything outside dev/ (traversal and absolute)', () => {
    expect(() => assertWithinDev('src/providers/registry.ts')).toThrow()
    expect(() => assertWithinDev('../outside.md')).toThrow()
    expect(() => assertWithinDev('dev/../package.json')).toThrow()
    expect(() => assertWithinDev('package.json')).toThrow()
  })
})
