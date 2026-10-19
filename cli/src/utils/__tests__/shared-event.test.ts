import { EventEmitter } from 'node:events'

import { describe, expect, test } from 'bun:test'

import { subscribeSharedEvent } from '../shared-event'

describe('shared UI events', () => {
  test('subscriptions added during dispatch wait for the next event', () => {
    const emitter = new EventEmitter()
    const calls: string[] = []
    let stopAdded = () => {}
    const stopFirst = subscribeSharedEvent(emitter, 'change', () => {
      calls.push('first')
      stopAdded()
      stopAdded = subscribeSharedEvent(emitter, 'change', () =>
        calls.push('added'),
      )
    })
    emitter.emit('change')
    expect(calls).toEqual(['first'])
    stopFirst()
    emitter.emit('change')
    expect(calls).toEqual(['first', 'added'])
    stopAdded()
    expect(emitter.listenerCount('change')).toBe(0)
  })

  test('bounds native subscriptions and releases the last listener', () => {
    const emitter = new EventEmitter()
    let calls = 0
    const unsubscribers = Array.from({ length: 100 }, () =>
      subscribeSharedEvent(emitter, 'resize', () => calls++),
    )
    expect(emitter.listenerCount('resize')).toBe(1)
    emitter.emit('resize')
    expect(calls).toBe(100)
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
      unsubscribe()
    }
    expect(emitter.listenerCount('resize')).toBe(0)
    emitter.emit('resize')
    expect(calls).toBe(100)
  })

  test('identical callbacks have independent lifetimes and sources stay isolated', () => {
    const first = new EventEmitter()
    const second = new EventEmitter()
    let calls = 0
    const callback = () => calls++
    const stopFirst = subscribeSharedEvent(first, 'change', callback)
    const stopDuplicate = subscribeSharedEvent(first, 'change', callback)
    const stopSecond = subscribeSharedEvent(second, 'change', callback)
    stopFirst()
    first.emit('change')
    second.emit('change')
    expect(calls).toBe(2)
    stopDuplicate()
    expect(first.listenerCount('change')).toBe(0)
    expect(second.listenerCount('change')).toBe(1)
    stopSecond()
    expect(second.listenerCount('change')).toBe(0)
  })

  test('a callback removed during dispatch is not invoked', () => {
    const emitter = new EventEmitter()
    let calls = 0
    let stopLater = () => {}
    const stopFirst = subscribeSharedEvent(emitter, 'change', () => stopLater())
    stopLater = subscribeSharedEvent(emitter, 'change', () => calls++)
    emitter.emit('change')
    expect(calls).toBe(0)
    stopFirst()
    const stopNew = subscribeSharedEvent(emitter, 'change', () => calls++)
    expect(emitter.listenerCount('change')).toBe(1)
    emitter.emit('change')
    expect(calls).toBe(1)
    stopNew()
  })
})
