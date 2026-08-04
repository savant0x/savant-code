import { describe, expect, it } from 'bun:test'

import { updateMessageCollapse } from '../use-chat-messages'

import type { ChatMessage } from '../../types/chat'

/**
 * FID-2026-0802-007 P2: `handleCollapseToggle` previously re-created EVERY
 * block-bearing message object on any toggle (a fresh identity for each),
 * which forced a full re-render of the memoized transcript. The extracted
 * pure updater must preserve identity for messages that are not the target.
 */
function makeMessage(id: string, withBlocks: boolean): ChatMessage {
  return {
    id,
    variant: 'ai',
    content: '',
    timestamp: '2026-08-02T00:00:00.000Z',
    blocks: withBlocks
      ? [
          {
            type: 'tool',
            toolCallId: `tool-${id}`,
            toolName: 'read_files',
            input: {},
          },
        ]
      : undefined,
  }
}

describe('updateMessageCollapse identity preservation (FID-007 P2)', () => {
  it('toggling a block in one message leaves unrelated messages untouched', () => {
    const messages = [
      makeMessage('m1', true),
      makeMessage('m2', true),
      makeMessage('m3', true),
      makeMessage('m4', false), // no blocks
    ]

    const result = updateMessageCollapse(messages, 'tool-m2')

    // Length preserved and target toggled.
    expect(result).toHaveLength(4)
    const targetMessage = result[1]
    const targetBlock = targetMessage.blocks?.[0]
    expect(targetBlock && 'isCollapsed' in targetBlock).toBe(true)
    expect(
      targetBlock && 'isCollapsed' in targetBlock
        ? targetBlock.isCollapsed
        : null,
    ).toBe(true)

    // Non-target messages keep their exact identity (memo can skip).
    expect(result[0]).toBe(messages[0])
    expect(result[2]).toBe(messages[2])
    expect(result[3]).toBe(messages[3])
    // The target message is a new object with a new blocks array.
    expect(result[1]).not.toBe(messages[1])
    expect(result[1].blocks).not.toBe(messages[1].blocks)
  })

  it('toggling a top-level agent message only changes that message', () => {
    const agentMessage: ChatMessage = {
      ...makeMessage('a1', false),
      variant: 'agent',
      metadata: { isCollapsed: false },
    }
    const messages = [
      makeMessage('m1', true),
      agentMessage,
      makeMessage('m3', true),
    ]

    const result = updateMessageCollapse(messages, 'a1')

    expect(result[0]).toBe(messages[0])
    expect(result[2]).toBe(messages[2])
    expect(result[1]).not.toBe(messages[1])
    expect(result[1].metadata?.isCollapsed).toBe(true)
  })

  it('no-op for an unknown id: every message keeps its identity', () => {
    const messages = [
      makeMessage('m1', true),
      makeMessage('m2', true),
      makeMessage('m3', true),
    ]

    const result = updateMessageCollapse(messages, 'does-not-exist')

    expect(result[0]).toBe(messages[0])
    expect(result[1]).toBe(messages[1])
    expect(result[2]).toBe(messages[2])
  })
})
