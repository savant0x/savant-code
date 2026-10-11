/**
 * LEARNINGS-feedback pins (FID-2026-1007-012 FID 7).
 *
 * RED-first: no dominance analysis existed over compliance data. Dominance
 * (>40% share, BO-specified) drafts a proposal; sub-threshold data does
 * not; stale drafts clear when dominance passes.
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { findDominantLaws, syncProposals } from '../telemetry-feedback'

const NOW = Date.parse('2026-10-08T12:00:00.000Z')

const tempRoots: string[] = []
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function event(lawId: number, model = 'glm-5.3-flash'): string {
  return JSON.stringify({
    schemaVersion: 1,
    ts: '2026-10-08T10:00:00.000Z',
    sessionId: 's1',
    model,
    provider: 'hcnsec',
    lawId,
    violationClass: 'flagged',
    agentRole: 'forge',
    gateLayer: 'pre-write',
    contextHash: '',
  })
}

function ledger(lawCounts: Record<number, number>): string {
  const lines: string[] = []
  for (const [law, count] of Object.entries(lawCounts)) {
    for (let i = 0; i < count; i++) {
      lines.push(event(Number(law), `model-${i % 3}`))
    }
  }
  return lines.join('\n')
}

describe('learning feedback (FID-2026-1007-012 FID 7)', () => {
  test('dominance triggers a proposal', () => {
    const { proposals, totalCount } = findDominantLaws(ledger({ 7: 9, 3: 3 }), {
      now: NOW,
    })
    expect(totalCount).toBe(12)
    expect(proposals).toHaveLength(1)
    expect(proposals[0]).toMatchObject({ law: '7', lawCount: 9 })
    expect(proposals[0]!.share).toBeGreaterThan(0.4)
  })

  test('sub-threshold data proposes nothing', () => {
    const { proposals } = findDominantLaws(ledger({ 7: 4, 3: 4, 15: 4 }), {
      now: NOW,
    })
    expect(proposals).toEqual([])
  })

  test('tiny samples never propose, however skewed', () => {
    const { proposals } = findDominantLaws(ledger({ 7: 3 }), { now: NOW })
    expect(proposals).toEqual([])
  })

  // FID-2026-1010-004: the draft is machine output consumed by `lint:md`, so
  // the 120-column ceiling is a renderer contract, not a one-off edit of the
  // file that happened to be on disk. Without this pin the joined single-line
  // paragraph returns on the next regeneration and fails the markdown gate.
  test('generated drafts stay within the markdown 120-column ceiling', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'telemetry-fb-'))
    tempRoots.push(root)
    const telemetryDir = path.join(root, 'dev', 'telemetry')
    mkdirSync(telemetryDir, { recursive: true })
    writeFileSync(
      path.join(telemetryDir, 'compliance.jsonl'),
      ledger({ 15: 9, 3: 3 }),
      'utf8',
    )
    const { written } = syncProposals(root, { now: NOW })
    expect(written).toEqual(['law15-dominance.md'])
    const draft = readFileSync(
      path.join(telemetryDir, 'proposals', 'law15-dominance.md'),
      'utf8',
    )
    const longestLine = Math.max(
      ...draft.split('\n').map((line) => line.length),
    )
    expect(longestLine).toBeLessThanOrEqual(120)
  })

  test('sync writes drafts and clears stale ones', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'telemetry-fb-'))
    tempRoots.push(root)
    const telemetryDir = path.join(root, 'dev', 'telemetry')
    const proposalsDir = path.join(telemetryDir, 'proposals')
    mkdirSync(telemetryDir, { recursive: true })
    writeFileSync(
      path.join(telemetryDir, 'compliance.jsonl'),
      ledger({ 7: 9, 3: 3 }),
      'utf8',
    )
    mkdirSync(proposalsDir, { recursive: true })
    writeFileSync(path.join(proposalsDir, 'law3-dominance.md'), 'stale', 'utf8')
    const first = syncProposals(root, { now: NOW })
    expect(first.written).toEqual(['law7-dominance.md'])
    expect(first.removed).toEqual(['law3-dominance.md'])
    expect(
      readFileSync(path.join(proposalsDir, 'law7-dominance.md'), 'utf8'),
    ).toContain('DRAFT')
    expect(readdirSync(proposalsDir)).toEqual(['law7-dominance.md'])
  })
})
