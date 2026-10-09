import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { contrastRatio } from '@savant-code/design-systems'
import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import stringWidth from 'string-width'

import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { loadFids } from '../../utils/fid-loader'
import {
  contextDisplay,
  sidebarActivity,
  sidebarDensity,
  sidebarEllipsis,
  sidebarPhase,
} from '../right-sidebar-display'
import {
  createSidebarFocusController,
  SidebarFocusContext,
} from '../right-sidebar-focus'
import { SidebarActiveFids, SidebarSession } from '../right-sidebar-sections'
import { readableSidebarColor } from '../right-sidebar-theme'
import { FidCard } from '../savant-ui/echo/fid-card'
import { TokenMeter } from '../savant-ui/echo/token-meter'

initializeThemeStore()

describe('command console data contracts', () => {
  test('disk titles, colliding sequence numbers and full paragraphs reach cards', () => {
    const directory = mkdtempSync(join(tmpdir(), 'savant-sidebar-fids-'))
    try {
      for (const date of ['1008', '1009'])
        writeFileSync(
          join(directory, `FID-2026-${date}-001.md`),
          `# FID: Repair ${date}\n\n**ID:** FID-2026-${date}-001\n**Status:** converged\n**Severity:** high\n\n## Summary\n\nFirst ${date} paragraph.\n\nSecond ${date} paragraph with the full description.\n`,
        )
      const controller = createSidebarFocusController()
      controller.folds.set('FIDs', true)
      for (const fid of loadFids(directory)) controller.folds.set(fid.id, true)
      const markup = renderToStaticMarkup(
        <SidebarFocusContext.Provider value={controller}>
          <SidebarActiveFids fids={loadFids(directory)} archivedCount={0} />
        </SidebarFocusContext.Provider>,
      )
      for (const date of ['1008', '1009']) {
        expect(markup).toContain(`Repair ${date}`)
        expect(markup).toContain(`FID-2026-${date}-001`)
        expect(markup).toContain(
          `Second ${date} paragraph with the full description.`,
        )
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
  test('dark, light and custom tokens retain readable text against hover and surface', () => {
    try {
      for (const name of ['dark', 'light'] as const) {
        useThemeStore.getState().setThemeName(name)
        const theme = useThemeStore.getState().theme
        for (const color of [
          theme.primary,
          theme.muted,
          theme.warning,
          theme.error,
          theme.foreground,
        ]) {
          const readable = readableSidebarColor(theme, color)
          expect(contrastRatio(readable, theme.surface)).toBeGreaterThanOrEqual(
            4.5,
          )
          expect(
            contrastRatio(readable, theme.surfaceHover),
          ).toBeGreaterThanOrEqual(4.5)
        }
        const custom = {
          ...theme,
          primary: theme.surface,
          muted: theme.surfaceHover,
        }
        expect(
          contrastRatio(
            readableSidebarColor(custom, custom.primary),
            custom.surface,
          ),
        ).toBeGreaterThanOrEqual(4.5)
      }
    } finally {
      useThemeStore.getState().setThemeName('dark')
    }
  })
  test('density uses allocated rows and starts conservatively', () => {
    for (const height of [0, 1, 11])
      expect(sidebarDensity(height)).toBe('minimal')
    for (const height of [12, 19])
      expect(sidebarDensity(height)).toBe('compact')
    expect(sidebarDensity(20)).toBe('spacious')
  })
  test('context thresholds and exact over-limit values', () => {
    for (const [used, band] of [
      [0, 'normal'],
      [69, 'normal'],
      [70, 'warning'],
      [99, 'warning'],
      [100, 'error'],
      [120, 'error'],
    ] as const) {
      expect(contextDisplay(used, 100).band).toBe(band)
      const markup = renderToStaticMarkup(<TokenMeter used={used} max={100} />)
      expect(markup).toContain(`${used}/100`)
      expect(markup).toContain(`${used}%`)
    }
  })
  test('unknown values never invent a numeric percent', () => {
    for (const max of [0, -1, NaN, Infinity]) {
      expect(contextDisplay(0, max).label).toBe('Window unknown')
      expect(
        renderToStaticMarkup(<TokenMeter used={0} max={max} />),
      ).not.toContain('0%')
    }
    for (const used of [-1, NaN, Infinity])
      expect(contextDisplay(used, 100).label).toBe('Usage unknown')
  })
  test('canonical lifecycle wins stale activity; feedback does not become work', () => {
    expect(sidebarActivity('tool', { kind: 'paused' }).label).toContain(
      'Paused',
    )
    expect(sidebarActivity('tool', { kind: 'retrying' }).label).toBe('Retrying')
    expect(sidebarActivity('tool', { kind: 'connecting' }).label).toBe(
      'Connecting',
    )
    expect(sidebarActivity('idle', { kind: 'streaming' }).label).toBe(
      'Responding',
    )
    expect(
      sidebarActivity('idle', { kind: 'clipboard', message: 'Copied' }).label,
    ).toBe('Idle · ready')
    expect(sidebarActivity('new-kind').label).toContain('Unknown activity')
    expect(sidebarPhase('new-phase')).toContain('Unknown phase')
  })
  test('wide graphemes fit a bounded summary with an explicit marker', () => {
    const result = sidebarEllipsis('模型 👩‍💻 é '.repeat(20), 35)
    expect(stringWidth(result)).toBeLessThanOrEqual(35)
    expect(result).toEndWith('…')
  })
  test('provenance and reported cache remain visible in diagnostics', () => {
    for (const windowSource of [
      'catalog',
      'fallback-table',
      'default',
    ] as const) {
      const markup = renderToStaticMarkup(
        <SidebarSession
          model="vendor/full-model"
          mode="default"
          cost={0}
          tokensUsed={0}
          tokensMax={100}
          windowSource={windowSource}
          agent="main-agent"
          compactionStatus={{ label: 'blocked (reason)', warning: true }}
          compactionCount={1}
        />,
      )
      expect(markup).toContain(
        windowSource === 'fallback-table' ? 'table' : windowSource,
      )
      expect(markup).toContain('blocked (reason)')
      expect(markup).toContain('Cache')
    }
  })
  test('loading FIDs differs from empty; every title reaches its card', () => {
    const controller = createSidebarFocusController()
    controller.folds.set('FIDs', true)
    const render = (loading: boolean) =>
      renderToStaticMarkup(
        <SidebarFocusContext.Provider value={controller}>
          <SidebarActiveFids fids={[]} archivedCount={4} isLoading={loading} />
        </SidebarFocusContext.Provider>,
      )
    expect(render(true)).toContain('Loading FIDs')
    expect(render(true)).not.toContain('(none active)')
    expect(render(false)).toContain('(none active)')
    const markup = renderToStaticMarkup(
      <FidCard
        id="FID-2026-1008-001"
        title="Repair the loader"
        severity="critical"
        status="converged"
        summary={'First paragraph\n\nSecond paragraph'}
        expanded
      />,
    )
    for (const value of [
      'Repair the loader',
      '2026-1008-001',
      'critical',
      'converged',
      'Second paragraph',
    ])
      expect(markup).toContain(value)
    expect(markup).not.toMatch(/<text[^>]*>[^<]*<text/)
  })
})
