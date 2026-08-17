import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../hooks/use-theme'
import { NagBubble } from '../easter-egg-logo'

initializeThemeStore()

describe('EasterEggLogo overlays (FID-2026-0816-008)', () => {
  test('nag bubble renders the message as a small centered card', () => {
    const markup = renderToStaticMarkup(
      <NagBubble message="Ouch!" onDone={() => {}} />,
    )
    expect(markup).toContain('Ouch!')
    // Small bubble chrome (rounded border), not a full-screen dialog.
    expect(markup).toContain('rounded')
    // Centered on the terminal: absolutely positioned full-viewport layer
    // that flex-centers its child (no top-right anchoring, no backdrop).
    expect(markup).toContain('absolute')
    expect(markup).toContain('center')
  })
})
