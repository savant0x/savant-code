import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
  appendCompactionInventory,
  buildCompactionModelNotice,
  describeRemovedToolItem,
  diffRemovedSpans,
  inventoryFilePath,
} from '../evidence/inventory'

describe('compaction inventory ledger (FID-2026-0824-027)', () => {
  test('appendCompactionInventory writes parseable JSONL rows', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'inventory-'))

    const ok = await appendCompactionInventory({
      projectRoot: root,
      runId: 'r1',
      layer: 'micro',
      removedMessages: 0,
      tokensSaved: 850,
      percentUsed: 42,
    })

    expect(ok).toBe(true)
    const text = await readFile(inventoryFilePath(root, 'r1'), 'utf8')
    const row = JSON.parse(text.trim()) as Record<string, unknown>
    expect(row.kind).toBe('compaction')
    expect(row.layer).toBe('micro')
    expect(row.tokensSaved).toBe(850)
    expect(row.percentUsed).toBe(42)
  })

  test('empty projectRoot fails open without writing', async () => {
    const ok = await appendCompactionInventory({
      projectRoot: '',
      runId: 'r1',
      layer: 'auto',
      removedMessages: 3,
      tokensSaved: 100,
    })

    expect(ok).toBe(false)
  })

  test('model notice is a bounded fixed-template string per layer', () => {
    for (const layer of ['micro', 'auto', 'reactive'] as const) {
      const notice = buildCompactionModelNotice(layer)

      expect(notice).toContain(`layer="${layer}"`)
      expect(notice.length).toBeLessThan(200)
    }
  })

  test('diffRemovedSpans derives regions + bounded tool items by identity (FID-2026-0824-025/-027 amendment)', () => {
    const keptA = { role: 'user', content: 'a' }
    const removedTool = {
      role: 'tool',
      toolName: 'read_files',
      toolCallId: 'tc1',
      content: [],
    }
    const keptB = { role: 'assistant', content: 'b' }
    const removedUser = { role: 'user', content: 'gone' }
    const prev = [keptA, removedTool, keptB, removedUser]
    const next = [keptA, keptB]

    const diff = diffRemovedSpans({
      prev,
      next,
      describeItem: describeRemovedToolItem,
    })

    expect(diff.regions).toEqual([
      { start: 1, end: 2 },
      { start: 3, end: 4 },
    ])
    expect(diff.items).toEqual([
      {
        toolCallId: 'tc1',
        toolName: 'read_files',
        byteSize: expect.any(Number),
      },
    ])
  })

  test('inventory rows omit empty region/item arrays', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'inventory-'))
    const ok = await appendCompactionInventory({
      projectRoot: root,
      runId: 'r2',
      layer: 'reactive',
      removedMessages: 1,
      tokensSaved: 50,
      regions: [],
      items: [],
    })

    expect(ok).toBe(true)
    const text = await readFile(inventoryFilePath(root, 'r2'), 'utf8')
    const row = JSON.parse(text.trim()) as Record<string, unknown>
    expect(row.regions).toBeUndefined()
    expect(row.items).toBeUndefined()
  })
})
