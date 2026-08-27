import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'


import {
  EXPERIENCES_DIR_NAME,
  RAW_TRACES_FILE_NAME,
} from '@savant-code/common/types/experience'
import {
  experienceDedupKey,
  normalizeErrorFirstLine,
} from '@savant-code/common/util/experiences'
import { describe, expect, test } from 'bun:test'

import {
  appendExperienceRecord,
  buildExperienceRecord,
  runExperienceCapture,
} from '../experience-capture'

import type { HookInputData } from '../types'

function fixtureRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'exp-capture-'))
}

const FAILURE_INPUT: HookInputData = {
  hook_event_name: 'PostToolUseFailure',
  session_id: 'session-1',
  cwd: '/repo',
  tool_name: 'web_search',
  tool_input: { query: 'self improving agents', depth: 'standard' },
  error_message: 'HTTP 404: no results',
}

describe('normalizeErrorFirstLine (shared with the dedup layer)', () => {
  test('strips ANSI escapes', () => {
    expect(normalizeErrorFirstLine('\u001b[31mboom\u001b[0m: bad')).toBe(
      'boom: bad',
    )
  })
  test('normalizes Windows path separators', () => {
    expect(normalizeErrorFirstLine('ENOENT C:\\a\\b\\c.ts')).toBe(
      'ENOENT C:/a/b/c.ts',
    )
  })
  test('collapses whitespace and takes the first line only', () => {
    expect(normalizeErrorFirstLine('a   b\nc\nd')).toBe('a b')
  })
  test('empty input stays empty', () => {
    expect(normalizeErrorFirstLine('')).toBe('')
  })
})

describe('buildExperienceRecord', () => {
  test('produces a single immutable event record', () => {
    const record = buildExperienceRecord(FAILURE_INPUT)
    expect(record.triggerType).toBe('tool_failure')
    expect(record.toolName).toBe('web_search')
    expect(record.errorFirstLine).toBe('HTTP 404: no results')
    expect(record.sessionId).toBe('session-1')
    expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // Context is a hash, never the raw arguments.
    expect(record.contextHash).toMatch(/^[0-9a-f]{64}$/)
    expect(record.contextHash).not.toContain('self improving')
  })
  test('hashes canonical tool input so Windows and POSIX spellings agree', () => {
    const a = buildExperienceRecord({
      ...FAILURE_INPUT,
      tool_input: { path: 'C:\\a\\b.ts', query: 'x' },
    })
    const b = buildExperienceRecord({
      ...FAILURE_INPUT,
      tool_input: { query: 'x', path: 'C:/a/b.ts' },
    })
    expect(a.contextHash).toBe(b.contextHash)
  })
  test('tolerates missing error message and tool input', () => {
    const record = buildExperienceRecord({
      hook_event_name: 'PostToolUseFailure',
      session_id: 's',
      cwd: '/repo',
    })
    expect(record.errorFirstLine).toBe('')
    expect(record.contextHash).toBe('')
  })
})

describe('appendExperienceRecord + runExperienceCapture', () => {
  test('appends one JSON line per record, creating the store on first use', () => {
    const root = fixtureRoot()
    const r1 = appendExperienceRecord(root, buildExperienceRecord(FAILURE_INPUT))
    expect(r1.outcome).toBe('allowed')
    const r2 = appendExperienceRecord(root, buildExperienceRecord(FAILURE_INPUT))
    expect(r2.outcome).toBe('allowed')

    const file = path.join(root, EXPERIENCES_DIR_NAME, RAW_TRACES_FILE_NAME)
    const lines = fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim() !== '')
    expect(lines).toHaveLength(2)
    for (const line of lines) {
      const parsed = JSON.parse(line)
      expect(parsed.triggerType).toBe('tool_failure')
    }
  })

  test('runExperienceCapture is the engine-facing entry and never throws', () => {
    const root = fixtureRoot()
    const result = runExperienceCapture({ ...FAILURE_INPUT, cwd: root })
    expect(result.outcome).toBe('allowed')
    const file = path.join(root, EXPERIENCES_DIR_NAME, RAW_TRACES_FILE_NAME)
    expect(fs.existsSync(file)).toBe(true)
  })

  test('fails open when the ledger path is invalid', () => {
    // A NUL byte is invalid in paths on every platform — the sink must return
    // a result (fail-open), never throw.
    const badRoot = path.join(os.tmpdir(), 'exp-capture-nul', 'dev\u0000x')
    const result = runExperienceCapture({ ...FAILURE_INPUT, cwd: badRoot })
    expect(result.outcome).toBe('allowed')
    expect(typeof result.spawnError).toBe('string')
  })
})

describe('dedup key agreement (S1-C consumes S1-B output)', () => {
  test('the key over the stored record fields reproduces the group identity', () => {
    const record = buildExperienceRecord(FAILURE_INPUT)
    const key = experienceDedupKey(record.toolName, record.errorFirstLine)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
  })
})
