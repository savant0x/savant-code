import { createTestRenderer } from '@opentui/core/testing'
import { useAppContext, useKeyboard, createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import { useEffect, useState } from 'react'

import { initializeThemeStore } from '../../hooks/use-theme'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'
import type { EventEmitter } from 'node:events'

initializeThemeStore()

/**
 * FID-2026-1022-001: the population of listeners on the `/model` path.
 *
 * The 2026-10-19 acceptance logged five `EventEmitter` max-listener warnings —
 * 11 `resize`, `focus` and `blur` on `CliRenderer`, 11 `change` on
 * `ScrollBarRenderable`. A warning proves the count reached Node's threshold of
 * 10 at those instants; it cannot say whether the count GROWS.
 *
 * This instrument answers that question against the emitters themselves
 * (`listenerCount()`), which is exact and independent of the PTY.
 *
 * The first version of this file called `root.render()` once per cycle. That
 * measured `@opentui/react`, not the picker: `createRoot().render()` creates a
 * NEW React container on every call (`node_modules/@opentui/react/
 * chunk-vx8rm66p.js`, `_render` → `reconciler.createContainer`), orphaning the
 * previous tree without unmounting it. No effect cleanup ran, so every hook in
 * the orphaned tree leaked and the picker appeared to grow by one `keypress`
 * and one `selection` subscriber per cycle. A single container — one
 * `root.render()`, a host component that toggles the picker through state —
 * shows the real population: flat.
 *
 * The population is allowed to be non-zero — those are the subscribers the
 * surface legitimately holds while mounted. What must be flat is the count
 * after every mount/unmount cycle, and that is what this file pins.
 */
const CYCLES = 5
const CATALOG_SIZE = 4_075
const PROVIDERS = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'qwen']

function catalog(size: number): OpenRouterModel[] {
  return Array.from({ length: size }, (_, index) => {
    const provider = PROVIDERS[index % PROVIDERS.length]!
    return {
      id: `${provider}/model-${String(index).padStart(4, '0')}`,
      name: `${provider} model ${index}`,
      provider,
    }
  })
}

type Mode = 'idle' | 'picker' | 'keyboard' | 'leaky'
type Handles = { renderer?: EventEmitter; keyHandler?: EventEmitter }

const MODELS = catalog(CATALOG_SIZE)

const handles: Handles = {}
let setMode: (mode: Mode) => void = () => {}

/** Exposes the emitters the surface subscribes to, for exact sampling. */
function HandleProbe() {
  const { keyHandler } = useAppContext()
  handles.keyHandler = keyHandler as unknown as EventEmitter
  return <text>handles</text>
}

function KeyboardProbe() {
  useKeyboard(() => {})
  return <text>keyboard probe</text>
}

/**
 * Deliberately unsubscribed on cleanup. The instrument must see this leak —
 * a flat reading from a census that cannot detect a leak is not evidence.
 */
function LeakyProbe() {
  const { keyHandler } = useAppContext()
  useEffect(() => {
    keyHandler?.on('keypress', () => {})
    // No cleanup by design: this is the positive control.
  }, [keyHandler])
  return <text>leaky probe</text>
}

/** The single React container: `root.render()` is called once, in this file. */
function Host() {
  const [mode, update] = useState<Mode>('idle')
  setMode = update
  return (
    <>
      <HandleProbe />
      {mode === 'picker' ? (
        <ModelPicker
          models={MODELS}
          query=""
          selectedIndex={0}
          onSelectIndex={() => {}}
          onQueryChange={() => {}}
          onSelect={() => {}}
          onClose={() => {}}
          terminalHeight={76}
        />
      ) : null}
      {mode === 'keyboard' ? <KeyboardProbe /> : null}
      {mode === 'leaky' ? <LeakyProbe /> : null}
    </>
  )
}

interface EmitterNode {
  constructor: { name: string }
  eventNames?: () => (string | symbol)[]
  listenerCount?: (event: string | symbol) => number
  getChildren?: () => EmitterNode[]
}

/** `constructor:event → listenerCount` for every non-zero population in a tree. */
function walk(node: EmitterNode | undefined, out: Map<string, number>): void {
  if (!node) return
  const events = typeof node.eventNames === 'function' ? node.eventNames() : []
  for (const event of events) {
    const count = node.listenerCount?.(event) ?? 0
    if (count > 0) {
      const key = `${node.constructor.name}:${String(event)}`
      out.set(key, (out.get(key) ?? 0) + count)
    }
  }
  for (const child of node.getChildren?.() ?? []) walk(child, out)
}

/** Every emitter in the renderer tree plus the key handler. */
function population(renderer: EventEmitter): Record<string, number> {
  const out = new Map<string, number>()
  const root = (renderer as unknown as { root?: EmitterNode }).root
  walk(renderer as unknown as EmitterNode, out)
  walk(root, out)
  walk(handles.keyHandler as unknown as EmitterNode, out)
  return Object.fromEntries(
    [...out.entries()].sort(([a], [b]) => a.localeCompare(b)),
  )
}

function keypressCount(snapshot: Record<string, number>): number {
  return snapshot['InternalKeyHandler:keypress'] ?? 0
}

async function settle(setup: Awaited<ReturnType<typeof createTestRenderer>>) {
  await setup.flush()
  await Bun.sleep(30)
  await setup.flush()
}

describe('model picker — listener population', () => {
  test('attribution — useKeyboard is flat and the census detects a real leak', async () => {
    const setup = await createTestRenderer({
      width: 60,
      height: 20,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    try {
      root.render(<Host />)
      await settle(setup)
      const baseline = population(setup.renderer)

      for (let cycle = 1; cycle <= 3; cycle += 1) {
        setMode('keyboard')
        await settle(setup)
        setMode('idle')
        await settle(setup)
      }
      const afterKeyboard = population(setup.renderer)
      expect(afterKeyboard).toEqual(baseline)

      for (let cycle = 1; cycle <= 3; cycle += 1) {
        setMode('leaky')
        await settle(setup)
        setMode('idle')
        await settle(setup)
      }
      const afterLeaky = population(setup.renderer)
      console.log(`attribution baseline: ${JSON.stringify(baseline)}`)
      console.log(
        `attribution after useKeyboard: ${JSON.stringify(afterKeyboard)}`,
      )
      console.log(`attribution after leak: ${JSON.stringify(afterLeaky)}`)

      // The positive control: three deliberate registrations, three listeners.
      expect(keypressCount(afterLeaky) - keypressCount(baseline)).toBe(3)
      // The library hook cleans up; it does not accumulate.
      expect(keypressCount(afterKeyboard)).toBe(keypressCount(baseline))
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 120_000)

  test('five mount/unmount cycles — the population does not grow', async () => {
    const setup = await createTestRenderer({
      width: 123,
      height: 76,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    const closed: Record<string, number>[] = []
    const opened: Record<string, number>[] = []

    try {
      root.render(<Host />)
      await settle(setup)
      const baseline = population(setup.renderer)

      for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
        setMode('picker')
        await settle(setup)
        opened.push(population(setup.renderer))
        setMode('idle')
        await settle(setup)
        const after = population(setup.renderer)
        closed.push(after)
        console.log(`cycle ${cycle} closed: ${JSON.stringify(after)}`)
      }

      // The picker is really mounted: each open adds exactly its own keypress
      // subscriber, so a flat closed population cannot be vacuous.
      for (const [index, snapshot] of opened.entries()) {
        expect(keypressCount(snapshot)).toBe(keypressCount(baseline) + 1)
        expect(snapshot['CliRenderer:selection'] ?? 0).toBe(
          (baseline['CliRenderer:selection'] ?? 0) + 1,
        )
        console.log(`cycle ${index + 1} open: ${JSON.stringify(snapshot)}`)
      }

      // Zero growth: every closed cycle is identical to the first.
      for (const snapshot of closed) {
        expect(snapshot).toEqual(closed[0])
      }
      expect(closed[0]).toEqual(baseline)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 120_000)
})
