import fs from 'node:fs'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../../../../state/chat-store'
import { reduceTrustMatrixEvents } from '../trust-matrix'

import type { PrintModeProvenanceReceipt } from '@savant-code/common/types/print-mode'
import type { TrustReceipt } from '@savant-code/common/types/provenance'

function receipt(seq: number): TrustReceipt {
  return {
    schema: 'savant.provenance.receipt.v1',
    sessionId: 'sess-matrix-live',
    seq,
    status: 'complete',
    changeHash: `sha256:${'a'.repeat(64)}`,
    path: `src/live-${seq}.ts`,
    tool: 'write_file',
    fidId: 'FID-2026-0814-001',
    lawChecks: [],
    failClosed: false,
    writer: { agentId: 'forge-1', agentType: 'forge', phase: 'green' },
    timestamp: '2026-08-14T00:00:00.000Z',
    signatures: [
      { role: 'forge', over: `sha256:${'b'.repeat(64)}`, sig: 'sig' },
    ],
    verdicts: [],
  }
}

function event(seq: number): PrintModeProvenanceReceipt {
  return {
    type: 'provenance_receipt',
    sessionId: 'sess-matrix-live',
    seq,
    phase: 'write',
    status: 'complete',
    signed: true,
    receipt: receipt(seq),
    verdictText: 'Signed write receipt',
  }
}

afterEach(() => {
  useChatStore.getState().resetSidebarData()
})

describe('Trust Matrix live update path (FID-2026-0814-001)', () => {
  test('signed events stream through the store into matrix rows (closes V024-P3-3 headlessly)', () => {
    expect(useChatStore.getState().provenanceEvents).toHaveLength(0)
    expect(
      reduceTrustMatrixEvents(useChatStore.getState().provenanceEvents).rows,
    ).toHaveLength(0)

    // Simulate one `provenance_receipt` arriving from the runtime write path
    // (native.ts emits it post-write via onResponseChunk; the CLI event
    // handler calls addProvenanceEvent). The store append is the first hop of
    // the live panel: emit → store → reducer → rows.
    useChatStore.getState().addProvenanceEvent(event(1))
    expect(useChatStore.getState().provenanceEvents).toHaveLength(1)

    useChatStore.getState().addProvenanceEvent(event(2))
    const events = useChatStore.getState().provenanceEvents
    expect(events).toHaveLength(2)
    const state = reduceTrustMatrixEvents(events)
    expect(state.rows).toHaveLength(2)
    expect(state.rows.map((row) => row.seq)).toEqual([1, 2])
    expect(state.dropped).toBe(0)
  })

  test('the panel renders a live session count so a static panel is legible', () => {
    const source = fs.readFileSync(
      path.join(import.meta.dir, '../trust-matrix.tsx'),
      'utf8',
    )
    // The footer appears in both the empty and populated states; it updates
    // reactively as receipts stream, so "0 signed events" is a live signal
    // (no writes yet), never a frozen panel.
    expect(source).toContain('signed event(s) this session')
  })
})
