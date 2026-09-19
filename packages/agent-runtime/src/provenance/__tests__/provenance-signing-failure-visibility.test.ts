/**
 * FID-2026-0919-012 (SEC-5) — record-mode signing failures must be LOUD.
 *
 * In `record` mode a receipt-signing failure leaves an UNAUDITED write:
 * the write proceeds, no receipt exists, and previously only a console.warn
 * fired — invisible to the parent and the observability stream. Pinned here:
 *
 *   1. record mode: failure emits a `signing_failed` ProvenanceEvent with
 *      the subject path and error text (parent-visible channel).
 *   2. record mode: the session's `unauditedWriteCount` increments.
 *   3. record mode: the write still proceeds (returns null) — best-effort
 *      availability unchanged.
 *   4. enforce mode: failure THROWS (fail-closed unchanged) and emits no
 *      signing_failed event.
 *
 * Failure is induced deterministically by stubbing the crypto module's
 * signPayload (dependency injection at the module boundary, consistent with
 * the repo's prefer-DI-over-module-mocking convention — here the ESM import
 * inside @savant-code/common/crypto is intercepted via bun's module mock).
 */
import { describe, expect, mock, test } from 'bun:test'

import { ProvenanceSession } from '..'
import { makeTempProject } from './provenance-test-harness'

import type { ProvenanceEvent } from '@savant-code/common/types/provenance'

const signPayloadMock = mock(() => {
  throw new Error('HSM offline (simulated)')
})

mock.module('@savant-code/common/crypto', () => {
  const actual = require('@savant-code/common/crypto') as Record<string, unknown>
  return { ...actual, signPayload: signPayloadMock }
})

function collectEvents(session: ProvenanceSession): ProvenanceEvent[] {
  const events: ProvenanceEvent[] = []
  session.onEvent((event) => events.push(event))
  return events
}

function writeParams(root: string) {
  return {
    path: `${root}/src/v.ts`,
    tool: 'write_file' as const,
    content: 'export const v = 1\n',
    writerAgentId: 'forge-1',
    writerAgentType: 'forge',
    fsmPhase: 'green',
    fidId: null,
    lawChecks: [{ law: 1, outcome: 'passed' as const }],
  }
}

describe('signing-failure visibility (FID-2026-0919-012)', () => {
  test('record mode: emits signing_failed event + counts the unaudited write, returns null', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_record_fail',
      mode: 'record',
      projectRoot: root,
    })
    const events = collectEvents(session)
    const receipt = await session.recordWriteReceipt(writeParams(root))
    expect(receipt).toBeNull()
    const failure = events.find((event) => event.type === 'signing_failed')
    expect(failure).toBeDefined()
    if (failure?.type === 'signing_failed') {
      expect(failure.subject).toContain('v.ts')
      expect(failure.error).toContain('HSM offline')
    }
    expect(session.unauditedWriteCount).toBe(1)
  })

  test('enforce mode: still throws, emits no signing_failed event', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_enforce_fail',
      mode: 'enforce',
      projectRoot: root,
    })
    const events = collectEvents(session)
    await expect(
      session.recordWriteReceipt(writeParams(root)),
    ).rejects.toThrow('HSM offline')
    expect(events.find((event) => event.type === 'signing_failed')).toBe(
      undefined,
    )
    expect(session.unauditedWriteCount).toBe(0)
  })
})
