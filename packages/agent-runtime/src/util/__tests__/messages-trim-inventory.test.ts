// FID-2026-1007-004 step 4 — the trim pass is the one destructive path with no
// ledger entry. Layers 2-4 write an inventory row; this pass deleted whole
// conversation turns and wrote nothing. These pins drive the SHIPPED trim pass
// and read the row back off disk.
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  assistantMessage,
  jsonToolResult,
  userMessage,
} from '@savant-code/common/util/messages'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test'

import { inventoryFilePath } from '../../evidence/inventory'
import { trimMessagesToFitTokenLimit } from '../messages'
import * as tokenCounter from '../token-counter'

import type { CompactionInventoryRecord } from '../../evidence/inventory'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

const logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

/** The write is fire-and-forget; poll the file rather than guess a delay. */
async function readRows(file: string): Promise<CompactionInventoryRecord[]> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const text = await readFile(file, 'utf8')
      return text
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as CompactionInventoryRecord)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  return []
}

describe('the trim pass writes the row the other compaction layers write', () => {
  beforeEach(() => {
    spyOn(tokenCounter, 'countTokensJson').mockImplementation((text) => {
      return JSON.stringify(text).length
    })
  })

  afterEach(() => {
    mock.restore()
  })

  /**
   * Oldest two first, and small: the pass drops from the oldest end and stops
   * as soon as it has taken enough, so a big message in slot 0 would stop the
   * run before the tool result — which is the entry this file is about.
   */
  function overBudgetHistory(): Message[] {
    return [
      userMessage('tiny'),
      {
        role: 'tool',
        toolName: 'code_search',
        toolCallId: 'call-trim-1',
        content: jsonToolResult('match'.repeat(500)),
      },
      assistantMessage('C'.repeat(2_000)),
      userMessage('D'.repeat(2_000)),
    ]
  }

  it('names the dropped tool result in a layer:"trim" row', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'trim-inventory-'))

    trimMessagesToFitTokenLimit({
      messages: overBudgetHistory(),
      systemTokens: 0,
      maxTotalTokens: 200,
      logger,
      inventory: { projectRoot: root, runId: 'run-trim' },
    })

    const rows = await readRows(inventoryFilePath(root, 'run-trim'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.layer).toBe('trim')
    expect(rows[0]?.removedMessages).toBeGreaterThan(0)
    expect(rows[0]?.items?.map((item) => item.toolCallId)).toContain(
      'call-trim-1',
    )
    expect(rows[0]?.regions?.length).toBeGreaterThan(0)
  })

  it('writes nothing at all when it was never told where the ledger lives', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'trim-inventory-none-'))

    trimMessagesToFitTokenLimit({
      messages: overBudgetHistory(),
      systemTokens: 0,
      maxTotalTokens: 200,
      logger,
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await readRows(inventoryFilePath(root, 'run-trim'))).toEqual([])
  })

  it('returns an under-budget history by reference and takes nothing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'trim-inventory-idle-'))
    const messages = overBudgetHistory()

    const result = trimMessagesToFitTokenLimit({
      messages,
      systemTokens: 0,
      maxTotalTokens: 10_000_000,
      logger,
      inventory: { projectRoot: root, runId: 'run-trim' },
    })

    expect(result).toBe(messages)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(await readRows(inventoryFilePath(root, 'run-trim'))).toEqual([])
  })
})
