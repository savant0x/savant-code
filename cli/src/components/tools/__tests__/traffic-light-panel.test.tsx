import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore } from '../../../hooks/use-theme'
import { TrafficLightPanel } from '../../traffic-light-panel'

mockOpentuiReactForStaticRender()
initializeThemeStore()

describe('TrafficLightPanel (FID-2026-0822-005)', () => {
  test('renders the three glowing dots and its children inside the panel', () => {
    const markup = renderToStaticMarkup(
      <TrafficLightPanel>
        <text>PANEL_CHILDREN_MARKER</text>
      </TrafficLightPanel>,
    )

    expect(markup).toContain('●')
    expect(markup).toContain('PANEL_CHILDREN_MARKER')
  })

  test('renders title-bar-only chrome without children', () => {
    const markup = renderToStaticMarkup(<TrafficLightPanel />)

    expect(markup).toContain('●')
    expect(markup).not.toContain('PANEL_CHILDREN_MARKER')
  })
})
