import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { captureHud } from './hud-preview'
import { HudScene } from './hud-preview-components'
import { originalSvgDataUri, renderHudReport } from './hud-preview-report'
import { initializeThemeStore } from '../src/hooks/use-theme'

test('native mouse and keyboard folding preserve section choice across rail toggles', async () => {
  initializeThemeStore()
  const setup = await createTestRenderer({
    width: 100,
    height: 40,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  let folded = false
  const foldState = new Map<string, boolean>()
  const paint = () =>
    root.render(
      <HudScene
        design="circuit"
        art="text"
        folded={folded}
        foldState={foldState}
        onFold={() => {
          folded = !folded
          paint()
        }}
      />,
    )
  const flush = async () => {
    await Bun.sleep(20)
    await setup.renderOnce()
  }
  const find = (id: string) => {
    const control = setup.renderer.root.findDescendantById(id)
    if (!control) throw new Error(`Missing preview control: ${id}`)
    return control
  }
  try {
    paint()
    await flush()
    expect(setup.captureCharFrame()).toContain('Forge')
    const agents = find('preview-section-Active agents')
    await setup.mockMouse.click(agents.x + 1, agents.y)
    await flush()
    expect(setup.captureCharFrame()).not.toContain('Forge')
    const fold = find('preview-fold')
    await setup.mockMouse.click(fold.x + 1, fold.y)
    await flush()
    expect(folded).toBe(true)
    expect(find('preview-sidebar').width).toBe(14)
    find('preview-fold').focus()
    await flush()
    setup.mockInput.pressEnter()
    await flush()
    expect(folded).toBe(false)
    expect(find('preview-sidebar').width).toBe(40)
    expect(setup.captureCharFrame()).not.toContain('Forge')
    find('preview-section-Active agents').focus()
    await flush()
    setup.mockInput.pressKey(' ')
    await flush()
    expect(setup.captureCharFrame()).toContain('Forge')
    expect(setup.captureCharFrame()).toContain('Context · 70/100 · 70%')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
})

test('design concepts embed the original SVG bytes without reconstruction', () => {
  const html = renderHudReport([])
  const references = [
    ...html.matchAll(
      /data-source="([^"]+)"[^>]*src="(data:image\/svg\+xml;base64,[^"]+)"/g,
    ),
  ]
  expect(references.length).toBeGreaterThan(80)
  const files = new Set(references.map((match) => match[1]))
  expect(files.size).toBeGreaterThanOrEqual(20)
  for (const [file, uri] of [...files].map((file) => [
    file,
    originalSvgDataUri(file),
  ])) {
    const source = readFileSync(
      join(import.meta.dir, '../../art/icons/cyberpunk', file),
    )
    expect(Buffer.from(uri.split(',')[1], 'base64').equals(source)).toBe(true)
  }
  expect(html).toContain('01 / Circuit Command Deck')
  expect(html).toContain('02 / Neon Observatory')
  expect(html).toContain('03 / Mission Control')
  expect(html).toContain('Not OpenTUI screenshots')
})

for (const design of ['circuit', 'holographic'] as const) {
  test(`${design} native full preview retains status, artwork and traffic lights`, async () => {
    const capture = await captureHud({ design, art: 'blocks' })
    expect(capture.text).toContain('SYNTHETIC DESIGN PREVIEW')
    expect(capture.text).toContain('Activity detail')
    expect(capture.text).toContain('ECHO · AUDIT')
    expect(capture.text).toContain('synthetic/model')
    expect(capture.text).toContain('Context · 70/100 · 70%')
    expect(capture.text).toContain('Window source · catalog')
    expect(capture.text.match(/●/g)).toHaveLength(3)
    expect(capture.text).toMatch(/[▛▜▐▟▄▀█]/)
    expect(renderHudReport([capture])).toContain(
      'native character-span captures',
    )
  })

  test(`${design} short and folded previews retain footer and labeled navigation`, async () => {
    const short = await captureHud({ design, art: 'text', height: 24 })
    expect(short.text).toContain('Context · 70/100 · 70%')
    expect(short.text).toContain('Activity detail')
    const folded = await captureHud({ design, art: 'blocks', folded: true })
    expect(folded.text).toContain('Agents')
    expect(folded.text).toContain('Session')
    expect(folded.text).toContain('70% demo')
  })
}
