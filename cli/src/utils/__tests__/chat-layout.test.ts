import { describe, expect, test } from 'bun:test'

import {
  getChildContentWidth,
  getMessageContentWidth,
  ROOT_MESSAGE_PREFIX_WIDTH,
} from '../chat-layout'

describe('chat layout width ledger', () => {
  test('accounts for transcript padding, message gutters, and root prefix once', () => {
    expect(
      getMessageContentWidth({
        availableWidth: 78,
        prefixWidth: ROOT_MESSAGE_PREFIX_WIDTH,
      }),
    ).toBe(71)
  })

  test('clamps narrow terminal content to one column', () => {
    expect(
      getMessageContentWidth({
        availableWidth: 4,
        prefixWidth: ROOT_MESSAGE_PREFIX_WIDTH,
      }),
    ).toBe(1)
  })

  test('applies a named child indent exactly once', () => {
    expect(getChildContentWidth(71, 12)).toBe(59)
    expect(getChildContentWidth(5, 12)).toBe(1)
  })
})
