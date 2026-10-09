import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { complianceEventSchema } from '@savant-code/common/types/telemetry'
import { afterEach, describe, expect, test } from 'bun:test'

import { recordLawBlock } from '../enforcement/escalation'
import { creditVerificationRun } from '../enforcement/verification-credit'
import { createEnforcementState } from '../enforcement-state'
import { runPreWriteGates } from '../pre-write-gates'
import {
  enforcementForCheckpoint,
  groundedAgentState,
} from './worktree-reconcile-fixtures'

import type { ComplianceEvent } from '@savant-code/common/types/telemetry'

/**
 * FID-2026-1007-012 FID 2 — emission end-to-end: every structured
 * enforcement observation appends exactly one line, at exactly one site,
 * and silence is the default without an explicit sink root (so the
 * pre-existing suites, which pass no root, cannot pollute the tree).
 */
const tempRoots: string[] = []
const identity = {
  model: 'resolved-model',
  provider: 'fixture',
  sessionId: 'run-1',
  agentRole: 'forge',
}
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

function fixtureRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compliance-emit-'))
  tempRoots.push(root)
  return root
}

function readEvents(root: string): ComplianceEvent[] {
  const file = path.join(root, 'dev', 'telemetry', 'compliance.jsonl')
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => complianceEventSchema.parse(JSON.parse(line)))
}

describe('compliance emission (FID-2026-1007-012 FID 2)', () => {
  test('a Law-1 block emits exactly one rejected pre-write line', () => {
    const root = fixtureRoot()
    const target = path.join(root, 'target.ts')
    fs.writeFileSync(target, 'export const x = 1\n', 'utf8')
    const state = createEnforcementState()
    state.telemetryRootDir = root
    state.telemetryIdentity = identity
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: target },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    const events = readEvents(root)
    expect(events).toHaveLength(1)
    expect(events[0]!).toMatchObject({
      lawId: 1,
      violationClass: 'rejected',
      gateLayer: 'pre-write',
      ...identity,
    })
  })

  test('escalation strikes emit in order with counts', () => {
    const root = fixtureRoot()
    const state = createEnforcementState()
    state.telemetryRootDir = root
    state.telemetryIdentity = identity
    for (let i = 0; i < 3; i++) {
      const result = recordLawBlock({
        state,
        law: 3,
        toolName: 'write_file',
        targetPath: 'a.ts',
        reason: 'Law 3: blocked',
        agentId: 'forge',
      })
      expect(result.blocked).toBe(true)
    }
    const events = readEvents(root)
    expect(events).toHaveLength(3)
    expect(
      events.map((event) => (event as { strikeCount: number }).strikeCount),
    ).toEqual([1, 2, 3])
    for (const event of events) {
      expect(event).toMatchObject({
        lawId: 3,
        violationClass: 'rejected',
        gateLayer: 'escalation',
        ...identity,
      })
    }
  })

  test('a turn-end Law-4 block emits exactly one rejected turn-end line', () => {
    const root = fixtureRoot()
    const agentState = groundedAgentState()
    const checkpoint = agentState.groundingCheckpoint
    if (checkpoint === undefined) throw new Error('test setup: no checkpoint')
    checkpoint.worktreeBaselineRoot = root
    const enf = enforcementForCheckpoint(checkpoint, 'hybrid')
    enf.state.telemetryIdentity = identity
    enf.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/feature.ts' },
      result: {},
      writtenContent: 'export const helper = 1\n',
      writeSucceeded: true,
    })
    expect(enf.evaluateTurnEnd().blocked).toBe(true)
    // One line per structured observation — the Law-4 block, its warning,
    // and the two Law-15 advisories (reconcile diagnostic + unverified
    // dirt). A block and its warning are distinct observations, never a
    // double-report of one violation.
    const events = readEvents(root)
    for (const event of events) expect(event).toMatchObject(identity)
    expect(
      events.map((e) => `${e.lawId}/${e.violationClass}/${e.gateLayer}`),
    ).toEqual([
      '15/flagged/turn-end',
      '4/rejected/turn-end',
      '4/flagged/turn-end',
      '15/flagged/turn-end',
    ])
  })

  test('no sink root means silence (existing suites pass no root)', () => {
    const root = fixtureRoot()
    const target = path.join(root, 'target.ts')
    fs.writeFileSync(target, 'export const x = 1\n', 'utf8')
    const state = createEnforcementState()
    const result = runPreWriteGates({
      toolName: 'write_file',
      input: { path: target },
      agentId: 'savant',
      state,
      mode: 'hybrid',
      tier: 'core_4',
    })
    expect(result.blocked).toBe(true)
    expect(fs.existsSync(path.join(root, 'dev', 'telemetry'))).toBe(false)
  })

  test('receipt warnings preserve resolved identity without error payloads', () => {
    const root = fixtureRoot()
    const state = createEnforcementState()
    state.telemetryRootDir = root
    state.telemetryIdentity = identity
    creditVerificationRun({
      toolName: 'run_terminal_command',
      input: { command: 'bun test' },
      state,
      warnings: [],
    })
    const events = readEvents(root)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      ...identity,
      lawId: 3,
      gateLayer: 'receipt',
    })
    expect(events[0]).not.toHaveProperty('message')
  })
})
