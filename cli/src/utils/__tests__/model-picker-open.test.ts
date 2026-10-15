import { describe, expect, test } from 'bun:test'

import { openModelPicker } from '../model-picker-open'

import type { OpenRouterModel } from '../openrouter-models'

const row = (id: string): OpenRouterModel =>
  ({ id, provider: 'openrouter' }) as unknown as OpenRouterModel

function harness(cached: OpenRouterModel[], fresh: OpenRouterModel[]) {
  const calls: string[] = []
  let open = false
  let shown: OpenRouterModel[] = []
  let resolveRefresh!: (m: OpenRouterModel[]) => void
  const refreshPromise = new Promise<OpenRouterModel[]>((resolve) => {
    resolveRefresh = resolve
  })
  const deps = {
    readCached: () => cached,
    refresh: () => {
      calls.push('refresh')
      return refreshPromise
    },
    open: (models: OpenRouterModel[]) => {
      calls.push('open')
      open = true
      shown = models
    },
    setModels: (models: OpenRouterModel[]) => {
      calls.push('setModels')
      shown = models
    },
    isOpen: () => open,
  }
  return {
    deps,
    calls,
    shown: () => shown,
    close: () => {
      open = false
    },
    finish: () => resolveRefresh(fresh),
  }
}

describe('openModelPicker (FID-2026-1008-005)', () => {
  test('cached rows open the picker before the refresh resolves', async () => {
    const h = harness([row('a')], [row('a'), row('b')])
    const opened = await openModelPicker(h.deps)
    expect(opened).toBe(true)
    expect(h.calls).toEqual(['open', 'refresh'])
    expect(h.shown().map((m) => m.id)).toEqual(['a'])
  })

  test('background refresh replaces rows in an open picker', async () => {
    const h = harness([row('a')], [row('a'), row('b')])
    await openModelPicker(h.deps)
    h.finish()
    await new Promise((r) => setTimeout(r, 0))
    expect(h.calls).toEqual(['open', 'refresh', 'setModels'])
    expect(h.shown().map((m) => m.id)).toEqual(['a', 'b'])
  })

  test('a picker closed before refresh completes is not mutated', async () => {
    const h = harness([row('a')], [row('a'), row('b')])
    await openModelPicker(h.deps)
    h.close()
    h.finish()
    await new Promise((r) => setTimeout(r, 0))
    expect(h.calls).not.toContain('setModels')
  })

  test('cold cache awaits the first load before opening', async () => {
    const h = harness([], [row('x')])
    const pending = openModelPicker(h.deps)
    expect(h.calls).toEqual(['refresh'])
    h.finish()
    const opened = await pending
    expect(opened).toBe(true)
    expect(h.calls).toEqual(['refresh', 'open'])
  })

  test('cold cache with no rows reports not opened', async () => {
    const h = harness([], [])
    const pending = openModelPicker(h.deps)
    h.finish()
    expect(await pending).toBe(false)
    expect(h.calls).toEqual(['refresh'])
  })
})
