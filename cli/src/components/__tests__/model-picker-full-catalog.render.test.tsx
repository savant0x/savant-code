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
 * opened on the 4,075-row dev catalog while the process stayed healthy and
 * frames kept ticking. The dev console buffer was read back as 123x76 of
 * spaces with the default attribute, so the renderer committed an empty
 * frame rather than losing the terminal. This suite mounts the real picker at
 * the operator's terminal size and checks that a frame is actually produced.
 */
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

async function frameNonSpace(models: OpenRouterModel[]): Promise<number> {
  const setup = await createTestRenderer({
    width: 123,
    height: 76,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(
      <ModelPicker
        models={models}
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
    const frame = setup.captureCharFrame()
    let nonSpace = 0
    for (const char of frame) if (char !== ' ' && char !== '\n') nonSpace += 1
    return nonSpace
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}

describe('model picker — full dev catalog frame', () => {
  test('every catalog size still paints a frame', async () => {
    const sizes = [30, 500, 1500, 3000, 4075]
    const measured: Array<[number, number]> = []
    for (const size of sizes)
      measured.push([size, await frameNonSpace(catalog(size))])
    const blank = measured.filter(([, nonSpace]) => nonSpace === 0)
    expect({ measured, blank }).toEqual({ measured, blank: [] })
  }, 120_000)

  // The production screen wraps the picker in DialogOverlay (panels.tsx:175),
  // so the mount that blanked the live CLI includes the overlay's absolutely
  // positioned backdrop and its entry animation.
  test('the dialog overlay wrapping the full catalog still paints', async () => {
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
              models={catalog(4075)}
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
      const frame = setup.captureCharFrame()
      let nonSpace = 0
      for (const char of frame) if (char !== ' ' && char !== '\n') nonSpace += 1
      expect(nonSpace).toBeGreaterThan(0)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 120_000)
})
