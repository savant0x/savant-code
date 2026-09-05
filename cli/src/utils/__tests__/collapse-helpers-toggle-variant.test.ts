// Collapse-helpers test family — agent-variant messages carrying blocks:
// message-level and block-level collapse state compose independently.
// Sibling of the Loop 318 decomposition.

import { describe, test, expect } from 'bun:test'

import {
  createMessage,
  createToolBlock,
  hasAnyExpandedBlocks,
  setAllBlocksCollapsedState,
  type CollapsibleBlock,
} from './collapse-helpers-test-fixtures'

describe('agent variant messages with blocks', () => {
  test('hasAnyExpandedBlocks: checks both message-level and block-level collapsed state', () => {
    const messages = [
      createMessage('1', 'agent', [createToolBlock('tool-1', false)], {
        isCollapsed: true,
      }),
    ]
    // Even though message-level is collapsed, block-level is expanded
    expect(hasAnyExpandedBlocks(messages)).toBe(true)
  })

  test('hasAnyExpandedBlocks: message-level expanded is detected', () => {
    const messages = [
      createMessage('1', 'agent', [createToolBlock('tool-1', true)], {
        isCollapsed: false,
      }),
    ]
    // Message-level is expanded even though block-level is collapsed
    expect(hasAnyExpandedBlocks(messages)).toBe(true)
  })

  test('hasAnyExpandedBlocks: both collapsed returns false', () => {
    const messages = [
      createMessage('1', 'agent', [createToolBlock('tool-1', true)], {
        isCollapsed: true,
      }),
    ]
    expect(hasAnyExpandedBlocks(messages)).toBe(false)
  })

  test('setAllBlocksCollapsedState: collapses both message-level and block-level', () => {
    const messages = [
      createMessage('1', 'agent', [createToolBlock('tool-1', false)], {
        isCollapsed: false,
      }),
    ]
    const result = setAllBlocksCollapsedState(messages, true)

    expect(result[0]?.metadata?.isCollapsed).toBe(true)
    expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(true)
  })

  test('setAllBlocksCollapsedState: expands both message-level and block-level', () => {
    const messages = [
      createMessage('1', 'agent', [createToolBlock('tool-1', true)], {
        isCollapsed: true,
      }),
    ]
    const result = setAllBlocksCollapsedState(messages, false)

    expect(result[0]?.metadata?.isCollapsed).toBe(false)
    expect(result[0]?.metadata?.userOpened).toBe(true)
    expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.isCollapsed).toBe(
      false,
    )
    expect((result[0]?.blocks?.[0] as CollapsibleBlock)?.userOpened).toBe(true)
  })
})
