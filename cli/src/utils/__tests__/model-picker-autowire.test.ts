import { beforeEach, describe, expect, test } from 'bun:test'

import {
  clearModelAutoWire,
  completeModelAutoWire,
  getPendingModelAutoWire,
  stageModelAutoWire,
} from '../model-picker-autowire'

describe('model picker registry-only auto-wire (FID-2026-1008-005)', () => {
  beforeEach(() => {
    clearModelAutoWire()
  })

  test('a key saved for the staged provider applies the staged model once', () => {
    stageModelAutoWire({ id: 'kios/model', provider: 'kiosapi' })
    const applied: string[] = []

    const done = completeModelAutoWire('kiosapi', (m) => applied.push(m.id))

    expect(done).toBe(true)
    expect(applied).toEqual(['kios/model'])
    expect(getPendingModelAutoWire()).toBeUndefined()
    // A second key save must not re-apply the cleared selection.
    expect(completeModelAutoWire('kiosapi', () => applied.push('again'))).toBe(
      false,
    )
    expect(applied).toEqual(['kios/model'])
  })

  test('a key saved for a different provider leaves the staged model pending', () => {
    stageModelAutoWire({ id: 'kios/model', provider: 'kiosapi' })
    const applied: string[] = []

    expect(
      completeModelAutoWire('tokenharbor', (m) => applied.push(m.id)),
    ).toBe(false)

    expect(applied).toEqual([])
    expect(getPendingModelAutoWire()).toEqual({
      id: 'kios/model',
      provider: 'kiosapi',
    })
  })

  test('staging a new selection replaces the pending one', () => {
    stageModelAutoWire({ id: 'a/one', provider: 'kiosapi' })
    stageModelAutoWire({ id: 'b/two', provider: 'kiosapi' })
    const applied: string[] = []

    completeModelAutoWire('kiosapi', (m) => applied.push(m.id))

    expect(applied).toEqual(['b/two'])
  })

  test('clearing drops the pending selection without applying it', () => {
    stageModelAutoWire({ id: 'kios/model', provider: 'kiosapi' })
    clearModelAutoWire()
    expect(getPendingModelAutoWire()).toBeUndefined()
    expect(completeModelAutoWire('kiosapi', () => {})).toBe(false)
  })

  test('with nothing staged, completion is a no-op', () => {
    expect(completeModelAutoWire('kiosapi', () => {})).toBe(false)
  })
})
