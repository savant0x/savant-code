// FID-2026-0906-005 — lazy 3D chunk boundary pins.
//
// The office/stage 3D graph must load through ONE dynamic-import seam:
// `deck-view.tsx` imports the wrapper in `office-lazy.tsx`, never
// `office/office-scene` statically — otherwise Rollup pulls three/R3F back
// into the eager shell chunk and the boundary silently rots. These pins
// hold the structure; the vite build chunk listing is the size evidence
// (pasted in the FID at closure).

import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { DeckChunkLoading } from '../office-lazy'

describe('office-lazy boundary (FID-2026-0906-005)', () => {
  test('chunk placeholder renders the shared spinner + label', () => {
    const html = renderToStaticMarkup(<DeckChunkLoading />)
    expect(html).toContain('deck-chunk-loading')
    expect(html).toContain('ring')
    expect(html).toContain('Loading 3D deck')
  })

  test('wrapper is the dynamic boundary — office-lazy uses import(), never a static import', () => {
    const src = readFileSync(
      new URL('../office-lazy.tsx', import.meta.url),
      'utf8',
    )
    expect(src).toContain("import('./office/office-scene')")
    expect(src).not.toMatch(/from '\.\/office\/office-scene'/)
  })

  test('deck-view imports the wrapper, never office-scene statically', () => {
    const src = readFileSync(
      new URL('../deck-view.tsx', import.meta.url),
      'utf8',
    )
    expect(src).not.toMatch(/from '\.\/office\/office-scene'/)
    expect(src).toContain("from './office-lazy'")
  })

  test('deck-view suspends the lazy scene with the placeholder as fallback', () => {
    const src = readFileSync(
      new URL('../deck-view.tsx', import.meta.url),
      'utf8',
    )
    expect(src).toContain('OfficeSceneLazy')
    expect(src).toContain('DeckChunkLoading')
    expect(src).toContain('<Suspense')
  })
})
