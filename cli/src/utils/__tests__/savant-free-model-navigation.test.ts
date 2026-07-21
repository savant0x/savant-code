import { describe, expect, test } from 'bun:test'

import {
  savantFreeModelNavigationDirectionForKey,
  nextSavantFreeModelId,
} from '../savant-free-model-navigation'

describe('nextSavantFreeModelId', () => {
  test('moves to the next model when moving forward', () => {
    const modelIds = ['glm', 'minimax']

    expect(
      nextSavantFreeModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'forward',
      }),
    ).toBe('glm')
  })

  test('moves to the previous model when moving backward', () => {
    const modelIds = ['glm', 'minimax']

    expect(
      nextSavantFreeModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'backward',
      }),
    ).toBe('glm')
  })

  test('wraps through every model regardless of selectability', () => {
    const modelIds = ['glm', 'minimax', 'other']

    expect(
      nextSavantFreeModelId({
        modelIds,
        focusedId: 'minimax',
        direction: 'forward',
      }),
    ).toBe('other')
  })

  test('returns null when no model exists', () => {
    expect(
      nextSavantFreeModelId({
        modelIds: [],
        focusedId: 'glm',
        direction: 'forward',
      }),
    ).toBeNull()
  })
})

describe('savantFreeModelNavigationDirectionForKey', () => {
  test('maps arrow keys to model navigation directions', () => {
    expect(savantFreeModelNavigationDirectionForKey({ name: 'down' })).toBe(
      'forward',
    )
    expect(savantFreeModelNavigationDirectionForKey({ name: 'right' })).toBe(
      'forward',
    )
    expect(savantFreeModelNavigationDirectionForKey({ name: 'up' })).toBe(
      'backward',
    )
    expect(savantFreeModelNavigationDirectionForKey({ name: 'left' })).toBe(
      'backward',
    )
  })

  test('maps tab and shift-tab to model navigation directions', () => {
    expect(savantFreeModelNavigationDirectionForKey({ name: 'tab' })).toBe(
      'forward',
    )
    expect(
      savantFreeModelNavigationDirectionForKey({ name: 'tab', shift: true }),
    ).toBe('backward')
  })

  test('maps terminal tab sequences to model navigation directions', () => {
    expect(savantFreeModelNavigationDirectionForKey({ sequence: '\t' })).toBe(
      'forward',
    )
    expect(
      savantFreeModelNavigationDirectionForKey({ sequence: '\x1b[9u' }),
    ).toBe('forward')
    expect(
      savantFreeModelNavigationDirectionForKey({ sequence: '\x1b[Z' }),
    ).toBe('backward')
    expect(
      savantFreeModelNavigationDirectionForKey({ sequence: '\x1b[9;2u' }),
    ).toBe('backward')
    expect(
      savantFreeModelNavigationDirectionForKey({ sequence: '\x1b[27;2;9~' }),
    ).toBe('backward')
  })

  test('ignores non-navigation keys', () => {
    expect(savantFreeModelNavigationDirectionForKey({ name: 'enter' })).toBeNull()
  })
})
