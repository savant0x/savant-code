import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, expect, test } from 'bun:test'

import { telemetryReportLines } from '../session-end-notices'
import { runSessionEndReview } from '../session-end-review'

const roots: string[] = []
const NOW = Date.parse('2026-10-09T12:00:00Z')
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true })
})

function fixture(): { root: string; dir: string; source: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-review-'))
  roots.push(root)
  const dir = path.join(root, 'dev', 'telemetry')
  fs.mkdirSync(dir, { recursive: true })
  return { root, dir, source: path.join(dir, 'compliance.jsonl') }
}

function seed(source: string): void {
  const lines = [10, 1, 1].flatMap((daysAgo) =>
    Array.from({ length: 6 }, () =>
      JSON.stringify({
        schemaVersion: 1,
        ts: new Date(NOW - daysAgo * 86400000).toISOString(),
        sessionId: 'fixture',
        model: 'test-model',
        provider: 'fixture',
        lawId: 7,
        violationClass: 'flagged',
        agentRole: 'forge',
        gateLayer: 'pre-write',
        contextHash: '',
      }),
    ),
  )
  fs.writeFileSync(source, lines.join('\n'))
}

test('SessionEnd surfaces drift and drafts without consuming agenda items', () => {
  const { root, dir, source } = fixture()
  seed(source)
  const review = runSessionEndReview(root, { now: NOW })
  expect(review.routing).toContain(
    'Telemetry drift: law 7, 6 → 12 observations (2.0×); review dev/telemetry/drift.jsonl.',
  )
  expect(
    review.routing.some((line) => line.includes('law7-dominance.md')),
  ).toBe(true)
  expect(review.items).toEqual([])
  expect(review.agenda).not.toContain('Telemetry')
  expect(review.agenda.split('\n').length).toBeLessThanOrEqual(50)
  expect(
    JSON.parse(fs.readFileSync(path.join(dir, 'drift.jsonl'), 'utf8')).findings,
  ).toHaveLength(1)
  expect(fs.existsSync(path.join(dir, 'proposals', 'law7-dominance.md'))).toBe(
    true,
  )
  fs.writeFileSync(source, '')
  expect(telemetryReportLines(root, { now: NOW })).toEqual([])
  expect(fs.existsSync(path.join(dir, 'proposals', 'law7-dominance.md'))).toBe(
    false,
  )
})

test('absent ledger and opt-out do not create derived telemetry', () => {
  const { root, dir, source } = fixture()
  expect(telemetryReportLines(root, { now: NOW })).toEqual([])
  seed(source)
  fs.writeFileSync(
    path.join(root, 'protocol.config.yaml'),
    'complianceTelemetry:\n  enabled: false\n',
  )
  expect(telemetryReportLines(root, { now: NOW })).toEqual([])
  expect(fs.readdirSync(dir)).toEqual(['compliance.jsonl'])
})

test('an unreadable ledger cannot abort the review or reveal raw errors', () => {
  const { root, source } = fixture()
  fs.mkdirSync(source)
  expect(telemetryReportLines(root, { now: NOW })).toEqual([
    'Telemetry review unavailable; retry /telemetry.',
  ])
  expect(runSessionEndReview(root, { now: NOW }).agenda).toContain(
    'No recurring failure',
  )
})
