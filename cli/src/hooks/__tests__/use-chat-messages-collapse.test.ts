import { describe, expect, it } from 'bun:test'

import {
  clearCollapseFlagReset,
  scheduleCollapseFlagReset,
} from '../collapse-flag-timer'
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

  it('toggles a compaction-summary block by its id (FID-2026-0828-001)', () => {
    const messages: ChatMessage[] = [
      {
        ...makeMessage('m1', false),
        blocks: [
          {
            type: 'compaction-summary',
            id: 'compaction-summary-7',
            summary: 'line one\nline two\nline three',
            removedMessages: 3,
            isCollapsed: true,
          },
        ],
      },
    ]

    // Expand the collapsed-by-default summary block.
    const expanded = updateMessageCollapse(messages, 'compaction-summary-7')
    const expBlock = expanded[0].blocks?.[0]
    expect(
      expBlock && 'isCollapsed' in expBlock ? expBlock.isCollapsed : null,
    ).toBe(false)
    expect(
      expBlock && 'userOpened' in expBlock ? expBlock.userOpened : null,
    ).toBe(true)

    // Collapse it again.
    const reCollapsed = updateMessageCollapse(expanded, 'compaction-summary-7')
    const colBlock = reCollapsed[0].blocks?.[0]
    expect(
      colBlock && 'isCollapsed' in colBlock ? colBlock.isCollapsed : null,
    ).toBe(true)
  })

  it('toggles the boot free-options block by its id (FID-2026-1017-005)', () => {
    const messages: ChatMessage[] = [
      {
        ...makeMessage('boot', false),
        blocks: [
          {
            type: 'free-options',
            id: 'free-options-1',
            snapshot: {
              report: {
                fetchedAt: '2026-10-17T09:00:00.000Z',
                stale: false,
                configuredProviders: [],
                wiredFree: [],
                notWired: [],
                localFree: [],
              },
              source: 'cache',
              ageMs: 3600_000,
              artifact: { ok: true, path: '/tmp/free-options.md' },
            },
            discovery: null,
            markdownPath: '/tmp/free-options.md',
            isCollapsed: true,
          },
        ],
      },
      makeMessage('other', true),
    ]

    const expanded = updateMessageCollapse(messages, 'free-options-1')
    const block = expanded[0].blocks?.[0]
    expect(block && 'isCollapsed' in block ? block.isCollapsed : null).toBe(
      false,
    )
    expect(block && 'userOpened' in block ? block.userOpened : null).toBe(true)
    // The untouched message keeps its identity.
    expect(expanded[1]).toBe(messages[1])

    const reCollapsed = updateMessageCollapse(expanded, 'free-options-1')
    const again = reCollapsed[0].blocks?.[0]
    expect(again && 'isCollapsed' in again ? again.isCollapsed : null).toBe(
      true,
    )
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

/**
 * FID-2026-1013-013 W4-6: the collapse reset timer used to be a bare
 * `setTimeout(..., 0)` with no handle — a second rapid toggle's timer cleared
 * `isUserCollapsingRef` while the first toggle's render was still settling,
 * and unmount left the timer pointing at a dead ref.
 */
describe('collapse reset timer tracking (W4-6)', () => {
  const idle = { current: null as ReturnType<typeof setTimeout> | null }
  const flag = { current: false }

  it('a re-trigger replaces the pending timer instead of racing it', async () => {
    scheduleCollapseFlagReset(idle, flag)
    const first = idle.current
    expect(first).not.toBeNull()

    // The second toggle lands before the first timer has ticked.
    scheduleCollapseFlagReset(idle, flag)
    expect(idle.current).not.toBeNull()
    expect(idle.current).not.toBe(first)
    // The flag is still held — the stale timer cannot have cleared it.
    expect(flag.current).toBe(false)

    flag.current = true
    await Bun.sleep(5)
    expect(flag.current).toBe(false)
    // The handle is released once it fires, so nothing dangles.
    expect(idle.current).toBeNull()
  })

  it('clearing on unmount drops the pending reset entirely', async () => {
    const timer = { current: null as ReturnType<typeof setTimeout> | null }
    const held = { current: true }
    scheduleCollapseFlagReset(timer, held)
    clearCollapseFlagReset(timer)
    expect(timer.current).toBeNull()

    await Bun.sleep(5)
    // The timer never fired: the flag was not written after unmount.
    expect(held.current).toBe(true)
  })

  it('clearing an already-settled timer is a no-op', () => {
    const timer = { current: null as ReturnType<typeof setTimeout> | null }
    expect(() => {
      clearCollapseFlagReset(timer)
    }).not.toThrow()
    expect(timer.current).toBeNull()
  })
})
