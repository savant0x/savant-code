/**
 * FID-2026-0915-001 (W6) — the quality gauntlet pins (RED-first).
 *
 * Operator-run coding rubric: 8 fixed prompts (MQ3), deterministic checks,
 * injectable runner (no live network in tests), score + latency to
 * quality.json (gitignored). The operator's key NEVER appears in any
 * output — the file contract pins that.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  GAUNTLET_PROMPT_COUNT,
  runGauntlet,
  scoreRuns,
  type GauntletResult,
} from '../lib/quality-core'

const dir = mkdtempSync(join(tmpdir(), 'quality-gauntlet-'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))

/** Fake runner: instant, deterministic answers keyed by prompt index. */
function fakeRunner(
  answers: string[],
  latency = 50,
): (prompt: string) => Promise<{ text: string; latencyMs: number }> {
  let i = 0
  return async () => ({ text: answers[i++] ?? '', latencyMs: latency })
}

describe('quality gauntlet core (W6)', () => {
  test(`exactly ${GAUNTLET_PROMPT_COUNT} fixed prompts (MQ3 ruling)`, () => {
    expect(GAUNTLET_PROMPT_COUNT).toBe(8)
  })

  test('scoring: perfect run scores 8/8 with recorded latencies (results returned)', async () => {
    const results = await runGauntlet({
      host: 'test.host',
      apiKey: 'sk-test',
      stateDir: dir,
      runner: fakeRunner([
        'PONG-42',
        '{"ok":true}',
        '391',
        'function add(a, b) { return a + b; }',
        'const total = nums.reduce((a, b) => a + b, 0); return total;',
        '1, 2, 3, 4, 5',
        'let count = 1; count += 1;',
        'Paris',
      ]),
    })
    expect(results.score).toBe(8)
    expect(results.total).toBe(8)
    expect(results.avgLatencyMs).toBe(50)
  })

  test('scoring: wrong answers fail their check without throwing', async () => {
    const results = await runGauntlet({
      host: 'test.host',
      apiKey: 'sk-test',
      stateDir: dir,
      runner: fakeRunner([
        'nope',
        'not json',
        'eleven',
        '// does not compile',
        '???',
        '5, 4, 3, 2, 1',
        'untouched code',
        'London',
      ]),
    })
    expect(results.score).toBe(0)
  })

  test('scoreRuns aggregates per-prompt pass/fail deterministically', () => {
    const rows: GauntletResult[] = [
      { prompt: 'p', passed: true, latencyMs: 100, answer: 'a' },
      { prompt: 'p', passed: false, latencyMs: 200, answer: 'b' },
    ]
    const summary = scoreRuns(rows)
    expect(summary.score).toBe(1)
    expect(summary.total).toBe(2)
    expect(summary.avgLatencyMs).toBe(150)
  })

  test('writes quality.json (host, score, latency, date) and NEVER the key', async () => {
    const apiKey = 'sk-SUPER-SECRET-OPERATOR-KEY'
    const { outPath } = await runGauntlet({
      host: 'test.host',
      apiKey,
      runner: fakeRunner([
        'PONG-42',
        '{"ok":true}',
        '391',
        'function add(a, b) { return a + b; }',
        'nums.reduce((a, b) => a + b, 0)',
        '1, 2, 3, 4, 5',
        'count += 1;',
        'Paris',
      ]),
      stateDir: dir,
      nowIso: '2026-09-15T00:00:00.000Z',
    })
    expect(existsSync(outPath)).toBe(true)
    const raw = readFileSync(outPath, 'utf8')
    expect(raw).not.toContain(apiKey)
    const parsed = JSON.parse(raw) as Array<{
      host: string
      score: string
      latencyMs: number
      runDate: string
    }>
    const row = parsed.find((r) => r.host === 'test.host')
    expect(row).toBeDefined()
    expect(row?.score).toBe('8/8')
    expect(row?.runDate).toBe('2026-09-15')
  })

  test('missing key → throws a clear message BEFORE any network call', async () => {
    let called = false
    await expect(
      runGauntlet({
        host: 'test.host',
        apiKey: '',
        runner: async () => {
          called = true
          return { text: '', latencyMs: 0 }
        },
        stateDir: dir,
      }),
    ).rejects.toThrow(/API key/i)
    expect(called).toBe(false)
  })
})
