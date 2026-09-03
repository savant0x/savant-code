import { describe, expect, test } from 'bun:test'

import type { ContentBlock } from '../../types/chat'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

// Import the handler directly; it only needs the updater/logger parts of
// EventHandlerState, provided inline below.
const { handleCompactionSummary } = await import('../sdk-event-handlers/misc')

/**
 * FID-2026-0828-001: the `compaction_summary` PrintModeEvent becomes a
 * dedicated transcript block via the message updater — the same append
 * pattern as the compliance receipt, never blocking the stream.
 */
describe('handleCompactionSummary (FID-2026-0828-001)', () => {
  const buildState = () => {
    const updaterFns: Array<(blocks: ContentBlock[]) => ContentBlock[]> = []
    return {
      state: {
        logger: { info: () => {}, warn: () => {}, error: () => {} },
        message: {
          updater: {
            updateAiMessageBlocks: (
              fn: (blocks: ContentBlock[]) => ContentBlock[],
            ) => {
              updaterFns.push(fn)
            },
          },
        },
      },
      updaterFns,
    } as unknown as {
      state: Parameters<typeof handleCompactionSummary>[0]
      updaterFns: Array<(blocks: ContentBlock[]) => ContentBlock[]>
    }
  }

  const summaryEvent = {
    type: 'compaction_summary',
    summary:
      'Compaction summary: listed files; enabled the flag; tests passed.',
    removedMessages: 9,
    tokensSaved: 32000,
    percentUsed: 2.5,
  } as Extract<PrintModeEvent, { type: 'compaction_summary' }>

  test('appends exactly one compaction-summary block with all metrics', () => {
    const { state, updaterFns } = buildState()

    handleCompactionSummary(state, summaryEvent)

    expect(updaterFns.length).toBe(1)
    const blocks = updaterFns[0]([{ type: 'text', content: 'earlier text' }])
    expect(blocks.length).toBe(2)
    const appended = blocks[1]
    expect(appended.type).toBe('compaction-summary')
    expect(appended).toMatchObject({
      type: 'compaction-summary',
      summary: summaryEvent.summary,
      removedMessages: 9,
      tokensSaved: 32000,
      percentUsed: 2.5,
    })
  })

  test('omits optional metrics the event did not carry', () => {
    const { state, updaterFns } = buildState()

    handleCompactionSummary(state, {
      ...summaryEvent,
      tokensSaved: undefined,
      percentUsed: undefined,
    })

    const blocks = updaterFns[0]([])
    const appended = blocks[0] as { type: string; tokensSaved?: number }
    expect(appended.type).toBe('compaction-summary')
    expect(appended.tokensSaved).toBeUndefined()
    expect('percentUsed' in appended).toBe(false)
  })
})
