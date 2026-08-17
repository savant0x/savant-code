import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  classifyTone,
  reduceTrustMatrixEvents,
  statusLabel,
  summarizeTrustRows,
} from '../trust-matrix'

import type { PrintModeProvenanceReceipt } from '@savant-code/common/types/print-mode'
import type { TrustReceipt } from '@savant-code/common/types/provenance'

function receipt(seq = 1): TrustReceipt {
  return {
    schema: 'savant.provenance.receipt.v1',
    sessionId: 'sess-matrix',
    seq,
    status: 'complete',
    changeHash: `sha256:${'a'.repeat(64)}`,
    path: `src/${seq}.ts`,
    tool: 'write_file',
    fidId: 'FID-2026-0813-001',
    lawChecks: [],
    failClosed: false,
    writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
    timestamp: '2026-08-13T10:00:00.000Z',
    signatures: [
      { role: 'forge', over: `sha256:${'b'.repeat(64)}`, sig: 'sig' },
    ],
    verdicts: [],
  }
}

function event(
  overrides: Partial<PrintModeProvenanceReceipt> = {},
): PrintModeProvenanceReceipt {
  return {
    type: 'provenance_receipt',
    sessionId: 'sess-matrix',
    seq: 1,
    phase: 'audit',
    status: 'complete',
    signed: true,
    receipt: receipt(),
    verdictText: 'PASS — audit completed',
    ...overrides,
  }
}

describe('Trust Matrix fidelity (FID-2026-0813-009)', () => {
  test('real signed events render exactly one matching row per receipt sequence', () => {
    const state = reduceTrustMatrixEvents([
      event({ seq: 1, receipt: receipt(1) }),
      event({
        seq: 2,
        receipt: receipt(2),
        phase: 'adversarial',
        verdictText: 'REFUTED — verifier missed a replay vector',
      }),
    ])
    expect(state.dropped).toBe(0)
    expect(state.rows).toHaveLength(2)
    expect(state.rows.map((row) => row.seq)).toEqual([1, 2])
    expect(state.rows[0]?.tone).toBe('amber')
    expect(state.rows[1]?.tone).toBe('green')
    expect(state.rows[1]?.verdictText).toBe(
      'REFUTED — verifier missed a replay vector',
    )
  })

  test('synthetic, unsigned, and sequence-mismatched events render nothing', () => {
    const state = reduceTrustMatrixEvents([
      event({ signed: false }),
      event({ receipt: undefined }),
      event({ seq: 99 }),
      event({ receipt: { ...receipt(), seq: 77 } }),
    ])
    expect(state.rows).toEqual([])
    expect(state.dropped).toBe(4)
  })

  test('classification is conservative: unknown model prefixes stay neutral', () => {
    expect(classifyTone('audit', 'CONFIRMED — all checks hold')).toBe('amber')
    expect(classifyTone('adversarial', 'REFUTED — issue found')).toBe('green')
    expect(classifyTone('adversarial', 'ADJUSTED — issue corrected')).toBe(
      'green',
    )
    expect(classifyTone('adversarial', 'model output without a prefix')).toBe(
      'neutral',
    )
    expect(classifyTone('write', 'Signed write receipt')).toBe('neutral')
  })

  test('later signed events update the same sequence without duplicating rows', () => {
    const state = reduceTrustMatrixEvents([
      event({
        phase: 'write',
        status: 'pending',
        verdictText: 'Signed write receipt',
      }),
      event({ phase: 'audit', verdictText: 'PASS — verifier reviewed' }),
      event({
        phase: 'adversarial',
        verdictText: 'ADJUSTED — verifier correction accepted',
      }),
    ])
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]).toMatchObject({
      seq: 1,
      phase: 'adversarial',
      tone: 'green',
      verdictText: 'ADJUSTED — verifier correction accepted',
    })
  })
})

describe('Trust Matrix terminal status semantics (FID-2026-0814-005)', () => {
  test('statusLabel maps pending to signed and no_verdict to the terminal label', () => {
    expect(statusLabel('pending')).toBe('signed')
    expect(statusLabel('no_verdict')).toBe('no independent verdict')
    expect(statusLabel('complete')).toBe('complete')
    expect(statusLabel('superseded')).toBe('superseded')
  })

  test('a no_verdict close event renders as a terminal row with the system close annotation', () => {
    const closeReceipt: TrustReceipt = {
      ...receipt(),
      status: 'no_verdict',
      verdicts: [
        {
          phase: 'audit',
          agentType: 'system',
          agentId: 'session-close',
          verdictText:
            'No independent verdict — session closed without Verifier/Adversary verdicts',
          timestamp: '2026-08-14T00:00:00.000Z',
          over: `sha256:${'c'.repeat(64)}`,
          sig: 'sig-close',
        },
      ],
    }
    const state = reduceTrustMatrixEvents([
      event({
        phase: 'audit',
        status: 'no_verdict',
        receipt: closeReceipt,
        verdictText: closeReceipt.verdicts[0]?.verdictText,
      }),
    ])
    expect(state.dropped).toBe(0)
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]).toMatchObject({
      seq: 1,
      status: 'no_verdict',
      verdictText:
        'No independent verdict — session closed without Verifier/Adversary verdicts',
    })
    expect(state.rows[0]?.tone).toBe('neutral')
  })

  test('a live pending write row carries the awaiting-audit status', () => {
    const state = reduceTrustMatrixEvents([
      event({ phase: 'write', status: 'pending' }),
    ])
    expect(state.rows).toHaveLength(1)
    expect(state.rows[0]?.status).toBe('pending')
    expect(statusLabel(state.rows[0]!.status)).toBe('signed')
  })
})

describe('Trust Matrix reactive summary (operator feedback 2026-08-16)', () => {
  test('pending rows are active; terminal rows collapse into a resolved count', () => {
    const state = reduceTrustMatrixEvents([
      event({ seq: 1, phase: 'write', status: 'pending', receipt: receipt(1) }),
      event({
        seq: 2,
        phase: 'write',
        status: 'complete',
        receipt: receipt(2),
      }),
      event({
        seq: 3,
        phase: 'audit',
        status: 'no_verdict',
        receipt: receipt(3),
      }),
    ])
    const summary = summarizeTrustRows(state.rows)
    expect(summary.activeRows).toHaveLength(1)
    expect(summary.activeRows[0]?.status).toBe('pending')
    // no_verdict is tracked separately — it is NOT a verified "resolved".
    expect(summary.resolvedCount).toBe(1)
    expect(summary.noVerdictCount).toBe(1)
    expect(summary.hasPending).toBe(true)
    expect(summary.tone).toBe('amber')
  })

  test('all-resolved rows flip the tone to green and clear the live list', () => {
    const state = reduceTrustMatrixEvents([
      event({
        seq: 1,
        phase: 'write',
        status: 'complete',
        receipt: receipt(1),
      }),
      event({
        seq: 2,
        phase: 'write',
        status: 'superseded',
        receipt: receipt(2),
      }),
    ])
    const summary = summarizeTrustRows(state.rows)
    expect(summary.activeRows).toHaveLength(0)
    expect(summary.resolvedCount).toBe(2)
    expect(summary.noVerdictCount).toBe(0)
    expect(summary.hasPending).toBe(false)
    expect(summary.tone).toBe('green')
  })

  test('an empty row set is neutral (no signal)', () => {
    const summary = summarizeTrustRows([])
    expect(summary.activeRows).toHaveLength(0)
    expect(summary.resolvedCount).toBe(0)
    expect(summary.noVerdictCount).toBe(0)
    expect(summary.hasPending).toBe(false)
    expect(summary.tone).toBe('neutral')
  })

  test('all no_verdict rows stay neutral — a closed-without-verdict session is not verified', () => {
    const state = reduceTrustMatrixEvents([
      event({
        seq: 1,
        phase: 'audit',
        status: 'no_verdict',
        receipt: receipt(1),
      }),
      event({
        seq: 2,
        phase: 'audit',
        status: 'no_verdict',
        receipt: receipt(2),
      }),
    ])
    const summary = summarizeTrustRows(state.rows)
    expect(summary.activeRows).toHaveLength(0)
    expect(summary.resolvedCount).toBe(0)
    expect(summary.noVerdictCount).toBe(2)
    expect(summary.hasPending).toBe(false)
    expect(summary.tone).toBe('neutral')
  })
})

describe('Trust Matrix zero-control audit (FID-2026-0813-010)', () => {
  test('display module has no tool, write, terminal, emit, or dynamic-import path', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../trust-matrix.tsx'),
      'utf8',
    )
    expect(source).not.toContain('tool-executor')
    expect(source).not.toContain('executeToolCall')
    expect(source).not.toContain('run_terminal_command')
    expect(source).not.toContain('write_file')
    expect(source).not.toContain('onResponseChunk')
    expect(source).not.toContain('import(')
    expect(source).not.toContain('onClick')
  })

  test('reducer is a pure data function with no control callbacks', () => {
    expect(reduceTrustMatrixEvents.length).toBe(1)
    expect(reduceTrustMatrixEvents([event()]).rows).toHaveLength(1)
  })

  test('empty-state renders a placeholder, never a blank panel (FID-2026-0813-023)', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../trust-matrix.tsx'),
      'utf8',
    )
    // The old early-return hid the dropped-event disclosure; the placeholder
    // must replace it and the disclosure must remain reachable.
    expect(source).not.toContain('if (state.rows.length === 0) return null')
    expect(source).toContain('No signed provenance events yet')
    expect(source).toContain('unsigned/unmatched event(s) hidden')
  })
})
