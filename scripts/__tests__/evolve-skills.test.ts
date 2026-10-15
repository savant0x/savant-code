import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { buildCandidates, emitCandidates } from '../evolve-skills'

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
  test('writes only under dev/scratchpad/evolve-output/', () => {
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
        file.startsWith(path.join(root, 'dev', 'scratchpad', 'evolve-output')),
      ).toBe(true)
      expect(fs.existsSync(file)).toBe(true)
    }
    // Live skill dir untouched.
    expect(fs.existsSync(path.join(root, '.agents', 'skills'))).toBe(false)
  })
})
