import { createTestRenderer } from '@opentui/core/testing'
import { useAppContext, useKeyboard, createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'

import { initializeThemeStore } from '../../hooks/use-theme'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'
import type { EventEmitter } from 'node:events'

initializeThemeStore()

/**
 * FID-2026-1022-001: the 2026-10-19 `/model` acceptance logged five
 * `EventEmitter` max-listener warnings in ~27 s — 11 `resize`, `focus` and
 * `blur` listeners on `CliRenderer`, 11 `change` on `ScrollBarRenderable`.
 * A warning proves the count reached Node's threshold of 10 at those
 * instants; it cannot say whether the count GROWS.
 *
 * This instrument answers that question against the emitters themselves
 * (`listenerCount()`), which is exact and independent of the PTY: the picker is
 * mounted and unmounted five times on one renderer and the population is
 * sampled at the same point of every cycle.
 *
 * The population is allowed to be non-zero — those are the subscribers the
 * surface legitimately holds while mounted. What must be flat is the
 * repository-owned part of it, and the measurement records the two populations
 * that are not flat so an upstream repair is noticed.
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

type Handles = { renderer?: EventEmitter; keyHandler?: EventEmitter }

const handles: Handles = {}

/** Exposes the two emitters the surface subscribes to, for exact sampling. */
function HandleProbe() {
  const { keyHandler } = useAppContext()
  handles.keyHandler = keyHandler as unknown as EventEmitter
  return <text>handles</text>
}

function KeyboardProbe() {
  useKeyboard(() => {})
  return <text>keyboard probe</text>
}

function PlainProbe() {
  return <text>plain probe</text>
}

/** Keeps the emitter probe mounted across every cycle on one React root. */
function Frame({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <HandleProbe />
      {children}
    </>
  )
}

/** `constructor:event → listenerCount` for every non-zero population. */
function population(renderer: EventEmitter): Record<string, number> {
  const out = new Map<string, number>()
  const record = (emitter: EventEmitter | undefined, label: string) => {
    if (!emitter) return
    for (const event of emitter.eventNames()) {
      const key = `${label}:${String(event)}`
      out.set(key, (out.get(key) ?? 0) + emitter.listenerCount(event))
    }
  }
  record(renderer, 'CliRenderer')
  record(handles.keyHandler, 'InternalKeyHandler')
  return Object.fromEntries(
    [...out.entries()].sort(([a], [b]) => a.localeCompare(b)),
  )
}

describe('model picker — listener population', () => {
  test('attribution — a bare useKeyboard mount is the accumulating subscriber', async () => {
    const setup = await createTestRenderer({
      width: 60,
      height: 20,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    try {
      root.render(
        <Frame>
          <text>idle</text>
        </Frame>,
      )
      await setup.flush()
      await Bun.sleep(20)
      const before = population(setup.renderer)
      for (let cycle = 1; cycle <= 3; cycle += 1) {
        root.render(
          <Frame>
            <PlainProbe />
          </Frame>,
        )
        await setup.flush()
        await Bun.sleep(20)
        root.render(<Frame />)
        await setup.flush()
        await Bun.sleep(20)
      }
      const afterPlain = population(setup.renderer)
      expect(afterPlain).toEqual(before)

      for (let cycle = 1; cycle <= 3; cycle += 1) {
        root.render(
          <Frame>
            <KeyboardProbe />
          </Frame>,
        )
        await setup.flush()
        await Bun.sleep(20)
        root.render(<Frame />)
        await setup.flush()
        await Bun.sleep(20)
      }
      const afterKeyboard = population(setup.renderer)
      console.log(`attribution before: ${JSON.stringify(before)}`)
      console.log(`attribution after plain: ${JSON.stringify(afterPlain)}`)
      console.log(
        `attribution after useKeyboard: ${JSON.stringify(afterKeyboard)}`,
      )
      expect(
        (afterKeyboard['InternalKeyHandler:keypress'] ?? 0) -
          (before['InternalKeyHandler:keypress'] ?? 0),
      ).toBe(3)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 120_000)

  test('five mount/unmount cycles — measured population', async () => {
    const setup = await createTestRenderer({
      width: 123,
      height: 76,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    const models = catalog(CATALOG_SIZE)
    const snapshots: { cycle: number; population: Record<string, number> }[] =
      []

    try {
      for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
        root.render(
          <Frame>
            <ModelPicker
              models={models}
              query=""
              selectedIndex={0}
              onSelectIndex={() => {}}
              onQueryChange={() => {}}
              onSelect={() => {}}
              onClose={() => {}}
              terminalHeight={76}
            />
          </Frame>,
        )
        await setup.flush()
        await Bun.sleep(30)
        await setup.flush()

        root.render(<Frame />)
        await setup.flush()
        await Bun.sleep(30)
        await setup.flush()

        snapshots.push({ cycle, population: population(setup.renderer) })
        console.log(
          `cycle ${cycle}: ${JSON.stringify(snapshots.at(-1)!.population)}`,
        )
      }

      const first = snapshots[0]!.population
      const last = snapshots.at(-1)!.population
      const driftedKeys = new Set([...Object.keys(first), ...Object.keys(last)])
      const drift = [...driftedKeys]
        .map((key) => ({ key, first: first[key] ?? 0, last: last[key] ?? 0 }))
        .filter((entry) => entry.first !== entry.last)
      if (drift.length > 0) {
        console.log(`drift between cycle 1 and cycle ${CYCLES}:`, drift)
      }

      // The repository's own subscription path must be flat: every dimension
      // consumer shares ONE native renderer listener through
      // `subscribeSharedEvent`, so a growing `CliRenderer:resize` count is our
      // defect.
      expect(drift.filter((entry) => entry.key.endsWith(':resize'))).toEqual([])

      // Characterisation of what the measurement found: the two OpenTUI-owned
      // subscriptions (`selection` on the renderer, `keypress` on the internal
      // key handler) grow by one per mount/unmount cycle. Tighten this to zero
      // in the same change as the repair, never below it silently.
      for (const key of [
        'CliRenderer:selection',
        'InternalKeyHandler:keypress',
      ]) {
        const growth = (last[key] ?? 0) - (first[key] ?? 0)
        expect(growth).toBeGreaterThanOrEqual(0)
        expect(growth).toBeLessThanOrEqual(CYCLES - 1)
      }
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 120_000)
})
