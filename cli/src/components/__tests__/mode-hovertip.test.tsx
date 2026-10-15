import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../hooks/use-theme'
import { MODE_CONTROL_HEIGHT, ModeHovertip } from '../mode-hovertip'

initializeThemeStore()

describe('ModeHovertip (FID-2026-0805-001)', () => {
  test('renders the description text', () => {
    const markup = renderToStaticMarkup(
      <ModeHovertip text="Full ECHO Perfection Loop for every change." />,
    )
    expect(markup).toContain('Full ECHO Perfection Loop for every change.')
  })

  test('renders nothing for empty text', () => {
    const markup = renderToStaticMarkup(<ModeHovertip text="" />)
    expect(markup).toBe('')
  })

  test('anchors above the control with the default offset', () => {
    const markup = renderToStaticMarkup(<ModeHovertip text="Default mode." />)
    expect(markup).toContain('position:absolute')
    expect(markup).toContain(`bottom:${MODE_CONTROL_HEIGHT}px`)
  })

  test('honors a custom offset (collapsed button)', () => {
    const markup = renderToStaticMarkup(
      <ModeHovertip text="Default mode." offsetBottom={1} />,
    )
    expect(markup).toContain('bottom:1px')
  })
})
