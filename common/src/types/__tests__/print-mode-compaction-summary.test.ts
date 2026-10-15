import { describe, expect, test } from 'bun:test'

import {
  printModeCompactionSummarySchema,
  printModeEventSchema,
} from '../print-mode'

/**
 * FID-2026-0828-001: the `compaction_summary` PrintModeEvent schema. The
 * runtime emits it once per real context-pruner compaction (removedMessages
 * > 0) at the spawn boundary; the CLI renders it as a TrafficLightPanel
 * transcript block. Unknown-event consumers ignore it (backward compatible).
 */
describe('printModeCompactionSummarySchema (FID-2026-0828-001)', () => {
  test('parses a full event with all metrics', () => {
    const parsed = printModeCompactionSummarySchema.parse({
      type: 'compaction_summary',
      summary: 'Summary of the conversation so far. Decisions: A, B.',
      removedMessages: 12,
      tokensSaved: 45000,
      percentUsed: 3,
    })
    expect(parsed.type).toBe('compaction_summary')
    expect(parsed.summary).toContain('Summary of the conversation')
    expect(parsed.removedMessages).toBe(12)
    expect(parsed.tokensSaved).toBe(45000)
    expect(parsed.percentUsed).toBe(3)
  })

  test('tokensSaved and percentUsed are optional', () => {
    const parsed = printModeCompactionSummarySchema.parse({
      type: 'compaction_summary',
      summary: 'Minimal summary.',
      removedMessages: 1,
    })
    expect(parsed.tokensSaved).toBeUndefined()
    expect(parsed.percentUsed).toBeUndefined()
  })

  test('rejects an empty summary', () => {
    expect(() =>
      printModeCompactionSummarySchema.parse({
        type: 'compaction_summary',
        summary: '',
        removedMessages: 1,
      }),
    ).toThrow()
  })

  test('rejects a negative removedMessages', () => {
    expect(() =>
      printModeCompactionSummarySchema.parse({
        type: 'compaction_summary',
        summary: 's',
        removedMessages: -1,
      }),
    ).toThrow()
  })

  test('rejects a non-integer removedMessages', () => {
    expect(() =>
      printModeCompactionSummarySchema.parse({
        type: 'compaction_summary',
        summary: 's',
        removedMessages: 1.5,
      }),
    ).toThrow()
  })

  test('the enclosing PrintModeEvent union accepts the new event type', () => {
    const event = printModeEventSchema.parse({
      type: 'compaction_summary',
      summary: 'Union membership check.',
      removedMessages: 2,
    })
    expect(event.type).toBe('compaction_summary')
  })
})
