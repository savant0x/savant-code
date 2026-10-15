// FID-2026-1013-013 W4-1: a `tool_call` carries `agentId` (the invoking agent)
// and `parentAgentId` (the delegating one), but the Desktop block dropped both,
// so a Detective's `code_search` rendered identically to a root Savant call.
// The reducer now stamps both ids and resolves a display label from the
// `subagent_start`-activated roster row; ToolCard badges it.
//
// Sibling suites live in transcript-store.test.ts — split out for the 300-line
// ceiling (same convention as transcript-store-awaiting-output.test.ts).

import { describe, expect, test } from 'bun:test'

import { applyEventBatch, initialTranscriptState } from '../transcript-store'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

const DETECTIVE: PrintModeEvent = {
  type: 'subagent_start',
  agentId: 'det-1',
  agentType: 'detective',
  displayName: 'Detective',
  onlyChild: false,
}

const DETECTIVE_DONE: PrintModeEvent = {
  type: 'subagent_finish',
  agentId: 'det-1',
  agentType: 'detective',
  displayName: 'Detective',
  onlyChild: false,
}

/** Run one `code_search` call after `lead`, and report the attribution the
 *  reducer stamped on its tool block: [agentId, parentAgentId, agentLabel]. */
function attribution(
  ids: { agentId?: string; parentAgentId?: string },
  lead: PrintModeEvent[] = [],
): Array<string | undefined> {
  const events: PrintModeEvent[] = [
    ...lead,
    {
      type: 'tool_call',
      toolCallId: 't1',
      toolName: 'code_search',
      input: { pattern: 'x' },
      ...ids,
    },
  ]
  const tool = applyEventBatch(initialTranscriptState, events).blocks.find(
    (block) => block.kind === 'tool',
  )
  if (tool === undefined || tool.kind !== 'tool') {
    throw new Error('expected a tool block')
  }
  return [tool.agentId, tool.parentAgentId, tool.agentLabel]
}

describe('tool_call subagent attribution (W4-1)', () => {
  test('a subagent call carries both ids and its roster label', () => {
    expect(
      attribution({ agentId: 'det-1', parentAgentId: 'savant-1' }, [DETECTIVE]),
    ).toEqual(['det-1', 'savant-1', 'Detective'])
  })

  test('root-level calls stay unbadged', () => {
    expect(attribution({})).toEqual([undefined, undefined, undefined])
  })

  test('the orchestrator is never badged as a subagent', () => {
    const start: PrintModeEvent = {
      type: 'start',
      messageHistoryLength: 0,
      agentId: 'savant-1',
    }
    expect(attribution({ agentId: 'savant-1' }, [start])).toEqual([
      'savant-1',
      undefined,
      undefined,
    ])
  })

  test('a finished subagent keeps the id but loses the badge', () => {
    // The ids ride along (the call WAS attributed); only the badge, which
    // resolves against the ACTIVE roster, is gone.
    expect(
      attribution({ agentId: 'det-1' }, [DETECTIVE, DETECTIVE_DONE]),
    ).toEqual(['det-1', undefined, undefined])
  })

  test('an unmatched id keeps the call id and invents no label', () => {
    expect(attribution({ parentAgentId: 'ghost' }, [DETECTIVE])).toEqual([
      undefined,
      'ghost',
      undefined,
    ])
  })
})
