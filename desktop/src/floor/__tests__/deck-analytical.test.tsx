import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { applyFloorEvents, createFloorState } from '../adapter/floor-adapter'
import { AnalyticalFloor } from '../analytical/deck-analytical'

import type { PrintModeEvent } from '@savant-code/common/types/print-mode'

const START = { type: 'start', messageHistoryLength: 1 } as const

const SCOUT_SPAWN = {
  type: 'subagent_start',
  agentId: 'a',
  agentType: 'scout',
  displayName: 'Scout',
  onlyChild: false,
} as const

function markupWith(events: readonly PrintModeEvent[]): string {
  const floor = applyFloorEvents(createFloorState(), events)
  return renderToStaticMarkup(<AnalyticalFloor floor={floor} />)
}

describe('analytical floor fallback (FID-2026-0822-012 P5)', () => {
  test('renders the full layout from a bare state', () => {
    const markup = markupWith([START])
    expect(markup).toContain('deck-analytical')
    expect(markup).toContain(DECK_BG)
    // Console dot + aura absent pre-phase.
    expect(markup).toContain(`r="10"`)
    expect(markup).not.toContain('stroke-width="2"')
  })

  test('walker dots and lanes appear for active walkers', () => {
    const markup = markupWith([
      START,
      SCOUT_SPAWN,
      {
        type: 'tool_call',
        toolCallId: 'tc-1',
        toolName: 'code_search',
        input: {},
        agentId: 'a',
      },
    ])
    // React keys never serialize; assert the lane <line> element itself.
    expect(markup).toContain('<line')
    // Walker dot tinted with the scout accent (primary token).
    expect(markup.toLowerCase()).toContain('#18faf9')
  })

  test('the aura ring renders once a G2 phase has paired', () => {
    const markup = markupWith([
      AURA_CALL(),
      {
        type: 'tool_result',
        toolCallId: 'tc-p',
        toolName: 'transition_phase',
        output: [{ type: 'json', value: { phase: 'audit' } }],
      },
    ])
    expect(markup).toContain(AURA_STROKE_AUDIT)
  })
})

const DECK_BG = '#050508'
const AURA_STROKE_AUDIT = '#ff9500'

function AURA_CALL(): PrintModeEvent {
  return {
    type: 'tool_call',
    toolCallId: 'tc-p',
    toolName: 'transition_phase',
    input: {},
  }
}
