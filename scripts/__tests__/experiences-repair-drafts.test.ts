import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  planRepairDrafts,
  writeRepairDrafts,
} from '../experiences-repair-drafts'

const NOW = Date.UTC(2026, 9, 13)

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repair-drafts-'))
  fs.mkdirSync(path.join(root, 'dev/experiences'), { recursive: true })
  fs.writeFileSync(path.join(root, 'SCOPE.md'), '# Operator register\n')
  fs.writeFileSync(
    path.join(root, 'dev/experiences/class-owners.json'),
    JSON.stringify({ version: 1, owners: [] }),
  )
  fs.writeFileSync(
    path.join(root, 'dev/experiences/raw-traces.jsonl'),
    [1, 2, 3]
      .map((index) =>
        JSON.stringify({
          ts: new Date(NOW - index * 86400000).toISOString(),
          triggerType: 'tool_failure',
          toolName: 'read_files',
          errorFirstLine: 'Incomplete arguments for tool read_files',
          contextHash: '0'.repeat(64),
          sessionId: `session-${index}`,
        }),
      )
      .join('\n') + '\n',
  )
  return root
}

describe('unowned class repair drafts', () => {
  test('drafting is deterministic, idempotent and never approves or registers a record', () => {
    const root = fixture()
    try {
      const capture = fs.readFileSync(
        path.join(root, 'dev/experiences/raw-traces.jsonl'),
        'utf8',
      )
      const planned = planRepairDrafts(root, NOW)
      expect(planned).toHaveLength(1)
      expect(planRepairDrafts(root, NOW)).toEqual(planned)
      expect(planned[0]?.document).toContain('**Status:** created')
      expect(planned[0]?.document).toContain('**Automation level:** 1')
      expect(planned[0]?.fid).toBe('FID-2026-1013-001')
      expect(writeRepairDrafts(root, NOW)).toEqual(planned)
      expect(writeRepairDrafts(root, NOW)).toEqual([])
      expect(
        fs
          .readFileSync(
            path.join(root, 'dev/experiences/repair-proposals.jsonl'),
            'utf8',
          )
          .trim()
          .split('\n'),
      ).toHaveLength(1)
      expect(fs.existsSync(path.join(root, 'dev/fids'))).toBe(false)
      expect(fs.readFileSync(path.join(root, 'SCOPE.md'), 'utf8')).toBe(
        '# Operator register\n',
      )
      expect(
        fs.readFileSync(
          path.join(root, 'dev/experiences/raw-traces.jsonl'),
          'utf8',
        ),
      ).toBe(capture)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
  test('an existing writer lock prevents competing proposal allocation', () => {
    const root = fixture()
    try {
      fs.writeFileSync(
        path.join(root, 'dev/experiences/repair-drafts.lock'),
        'fixture writer',
      )
      expect(writeRepairDrafts(root, NOW)).toEqual([])
      expect(
        fs.existsSync(
          path.join(root, 'dev/experiences/repair-proposals.jsonl'),
        ),
      ).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
