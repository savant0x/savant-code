import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { createCliRenderer, ImageRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import React from 'react'

import { HudScene } from './hud-preview-components'
import { renderHudReport } from './hud-preview-report'
import { initializeThemeStore, useThemeStore } from '../src/hooks/use-theme'

import type { HudArt, HudDesign } from './hud-preview-components'
import type { HudCapture } from './hud-preview-report'
import type { Renderable } from '@opentui/core'

function imagesIn(root: Renderable): ImageRenderable[] {
  return root
    .getChildren()
    .flatMap((child) => [
      ...(child instanceof ImageRenderable ? [child] : []),
      ...imagesIn(child),
    ])
}

export async function captureHud(options: {
  design: HudDesign
  art: HudArt
  folded?: boolean
  height?: number
}): Promise<HudCapture> {
  initializeThemeStore()
  const setup = await createTestRenderer({
    width: 100,
    height: options.height ?? 40,
    footerHeight: 0,
    exitOnCtrlC: false,
    backgroundColor: useThemeStore.getState().theme.background,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(<HudScene {...options} />)
    await setup.renderOnce()
    await Bun.sleep(20)
    await setup.renderOnce()
    await Promise.all(
      imagesIn(setup.renderer.root).map((image) => image.loadPromise),
    )
    await setup.renderOnce()
    const failed = imagesIn(setup.renderer.root).find(
      (image) => image.loadError,
    )
    if (failed)
      throw new Error(
        `Native preview image failed: ${String(failed.loadError)}`,
      )
    return {
      label: `${options.design} · ${options.art} · ${options.folded ? 'folded' : 'full'} · 100×${options.height ?? 40}`,
      frame: setup.captureSpans(),
      text: setup.captureCharFrame(),
    }
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}

async function exportComparison(): Promise<void> {
  const captures: HudCapture[] = []
  for (const design of ['circuit', 'holographic', 'holo'] as const) {
    for (const options of [
      { art: 'blocks', height: 40 },
      { art: 'blocks', height: 24 },
      { art: 'blocks', height: 40, folded: true },
      { art: 'text', height: 24 },
    ] as const)
      captures.push(await captureHud({ design, ...options }))
  }
  const dir = join(import.meta.dir, '../../dev/fixtures')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'sidebar-hud-comparison.html'),
    renderHudReport(captures),
  )
  await writeFile(
    join(dir, 'sidebar-hud-comparison.json'),
    JSON.stringify(captures, null, 2),
  )
  console.log(
    `Saved three original-SVG design concepts to dev/fixtures/sidebar-hud-comparison.html; ${captures.length} historical native frames remain in the JSON evidence.`,
  )
}

async function livePreview(): Promise<void> {
  initializeThemeStore()
  const renderer = await createCliRenderer({ exitOnCtrlC: true })
  const root = createRoot(renderer)
  let design: HudDesign = 'circuit'
  let art: HudArt = 'blocks'
  let folded = false
  const foldState = new Map<string, boolean>()
  const paint = () =>
    root.render(
      <HudScene
        design={design}
        art={art}
        folded={folded}
        foldState={foldState}
        onFold={() => {
          folded = !folded
          paint()
        }}
      />,
    )
  renderer.keyInput.on('keypress', (key) => {
    if (key.name === '1') design = 'circuit'
    else if (key.name === '2') design = 'holographic'
    else if (key.name === '3') design = 'holo'
    else if (key.name === 'b') folded = !folded
    else if (key.name === 'a') art = art === 'blocks' ? 'text' : 'blocks'
    else if (key.name === 'q') {
      root.unmount()
      renderer.destroy()
      return
    } else return
    paint()
  })
  paint()
}

if (import.meta.main) {
  try {
    if (process.argv.includes('--live')) await livePreview()
    else await exportComparison()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
