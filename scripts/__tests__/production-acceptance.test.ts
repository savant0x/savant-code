import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import {
  ACCEPTANCE_DIR,
  UI_SURFACES,
  acceptanceTemplate,
  collectAcceptanceIssues,
  validateAcceptanceRecord,
} from '../production-acceptance'

/**
 * FID-2026-1016-016 (LF-005): acceptance is run-bound, per-surface, and never
 * inherits the agent's tool success.
 */

const directories: string[] = []

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-'))
  directories.push(root)
  fs.mkdirSync(path.join(root, ACCEPTANCE_DIR), { recursive: true })
  fs.mkdirSync(path.join(root, 'dev', 'experiences'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'dev', 'experiences', 'raw-traces.jsonl'),
    '{"sessionId":"run-2026-10-17-a","toolName":"run_terminal_command"}\n',
    'utf8',
  )
  fs.mkdirSync(path.join(root, 'cli', 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'cli', 'src', 'render.test.tsx'),
    'export {}\n',
    'utf8',
  )
  return root
}

function record(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    runId: 'run-2026-10-17-a',
    recordedAt: '2026-10-17T00:00:00.000Z',
    sessionId: 'run-2026-10-17-a',
    callLedger: 'dev/experiences/raw-traces.jsonl',
    surfaces: UI_SURFACES.map((surface) => ({
      surface,
      outcome: 'observed',
      observation: `the operator saw ${surface} behave`,
      evidence: 'run:run-2026-10-17-a',
    })),
    modelObservations: ['the agent reported the command exited 0'],
    operatorUiChecks: ['the operator watched the transcript'],
    automatedRegression: ['cli/src/render.test.tsx'],
    fallbackSteps: [],
    ...overrides,
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe('production acceptance (LF-005)', () => {
  test('a complete record passes, and one file per run is required', () => {
    const root = fixture()
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', record()),
    ).toEqual([])
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-18-b.json', record()),
    ).toEqual([
      "run-2026-10-18-b.json: runId 'run-2026-10-17-a' does not match the record file name",
    ])
  })

  test('every UI surface needs its own outcome, not an aggregate claim', () => {
    const root = fixture()
    const value = record({
      surfaces: UI_SURFACES.filter((surface) => surface !== 'folding').map(
        (surface) => ({
          surface,
          outcome: 'observed',
          observation: 'seen',
          evidence: 'run:run-2026-10-17-a',
        }),
      ),
    })
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', value),
    ).toEqual([
      "run-2026-10-17-a: surface 'folding' has 0 outcomes; each surface needs exactly one",
    ])
  })

  test('an observed surface needs its observation and resolvable evidence', () => {
    const root = fixture()
    const value = record({
      surfaces: UI_SURFACES.map((surface) =>
        surface === 'resize'
          ? { surface, outcome: 'observed', observation: 'looked fine' }
          : {
              surface,
              outcome: 'observed',
              observation: 'seen',
              evidence: 'run:run-2026-10-17-a',
            },
      ),
    })
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', value),
    ).toEqual(["run-2026-10-17-a: 'resize' claims observed with no evidence"])

    const dangling = record({
      surfaces: UI_SURFACES.map((surface) =>
        surface === 'copy-export'
          ? {
              surface,
              outcome: 'regressed',
              observation: 'exports lost the last row',
              evidence: 'dev/evidence/missing.png',
            }
          : {
              surface,
              outcome: 'observed',
              observation: 'seen',
              evidence: 'run:run-2026-10-17-a',
            },
      ),
    })
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', dangling),
    ).toEqual([
      "run-2026-10-17-a: 'copy-export' evidence 'dev/evidence/missing.png' does not resolve inside the repository",
    ])
  })

  test('an unverified surface may not carry an acceptance claim', () => {
    const root = fixture()
    const value = record({
      surfaces: UI_SURFACES.map((surface) =>
        surface === 'input-responsiveness'
          ? {
              surface,
              outcome: 'unverified',
              observation: 'probably fine',
            }
          : {
              surface,
              outcome: 'unverified',
            },
      ),
      operatorUiChecks: [],
    })
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', value),
    ).toEqual([
      "run-2026-10-17-a: 'input-responsiveness' is unverified but carries an acceptance claim",
    ])
  })

  test('tool success does not stand in for a native observation', () => {
    const root = fixture()
    const value = record({
      operatorUiChecks: [],
      modelObservations: ['the agent reported success'],
    })
    expect(
      validateAcceptanceRecord(root, 'run-2026-10-17-a.json', value),
    ).toEqual([
      'run-2026-10-17-a: 5 surface(s) claim acceptance with no operator/native check — model observations are not acceptance',
    ])
  })

  test('the record binds the run to the ledger that holds its failures and fallbacks', () => {
    const root = fixture()
    expect(
      validateAcceptanceRecord(
        root,
        'run-2026-10-17-a.json',
        record({ sessionId: 'some-other-session' }),
      ),
    ).toEqual([
      "run-2026-10-17-a: session 'some-other-session' does not appear in dev/experiences/raw-traces.jsonl",
    ])
    expect(
      validateAcceptanceRecord(
        root,
        'run-2026-10-17-a.json',
        record({ callLedger: '../outside.jsonl' }),
      ),
    ).toEqual([
      "run-2026-10-17-a: call ledger '../outside.jsonl' does not resolve inside the repository",
    ])
  })

  test('automated regression entries must name a test file that exists', () => {
    const root = fixture()
    expect(
      validateAcceptanceRecord(
        root,
        'run-2026-10-17-a.json',
        record({ automatedRegression: ['cli/src/gone.test.tsx'] }),
      ),
    ).toEqual([
      "run-2026-10-17-a: automated regression test 'cli/src/gone.test.tsx' does not exist",
    ])
    expect(
      validateAcceptanceRecord(
        root,
        'run-2026-10-17-a.json',
        record({ automatedRegression: ['manual click-through'] }),
      ),
    ).toEqual([
      "run-2026-10-17-a: automated regression 'manual click-through' names no test file",
    ])
  })

  test('the collector treats a missing directory as lawful and malformed records as not', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-empty-'))
    directories.push(empty)
    expect(collectAcceptanceIssues(empty)).toEqual([])

    const root = fixture()
    fs.writeFileSync(
      path.join(root, ACCEPTANCE_DIR, 'run-2026-10-17-a.json'),
      '{ not json',
      'utf8',
    )
    expect(collectAcceptanceIssues(root)).toEqual([
      'run-2026-10-17-a.json: acceptance record is not readable JSON',
    ])
    fs.writeFileSync(
      path.join(root, ACCEPTANCE_DIR, 'run-2026-10-17-a.json'),
      JSON.stringify(record()),
      'utf8',
    )
    expect(collectAcceptanceIssues(root)).toEqual([])
  })

  test('the template claims nothing: every surface starts unverified', () => {
    const template = JSON.parse(acceptanceTemplate('run-2026-10-17-a', ''))
    expect(template.surfaces).toHaveLength(UI_SURFACES.length)
    expect(
      template.surfaces.every(
        (surface: { outcome: string }) => surface.outcome === 'unverified',
      ),
    ).toBe(true)
    expect(template.operatorUiChecks).toEqual([])
  })
})
