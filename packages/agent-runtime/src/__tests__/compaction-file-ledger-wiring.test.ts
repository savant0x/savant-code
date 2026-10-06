import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import { MAX_CUMULATIVE_TRACKED_PATHS } from '../context-compactor/state'
import { foldFileOperations } from '../run-agent-step/compaction-plan'

import type { JSONValue } from '@savant-code/common/types/json'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'

/**
 * FID-2026-1006-003 WP2: the cumulative file ledger must be maintained across
 * compactions and reach the pruner. These tests assert the CALLER (the step
 * boundary folds, the spawn boundary forwards) and the fold's own guarantees,
 * so removing the wiring fails here instead of only leaving file tracking
 * inert.
 */
const repoRoot = path.resolve(import.meta.dir, '..', '..', '..', '..')

function source(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

const call = (toolName: string, input: Record<string, JSONValue>): Message => ({
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId: 'c1', toolName, input }],
})

describe('compaction file ledger wiring (FID-2026-1006-003 WP2)', () => {
  test('the step boundary folds the ledger and the spawn boundary forwards it', () => {
    expect(
      source('packages/agent-runtime/src/run-agent-step/context-tokens.ts'),
    ).toContain('foldFileOperations(')
    expect(
      source(
        'packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts',
      ),
    ).toContain('fileLedger: parentAgentState.compactionFileLedger')
    // The embedded pruner consumes the ledger as data (it cannot import us).
    expect(source('agents/context-pruner/summarization-context.ts')).toContain(
      'spawnParams.fileLedger',
    )
    expect(source('agents/context-pruner/summary-assembly.ts')).toContain(
      'fileLedger.readFiles',
    )
  })

  test('a window folds its own file operations by kind', () => {
    const messages = [
      call('read_files', { paths: ['a.ts', 'b.ts'] }),
      call('write_file', { path: 'c.ts' }),
      call('str_replace', { path: 'd.ts' }),
    ]
    const folded = foldFileOperations({ messages, watermark: 0 })

    expect(folded.ledger.readFiles).toEqual(['a.ts', 'b.ts'])
    expect(folded.ledger.createdFiles).toEqual(['c.ts'])
    expect(folded.ledger.modifiedFiles).toEqual(['d.ts'])
    expect(folded.watermark).toBe(3)
  })

  test('the fold is incremental — a re-read never double-counts a window', () => {
    const first = call('read_files', { paths: ['a.ts'] })
    const second = call('read_files', { paths: ['b.ts'] })
    const afterFirst = foldFileOperations({ messages: [first], watermark: 0 })
    const afterSecond = foldFileOperations({
      ledger: afterFirst.ledger,
      messages: [first, second],
      watermark: afterFirst.watermark,
    })

    // The newest window's entries lead, so the recency cap drops old paths.
    expect(afterSecond.ledger.readFiles).toEqual(['b.ts', 'a.ts'])
  })

  test('the ledger is capped so it cannot defeat its own compaction', () => {
    const paths = Array.from(
      { length: MAX_CUMULATIVE_TRACKED_PATHS + 10 },
      (_, index) => `f${index}.ts`,
    )
    const folded = foldFileOperations({
      messages: [call('read_files', { paths })],
      watermark: 0,
    })

    expect(folded.ledger.readFiles).toHaveLength(MAX_CUMULATIVE_TRACKED_PATHS)
  })
})
