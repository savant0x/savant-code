import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { classifyReceipts, ProvenanceSession } from '..'
import { makeTempProject } from './provenance-test-harness'

import type { TrustReceipt } from './provenance-test-harness'

describe('Export-time classification (master D6)', () => {
  test('live vs superseded by content-hash recomputation; ledger never mutated', async () => {
    const root = makeTempProject()
    const session = new ProvenanceSession({
      sessionId: 'sess_class',
      mode: 'record',
      projectRoot: root,
    })
    const target = path.join(root, 'src', 'c.ts')
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, 'export const c = 10\n', 'utf8')
    const receipt = (await session.recordWriteReceipt({
      path: target,
      tool: 'write_file',
      content: 'export const c = 10\n',
      writerAgentId: 'forge-1',
      writerAgentType: 'forge',
      fsmPhase: 'green',
      fidId: null,
      lawChecks: [],
    })) as TrustReceipt
    await session.finalize()
    const ledgerDir = path.join(root, '.savant', 'provenance', 'sess_class')
    const before = fs.readFileSync(
      path.join(ledgerDir, 'receipts.jsonl'),
      'utf8',
    )

    const live = classifyReceipts([receipt], root)
    expect(live.get(receipt.seq)).toBe('live')

    // Manual edit → superseded (content hash no longer matches).
    fs.writeFileSync(target, 'export const c = 11\n', 'utf8')
    const superseded = classifyReceipts([receipt], root)
    expect(superseded.get(receipt.seq)).toBe('superseded')

    // The ledger was not touched by classification.
    expect(
      fs.readFileSync(path.join(ledgerDir, 'receipts.jsonl'), 'utf8'),
    ).toBe(before)
  })
})
