import { describe, expect, test } from 'bun:test'

import {
  applyBubbleDelta,
  BUBBLE_TTL_MS,
  clampBubbleText,
  flattenBubbleText,
  MAX_BUBBLES,
  MAX_BUBBLE_CHARS,
  pruneBubbles,
} from '../speech-bubbles'

import type { SpeechBubble } from '../speech-bubbles'

const KNOWN = new Set(['agent-1', 'agent-2'])

const baseInput = {
  roleId: 'forge',
  displayName: 'Forge',
  nowMs: 1000,
}

describe('flattenBubbleText', () => {
  test('strips markdown syntax', () => {
    const out = flattenBubbleText('**bold** and `code`:\n\n# heading')
    expect(out).toBe('bold and code: heading')
  })

  test('collapses code blocks into placeholder', () => {
    const out = flattenBubbleText('before\n```js\nconst x = 1\n```\nafter')
    expect(out).toBe('before [code] after')
  })

  test('normalizes whitespace', () => {
    expect(flattenBubbleText('a\n\n  b\tc')).toBe('a b c')
  })

  test('collapses GFM table rows into readable prose (P21)', () => {
    const out = flattenBubbleText(
      '## Purpose\n\n| Purpose | -- |\n| :------- | -- |\n| here are the files | note |',
    )
    // No pipes, no dashes, no heading markers leak into the bubble.
    expect(out).not.toContain('|')
    expect(out).not.toContain(':------')
    expect(out).toContain('here are the files')
    expect(out).toContain('Purpose')
  })

  test('drops the table separator row only, keeps data cells', () => {
    const out = flattenBubbleText('| A | B |\n| --- | --- |\n| x | y |')
    expect(out).toBe('A B x y')
  })
})

describe('clampBubbleText', () => {
  test('short text passes through untruncated', () => {
    const out = clampBubbleText('hello')
    expect(out).toEqual({ text: 'hello', truncated: false })
  })

  test('long text is clamped with ellipsis', () => {
    const long = 'x'.repeat(500)
    const out = clampBubbleText(long)
    expect(out.text.length).toBeLessThanOrEqual(MAX_BUBBLE_CHARS)
    expect(out.text.endsWith('…')).toBe(true)
    expect(out.truncated).toBe(true)
  })

  test('text at the new 320-char budget passes untruncated', () => {
    const atBudget = 'x'.repeat(MAX_BUBBLE_CHARS)
    expect(clampBubbleText(atBudget).truncated).toBe(false)
  })
})

describe('applyBubbleDelta', () => {
  test('creates a bubble for a known agent', () => {
    const next = applyBubbleDelta(
      [],
      { ...baseInput, agentId: 'agent-1', raw: 'Je cherche le fichier' },
      KNOWN,
    )
    expect(next).toHaveLength(1)
    expect(next[0].text).toBe('Je cherche le fichier')
  })

  test('drops unattributable (unknown) agent ids — honesty rule', () => {
    const next = applyBubbleDelta(
      [],
      { ...baseInput, agentId: 'unknown-agent', raw: 'text' },
      KNOWN,
    )
    expect(next).toHaveLength(0)
  })

  test('drops empty agent ids', () => {
    const next = applyBubbleDelta(
      [],
      { ...baseInput, agentId: '', raw: 'text' },
      KNOWN,
    )
    expect(next).toHaveLength(0)
  })

  test('drops empty text after flattening', () => {
    const next = applyBubbleDelta(
      [],
      { ...baseInput, agentId: 'agent-1', raw: '***' },
      KNOWN,
    )
    expect(next).toHaveLength(0)
  })

  test('appends deltas for the same agent without duplication', () => {
    let bubbles: readonly SpeechBubble[] = []
    bubbles = applyBubbleDelta(
      bubbles,
      { ...baseInput, agentId: 'agent-1', raw: 'premiere' },
      KNOWN,
    )
    bubbles = applyBubbleDelta(
      bubbles,
      { ...baseInput, agentId: 'agent-1', raw: 'ligne', nowMs: 1100 },
      KNOWN,
    )
    expect(bubbles).toHaveLength(1)
    expect(bubbles[0].text).toContain('premiere')
    expect(bubbles[0].text).toContain('ligne')
  })

  test('enforces FIFO cap MAX_BUBBLES', () => {
    let bubbles: readonly SpeechBubble[] = []
    for (let index = 0; index < MAX_BUBBLES + 5; index += 1) {
      bubbles = applyBubbleDelta(
        bubbles,
        {
          roleId: 'forge',
          displayName: `A${index}`,
          agentId: `agent-${index}`,
          raw: `msg ${index}`,
          nowMs: 1000 + index,
        },
        new Set([`agent-${index}`]),
      )
    }
    expect(bubbles.length).toBeLessThanOrEqual(MAX_BUBBLES)
  })
})

describe('pruneBubbles', () => {
  test('removes expired bubbles', () => {
    const stale: SpeechBubble = {
      agentId: 'agent-1',
      roleId: 'forge',
      displayName: 'Forge',
      text: 'old',
      lastMs: 0,
    }
    const fresh: SpeechBubble = {
      agentId: 'agent-2',
      roleId: 'forge',
      displayName: 'Forge',
      text: 'new',
      lastMs: BUBBLE_TTL_MS - 1,
    }
    const pruned = pruneBubbles([stale, fresh], BUBBLE_TTL_MS + 100)
    expect(pruned).toHaveLength(1)
    expect(pruned[0].agentId).toBe('agent-2')
  })

  test('returns same reference when nothing expired (cheap change detection)', () => {
    const bubbles: readonly SpeechBubble[] = [
      {
        agentId: 'agent-1',
        roleId: 'forge',
        displayName: 'Forge',
        text: 'hi',
        lastMs: 0,
      },
    ]
    expect(pruneBubbles(bubbles, 50)).toBe(bubbles)
  })
})
