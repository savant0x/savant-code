import { ScrollBoxRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'

import { initializeThemeStore } from '../../hooks/use-theme'
import { DialogOverlay } from '../dialog-overlay'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'
import type { Renderable } from '@opentui/core'

initializeThemeStore()

/**
 * FID-2026-1018-008: the live CLI blanked its whole screen when `/model`
 * opened while the process stayed healthy and frames kept ticking; reading
 * the dev console back showed 123x76 of spaces with the default attribute,
 * i.e. an empty render tree rather than a lost terminal.
 *
 * These mounts use the dev catalog's real size (4,075 rows), both bare and
 * inside the production DialogOverlay wrapper, and assert that the picker
 * mounts only its viewport window instead of one row per model. Before the fix
 * this exact mount exhausted the native allocator mid-commit, the error
 * boundary's own `<text>` fallback failed the same way, and React unmounted
 * the root — the blank screen this FID tracks.
 */
const PROVIDERS = ['openai', 'anthropic', 'google', 'meta', 'mistral', 'qwen']
const CATALOG_SIZE = 4_075

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

/** Rows the picker actually mounted under its scrollbox. */
function mountedRows(root: Renderable): number {
  const scroll = findScrollbox(root)
  if (!scroll) throw new Error('model picker scrollbox did not render')
  return scroll.getChildren().length
}

function findScrollbox(node: Renderable): ScrollBoxRenderable | undefined {
  if (node instanceof ScrollBoxRenderable) return node
  for (const child of node.getChildren()) {
    const found = findScrollbox(child)
    if (found) return found
  }
  return undefined
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
      expect(mountedRows(setup.renderer.root)).toBeLessThanOrEqual(12)
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
      expect(mountedRows(setup.renderer.root)).toBeLessThanOrEqual(12)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)
})
