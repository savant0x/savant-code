import { describe, expect, test } from 'bun:test'

import { getVirtualBlockRange } from '../ChatThread'

describe('getVirtualBlockRange', () => {
  test('keeps short transcripts fully rendered', () => {
    expect(getVirtualBlockRange(80, 0, 600)).toEqual({ start: 0, end: 80 })
  })

  test('renders an overscanned window for long transcripts', () => {
    expect(getVirtualBlockRange(200, 960, 480)).toEqual({ start: 2, end: 23 })
  })

  test('clamps the window at transcript boundaries', () => {
    expect(getVirtualBlockRange(200, 19000, 800)).toEqual({
      start: 189,
      end: 200,
    })
  })
})
