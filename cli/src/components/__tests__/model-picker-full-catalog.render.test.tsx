import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'

import { initializeThemeStore } from '../../hooks/use-theme'
import { DialogOverlay } from '../dialog-overlay'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'

initializeThemeStore()

/**
 * FID-2026-1018-008: the live CLI blanked its whole screen when `/model`
 * opened while the process stayed healthy and frames kept ticking; reading
 * the dev console back showed 123x76 of spaces with the default attribute,
 * i.e. an empty render tree rather than a lost terminal.
 *
 * These mounts check that a catalog far larger than the 12-row viewport still
 * produces a frame, both bare and inside the production DialogOverlay wrapper.
 *
 * Sizes are deliberately bounded: the same assertion at the full 4,075-row
 * dev catalog was measured ad hoc (it painted — non-space cells present) but
 * could not stay in this suite, because a 4,075-node mount leaves the shared
 * OpenTUI render state disturbed and fails dozens of later render tests in
 * the same `bun test` process.
 */
const PROVIDERS = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'qwen']
const CATALOG_SIZE = 500

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

function nonSpaceCells(frame: string): number {
  let nonSpace = 0
  for (const char of frame) if (char !== ' ' && char !== '\n') nonSpace += 1
  return nonSpace
}

describe('model picker — oversized catalog frame', () => {
  test('a catalog 40x the viewport still paints', async () => {
    const setup = await createTestRenderer({
      width: 123,
      height: 76,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    try {
      root.render(
        <ModelPicker
          models={catalog(CATALOG_SIZE)}
          query=""
          selectedIndex={0}
          onSelectIndex={() => {}}
          onQueryChange={() => {}}
          onSelect={() => {}}
          onClose={() => {}}
          terminalHeight={76}
        />,
      )
      await setup.renderOnce()
      await Bun.sleep(50)
      await setup.renderOnce()
      expect(nonSpaceCells(setup.captureCharFrame())).toBeGreaterThan(0)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)

  // The production screen wraps the picker in DialogOverlay (panels.tsx:175),
  // so the mount that blanked the live CLI includes the overlay's absolutely
  // positioned backdrop and its entry animation.
  test('the dialog overlay wrapping the catalog still paints', async () => {
    const setup = await createTestRenderer({
      width: 123,
      height: 76,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    try {
      root.render(
        <DialogOverlay onClose={() => {}}>
          {() => (
            <ModelPicker
              models={catalog(CATALOG_SIZE)}
              query=""
              selectedIndex={0}
              onSelectIndex={() => {}}
              onQueryChange={() => {}}
              onSelect={() => {}}
              onClose={() => {}}
              terminalHeight={76}
            />
          )}
        </DialogOverlay>,
      )
      await setup.renderOnce()
      await Bun.sleep(400)
      await setup.renderOnce()
      expect(nonSpaceCells(setup.captureCharFrame())).toBeGreaterThan(0)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)
})
