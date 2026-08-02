import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../../hooks/use-theme'
import { SidebarSection } from '../../primitives/sidebar-section'
import { FidCard } from '../fid-card'
import { FidList } from '../fid-list'

initializeThemeStore()

describe('sidebar startup collapse defaults', () => {
  test('SidebarSection starts folded by default', () => {
    const markup = renderToStaticMarkup(
      <SidebarSection title="Session">
        <text>Session details</text>
      </SidebarSection>,
    )

    expect(markup).toContain('▶')
    expect(markup).toContain('Session')
    expect(markup).not.toContain('Session details')
  })

  test('SidebarSection preserves explicit expanded opt-in', () => {
    const markup = renderToStaticMarkup(
      <SidebarSection title="Session" defaultExpanded>
        <text>Session details</text>
      </SidebarSection>,
    )

    expect(markup).toContain('▼')
    expect(markup).toContain('Session details')
  })

  test('FidCard starts folded by default', () => {
    const markup = renderToStaticMarkup(
      <FidCard
        id="FID-2026-0801-001"
        status="analyzed"
        severity="medium"
        summary="The full FID summary should remain hidden on startup."
      />,
    )

    expect(markup).toContain('▶')
    expect(markup).toContain('FID-001')
    expect(markup).not.toContain('The full FID summary')
  })

  test('FidCard preserves explicit expanded opt-in', () => {
    const markup = renderToStaticMarkup(
      <FidCard
        id="FID-2026-0801-001"
        status="analyzed"
        severity="medium"
        summary="The full FID summary is visible when explicitly requested."
        expanded
      />,
    )

    expect(markup).toContain('▼')
    expect(markup).toContain('The full FID summary is visible')
  })

  test('FidList keeps all cards folded on initial render', () => {
    const markup = renderToStaticMarkup(
      <FidList
        fids={[
          {
            id: 'FID-2026-0801-001',
            status: 'analyzed',
            severity: 'medium',
            summary: 'First FID full summary',
          },
          {
            id: 'FID-2026-0801-002',
            status: 'created',
            severity: 'low',
            summary: 'Second FID full summary',
          },
        ]}
      />,
    )

    expect(markup.match(/▶/g)).toHaveLength(2)
    expect(markup).not.toContain('First FID full summary')
    expect(markup).not.toContain('Second FID full summary')
  })
})
