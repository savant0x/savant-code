import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { blendHex, NEON_GREEN, NEON_RED } from '../../../utils/diff-stats'
import { CopyableBlock } from '../../blocks/copyable-block'
import { DiffStatsBar, DiffViewer } from '../diff-viewer'

initializeThemeStore()

describe('DiffViewer (FID-2026-0816-009 redesign)', () => {
  test('frames the diff with a header strip (file path + +N −N counts)', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '@@ -1,3 +1,3 @@',
      ' const ctx',
      '-old',
      '+new',
    ].join('\n')

    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    // Header strip: file path (extracted from diff --git b/ side) + counts.
    expect(markup).toContain('src/app.ts')
    expect(markup).toContain('+1 −1')
    // Muted metadata row keeps the raw header line visible.
    expect(markup).toContain('diff --git')
    // Hunk row preserved as a bar.
    expect(markup).toContain('@@ -1,3 +1,3 @@')
  })

  test('tints added/removed rows and renders sign gutter + content', () => {
    const diff = '@@ -1,3 +1,3 @@\n const c = 1\n-old\n+new\n'
    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    const activeBackground = useThemeStore.getState().theme.background
    const greenBg = blendHex(NEON_GREEN, activeBackground, 0.5)
    const redBg = blendHex(NEON_RED, activeBackground, 0.5)

    expect(markup).toContain(greenBg)
    expect(markup).toContain(redBg)
    // Content now lives in its own column (marker moved to the sign gutter).
    expect(markup).toContain('new')
    expect(markup).toContain('old')
    expect(markup).toContain('const c = 1')
  })

  test('renders old/new line numbers in the gutter from hunk starts', () => {
    const diff = '@@ -14,2 +24,2 @@\n keep\n- bye\n+ hi\n'
    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    // Context row: old 14 / new 24. Remove row: old 15 (no new). Add row:
    // new 25 (no old). Numbers render as standalone text nodes.
    expect(markup).toMatch(/>14<\//)
    expect(markup).toMatch(/>15<\//)
    expect(markup).toMatch(/>24<\//)
    expect(markup).toMatch(/>25<\//)
  })

  test('does not tint context, hunk, or header rows with the add/remove blends', () => {
    const diff = 'diff --git a/f b/f\n@@ -1 +1 @@\n context\n'
    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    const activeBackground = useThemeStore.getState().theme.background
    const greenBg = blendHex(NEON_GREEN, activeBackground, 0.5)
    const redBg = blendHex(NEON_RED, activeBackground, 0.5)

    expect(markup).not.toContain(greenBg)
    expect(markup).not.toContain(redBg)
    expect(markup).toContain('context')
  })

  test('labels the header EDIT when no file path can be extracted (not bare "diff")', () => {
    // No `+++ b/...` or `diff --git` line → getDiffHeaderPath returns ''.
    const diff = '@@ -1,3 +1,3 @@\n const c = 1\n-old\n+new\n'
    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    expect(markup).toContain('EDIT')
    expect(markup).not.toContain('>diff<')
  })
})

describe('DiffStatsBar (FID-2026-0804-010)', () => {
  test('renders the [-N/+M] counter with removed first', () => {
    const markup = renderToStaticMarkup(<DiffStatsBar removed={5} added={20} />)
    expect(markup).toContain('[-5/+20]')
  })

  test('renders zero/zero', () => {
    const markup = renderToStaticMarkup(<DiffStatsBar removed={0} added={0} />)
    expect(markup).toContain('[-0/+0]')
  })

  test('sits immediately left of the copy button in the CopyableBlock footer row', () => {
    const markup = renderToStaticMarkup(
      <CopyableBlock
        getCopyText={() => 'body text'}
        footerLeft={<DiffStatsBar removed={2} added={3} />}
      >
        <text>diff body</text>
      </CopyableBlock>,
    )

    const bodyIndex = markup.indexOf('diff body')
    const statsIndex = markup.indexOf('[-2/+3]')
    const copyIndex = markup.indexOf('⎘')

    expect(bodyIndex).toBeGreaterThan(-1)
    expect(statsIndex).toBeGreaterThan(-1)
    expect(copyIndex).toBeGreaterThan(-1)
    // Same footer row: body first, counter next, copy button last.
    expect(bodyIndex).toBeLessThan(statsIndex)
    expect(statsIndex).toBeLessThan(copyIndex)
  })
})
