/**
 * FID-2026-0914-002 — compaction-summary preservation pin (RED-first).
 *
 * Loop-2 correction: the summary envelope carried by the CURRENT pruner
 * assembly is `<compaction-summary>` nested INSIDE `<historical_memory>`
 * (summary-assembly.ts), while `hasPreservedState` (phases.ts) checks only
 * `<conversation_summary>` / `<structured_state>`. The additive literal
 * check guards the emergency-truncation preserve-set against envelope
 * drift — BOTH forms must be recognized.
 */
import { describe, expect, test } from 'bun:test'

import { CompactionMessage_ } from '../context-compactor/phases'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'

function textMessage(text: string): Message {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
  }
}

describe('hasPreservedState recognizes every compaction envelope form', () => {
  test('current full envelope: <conversation_summary> wrapping <historical_memory> wrapping <compaction-summary>', () => {
    const message = textMessage(
      '<conversation_summary>\n<historical_memory>\n<compaction-summary>\n## Preserved state\n{}\n</compaction-summary>\n</historical_memory>\n</conversation_summary>',
    )
    expect(CompactionMessage_.hasPreservedState(message)).toBe(true)
  })

  test('bare <compaction-summary> block is recognized even outside the full envelope', () => {
    const message = textMessage(
      '<compaction-summary>\n## Preserved state\n{"todos":[]}\n</compaction-summary>',
    )
    expect(CompactionMessage_.hasPreservedState(message)).toBe(true)
  })

  test('plain messages are not misclassified', () => {
    expect(
      CompactionMessage_.hasPreservedState(textMessage('just a chat turn')),
    ).toBe(false)
  })
})
