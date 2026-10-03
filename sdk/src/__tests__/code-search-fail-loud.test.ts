/**
 * FID-2026-1002-001 — code_search must never lie by omission.
 *
 * The defect (reproduced live 2026-10-02): a pattern with 65 ground-truth
 * file hits returned `stdout: "Found 0 matches"` + `message: "Exit code: 0"`.
 * Ripgrep only exits 0 when matches existed — the collected set, not the
 * search, lost them, and every layer rendered the loss as a clean no-match.
 *
 * The contract these pins encode (FID steps 1-5):
 *   1. Deliberate reproduction: malformed event lines previously vanished
 *      (`addEventLine` returned 'ok', zero accounting) — now they are counted.
 *   2. Drop accounting: `droppedEventLines` + `firstDroppedLine` expose every
 *      unparseable line; protocol events (begin/end/summary) are NOT drops.
 *   3. Anomaly settlement: exit 0 + zero collected, drop-explained zeros,
 *      error exits, and signal deaths settle through the ERROR channel with
 *      stderr and the drop count — never as a no-match.
 *   4. Display conflation removed: `formatCodeSearchOutput` renders an empty
 *      result as "Found 0 matches" ONLY for a clean run; an anomalous run
 *      renders the caller's anomaly text.
 *   5. Clean no-match (exit 1, zero collected, zero drops) still says
 *      "Found 0 matches" — the honest case is preserved, not broken.
 */
import { describe, expect, it } from 'bun:test'

import { formatCodeSearchOutput } from '../../../common/src/util/format-code-search'
import { classifyCodeSearchOutcome } from '../tools/code-search/anomaly'
import { buildCloseOutput } from '../tools/code-search/format'
import { RipgrepMatchCollector } from '../tools/code-search/match-collector'

/** Ripgrep `--json` match event with the given path/line. */
function matchEvent(path: string, line: number): string {
  return JSON.stringify({
    type: 'match',
    data: {
      path: { text: path },
      line_number: line,
      lines: { text: `hit ${line}\n` },
    },
  })
}

function newCollector(): RipgrepMatchCollector {
  return new RipgrepMatchCollector(15, 250, 20_000)
}

describe('FID-2026-1002-001 step 1-2 — drop accounting in the collector', () => {
  it('accounts byte-only payloads as drops instead of blank successful matches', () => {
    const collector = newCollector()
    collector.addEventLine(
      JSON.stringify({
        type: 'match',
        data: {
          path: { bytes: Buffer.from('src/sample.ts').toString('base64') },
          line_number: 1,
          lines: { bytes: Buffer.from('needle\n').toString('base64') },
        },
      }),
      'stream',
    )
    expect(collector.matchesGlobal).toBe(0)
    expect(collector.droppedEventLines).toBe(1)
    expect(collector.fileGroups.size).toBe(0)
  })

  it('rejects an event missing its path or line payload', () => {
    const collector = newCollector()
    collector.flushRemainder(JSON.stringify({ type: 'match', data: {} }))
    expect(collector.matchesGlobal).toBe(0)
    expect(collector.droppedEventLines).toBe(1)
  })

  it('REPRODUCTION: malformed event lines previously vanished silently — now they are counted', () => {
    const collector = newCollector()
    // One valid match, then the malformed stream that used to vanish.
    expect(collector.addEventLine(matchEvent('src/a.ts', 3), 'stream')).toBe(
      'ok',
    )
    collector.addEventLine('not json at all', 'stream')
    collector.addEventLine('{"type":"begin"', 'stream') // truncated JSON
    collector.addEventLine('{"type":"warp","data":{}}', 'stream') // unknown type (schema drift)

    expect(collector.droppedEventLines).toBe(3)
    expect(collector.matchesGlobal).toBe(1)
    expect(collector.firstDroppedLine).toBe('not json at all')
  })

  it('protocol events (begin/end/summary) are NOT drops', () => {
    const collector = newCollector()
    collector.addEventLine(
      JSON.stringify({ type: 'begin', data: { path: { text: 'src/a.ts' } } }),
      'stream',
    )
    collector.addEventLine(matchEvent('src/a.ts', 1), 'stream')
    collector.addEventLine(
      JSON.stringify({ type: 'summary', data: {} }),
      'stream',
    )
    expect(collector.droppedEventLines).toBe(0)
    expect(collector.matchesGlobal).toBe(1)
  })

  it('a clean stream drops nothing', () => {
    const collector = newCollector()
    collector.addEventLine(matchEvent('src/a.ts', 1), 'stream')
    collector.addEventLine(matchEvent('src/b.ts', 2), 'stream')
    collector.flushRemainder('')
    expect(collector.droppedEventLines).toBe(0)
    expect(collector.matchesGlobal).toBe(2)
  })

  it('flushRemainder accounts partial trailing lines (the close path)', () => {
    const collector = newCollector()
    collector.flushRemainder('{"type":"match","data":{"path":{"text":"x"')
    expect(collector.droppedEventLines).toBe(1)
  })
})

describe('FID-2026-1002-001 step 3 — anomaly settlement', () => {
  it('exit 0 with zero collected matches is a HARD anomaly (the observed bug)', () => {
    const outcome = classifyCodeSearchOutcome({
      code: 0,
      collected: 0,
      dropped: 0,
      firstDroppedLine: null,
      stderrBuf: '',
    })
    expect(outcome.kind).toBe('anomaly')
    if (outcome.kind !== 'anomaly') return
    expect(outcome.errorMessage).toContain('exited 0')
    expect(outcome.errorMessage).toContain('false no-match')
  })

  it('drops that explain a zero make the no-match untrustworthy (hard anomaly)', () => {
    const outcome = classifyCodeSearchOutcome({
      code: 1,
      collected: 0,
      dropped: 4,
      firstDroppedLine: '{"type":"match"',
      stderrBuf: '',
    })
    expect(outcome.kind).toBe('anomaly')
    if (outcome.kind !== 'anomaly') return
    expect(outcome.errorMessage).toContain('4 event line(s)')
    expect(outcome.errorMessage).toContain('not trustworthy')
  })

  it('an error exit (2+) is a hard anomaly carrying stderr', () => {
    const outcome = classifyCodeSearchOutcome({
      code: 2,
      collected: 0,
      dropped: 0,
      firstDroppedLine: null,
      stderrBuf: 'rg: unrecognized flag',
    })
    expect(outcome.kind).toBe('anomaly')
    if (outcome.kind !== 'anomaly') return
    expect(outcome.errorMessage).toContain('exited 2')
    expect(outcome.errorMessage).toContain('unrecognized flag')
  })

  it('a signal death (null code) is a hard anomaly', () => {
    const outcome = classifyCodeSearchOutcome({
      code: null,
      collected: 0,
      dropped: 0,
      firstDroppedLine: null,
      stderrBuf: '',
    })
    expect(outcome.kind).toBe('anomaly')
  })

  it('drops alongside collected matches are a WARNING, not a loss', () => {
    const outcome = classifyCodeSearchOutcome({
      code: 0,
      collected: 16,
      dropped: 2,
      firstDroppedLine: 'x',
      stderrBuf: '',
    })
    expect(outcome.kind).toBe('warning')
    if (outcome.kind !== 'warning') return
    expect(outcome.message).toContain('incomplete')
  })

  it('exit 1 + zero collected + zero drops is the one clean no-match', () => {
    const outcome = classifyCodeSearchOutcome({
      code: 1,
      collected: 0,
      dropped: 0,
      firstDroppedLine: null,
      stderrBuf: '',
    })
    expect(outcome.kind).toBe('clean')
  })
})

describe('FID-2026-1002-001 step 4 — display conflation removed', () => {
  it('the formatter defaults an empty result to the clean no-match line', () => {
    expect(formatCodeSearchOutput('')).toBe('Found 0 matches')
    expect(formatCodeSearchOutput('   \n')).toBe('Found 0 matches')
  })

  it('an anomalous run NEVER renders "Found 0 matches" (buildCloseOutput)', () => {
    const close = buildCloseOutput({
      fileGroups: new Map(),
      filesLimitedByMaxResults: new Set(),
      matchesGlobal: 0,
      killedForLimit: false,
      maxResults: 15,
      globalMaxResults: 250,
      maxOutputStringLength: 20_000,
      stderrBuf: '',
      emptyResultText:
        'No match list: the search run did not complete cleanly (see the error).',
    })
    expect(close.stdout).not.toContain('Found 0 matches')
    expect(close.stdout).toContain('did not complete cleanly')
  })

  it('the formatter refuses "Found 0 matches" when told the run was anomalous', () => {
    const out = formatCodeSearchOutput('', {
      emptyResultText: 'No match list: the search run failed (see the error).',
    })
    expect(out).not.toContain('Found 0 matches')
    expect(out).toContain('No match list')
  })
})

describe('FID-2026-1002-001 step 5 — the honest clean no-match is preserved', () => {
  it('buildCloseOutput with a clean zero still renders "Found 0 matches"', () => {
    const close = buildCloseOutput({
      fileGroups: new Map(),
      filesLimitedByMaxResults: new Set(),
      matchesGlobal: 0,
      killedForLimit: false,
      maxResults: 15,
      globalMaxResults: 250,
      maxOutputStringLength: 20_000,
      stderrBuf: '',
    })
    expect(close.stdout).toContain('Found 0 matches')
  })
})
