import { describe, expect, test } from 'bun:test'

import {
  describeRenderError,
  evaluateFrameProbe,
  installRendererHealth,
  RENDER_ERROR_EVENT,
} from '../renderer-health'

import type { RendererHealthTarget } from '../renderer-health'

describe('renderer health — frame probe', () => {
  test('a probe that produced a frame resets the miss counter', () => {
    expect(
      evaluateFrameProbe({
        framesBefore: 10,
        framesAfter: 11,
        missedProbes: 2,
        maxMissedProbes: 3,
      }),
    ).toEqual({ missedProbes: 0, stalled: false })
  })

  test('consecutive misses announce a stall only at the threshold', () => {
    let missed = 0
    for (const expected of [1, 2, 3]) {
      const probe = evaluateFrameProbe({
        framesBefore: 10,
        framesAfter: 10,
        missedProbes: missed,
        maxMissedProbes: 3,
      })
      missed = probe.missedProbes
      expect(missed).toBe(expected)
      expect(probe.stalled).toBe(expected === 3)
    }
  })
})

describe('renderer health — render error fields', () => {
  test('an Error payload records message and a bounded stack', () => {
    const error = new Error('native render failed')
    error.stack = 'x'.repeat(9_000)
    const fields = describeRenderError({ error, renderable: undefined })
    expect(fields.message).toBe('native render failed')
    expect(String(fields.stack)).toHaveLength(4_000)
    expect(typeof fields.uptimeSeconds).toBe('number')
    expect(typeof fields.rssMb).toBe('number')
  })

  test('a non-Error payload still records something nameable', () => {
    expect(describeRenderError('boom').message).toBe('boom')
    expect(describeRenderError(undefined).message).toBe('undefined')
  })
})

describe('renderer health — installation', () => {
  function fakeRenderer(): {
    target: RendererHealthTarget
    handlers: Map<string, (payload: unknown) => void>
    renders: number
  } {
    const handlers = new Map<string, (payload: unknown) => void>()
    const state = { renders: 0 }
    return {
      handlers,
      get renders() {
        return state.renders
      },
      target: {
        on(event, handler) {
          handlers.set(event, handler)
        },
        requestRender() {
          state.renders += 1
        },
        isDestroyed: false,
      },
    }
  }

  test('a render:error is recorded and asks for one repaint', () => {
    const fake = fakeRenderer()
    const records: Array<{ event: string; fields: Record<string, unknown> }> =
      []
    const dispose = installRendererHealth(fake.target, {
      record: (event, fields) => records.push({ event, fields }),
      probeIntervalMs: 10_000,
    })
    try {
      fake.handlers.get(RENDER_ERROR_EVENT)?.(new Error('paint failed'))
      expect(records).toHaveLength(1)
      expect(records[0]?.event).toBe('render-error')
      expect(records[0]?.fields.message).toBe('paint failed')
      expect(fake.renders).toBe(1)
    } finally {
      dispose()
    }
  })

  test('a stopped render loop is recorded once, not once per probe', async () => {
    const fake = fakeRenderer()
    const records: string[] = []
    const dispose = installRendererHealth(fake.target, {
      record: (event) => records.push(event),
      probeIntervalMs: 5,
      probeGraceMs: 5,
      maxMissedProbes: 2,
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 80))
      expect(records).toEqual(['render-stall'])
    } finally {
      dispose()
    }
  })

  test('frames resuming after a stall allow a later stall to be recorded', async () => {
    const fake = fakeRenderer()
    const records: string[] = []
    const dispose = installRendererHealth(fake.target, {
      record: (event) => records.push(event),
      probeIntervalMs: 5,
      probeGraceMs: 5,
      maxMissedProbes: 2,
    })
    try {
      await new Promise((resolve) => setTimeout(resolve, 40))
      fake.handlers.get('frame')?.({ frameId: 1 })
      await new Promise((resolve) => setTimeout(resolve, 40))
      expect(records).toEqual(['render-stall', 'render-stall'])
    } finally {
      dispose()
    }
  })
})
