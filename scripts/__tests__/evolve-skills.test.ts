import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  buildCandidates,
  candidateReportLine,
  emitCandidates,
} from '../evolve-skills'
import { collectScratchpadIssues } from '../hygiene'

import type { ExperienceRecord } from '@savant-code/common/types/experience'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolve-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

function record(tool: string, error: string): ExperienceRecord {
  return {
    ts: new Date().toISOString(),
    triggerType: 'tool_failure',
    toolName: tool,
    errorFirstLine: error,
    contextHash: '0'.repeat(64),
    sessionId: 's',
  }
}

function writeLedger(root: string, records: ExperienceRecord[]): void {
  fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
    records.map((r) => JSON.stringify(r)).join('\n') + '\n',
    'utf8',
  )
}

describe('buildCandidates (S4-A)', () => {
  test('groups ledger failures into top candidates', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'tsc: command not found'),
      record('run_command', 'tsc: command not found'),
      record('run_command', 'tsc: command not found'),
      record('web_search', 'timeout'),
      record('web_search', 'timeout'),
    ])
    const candidates = buildCandidates(root)
    expect(candidates).toHaveLength(2)
    expect(candidates[0].toolName).toBe('run_command')
    expect(candidates[0].count).toBe(3)
    expect(candidates[0].skillDraftContent).toContain('When to Use')
    expect(candidates[0].fidContent).toContain('## Proposed Solution')
  })

  test('empty ledger yields no candidates', () => {
    const root = fixtureRoot()
    writeLedger(root, [])
    expect(buildCandidates(root)).toEqual([])
  })
})

describe('emitCandidates', () => {
  test('writes only under the managed scratchpad active tree', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record('run_command', 'boom'),
      record('run_command', 'boom'),
    ])
    const candidates = buildCandidates(root)
    const emitted = emitCandidates(root, candidates)
    expect(emitted.length).toBeGreaterThan(0)
    for (const file of emitted) {
      expect(
        file.startsWith(
          path.join(root, 'dev', 'scratchpad', 'active', 'evolve-output'),
        ),
      ).toBe(true)
      expect(fs.existsSync(file)).toBe(true)
    }
    // Live skill dir untouched.
    expect(fs.existsSync(path.join(root, '.agents', 'skills'))).toBe(false)
    expect(collectScratchpadIssues(root)).toEqual([])
  })
})

describe('candidate counted unit (FID-2026-1021-001)', () => {
  test('the console line names the class the count belongs to', () => {
    const root = fixtureRoot()
    writeLedger(root, [
      record(
        'run_command',
        'Command exited with code 127: head: command not found',
      ),
      record(
        'run_command',
        'Command exited with code 127: tail: command not found',
      ),
    ])
    const candidates = buildCandidates(root)
    const candidate = candidates[0]!
    expect(candidate.cause).toBe('command-exit')
    expect(candidate.count).toBe(2)
    // The count attaches to the CLASS; the message is one exemplar inside it.
    expect(candidateReportLine(candidate)).toBe(
      `- [${candidate.risk}] ${candidate.skillName}: run_command · ` +
        'command-exit ×2; e.g. Command exited with code 127: head: command not found',
    )
  })
})
