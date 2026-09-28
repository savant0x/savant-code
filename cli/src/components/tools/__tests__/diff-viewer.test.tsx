import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// TrafficLightPanel mounts TrafficLights whose hooks throw under static
// render without these inert @opentui/react stubs.
import { mockOpentuiReactForStaticRender } from './helpers/mock-opentui-react-static'
import { initializeThemeStore, useThemeStore } from '../../../hooks/use-theme'
import { blendHex, NEON_GREEN, NEON_RED } from '../../../utils/diff-stats'
import { DiffViewer } from '../diff-viewer'

mockOpentuiReactForStaticRender()
initializeThemeStore()

describe('DiffViewer (FID-2026-0816-009 redesign)', () => {
  test('frames the diff in traffic-lights chrome with a header strip (file path + +N -N counts)', () => {
    // Two hunks, so a hunk row still renders after the FIRST is suppressed.
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '@@ -1,3 +1,3 @@',
      ' const ctx',
      '-old',
      '+new',
      '@@ -20,2 +20,2 @@',
      '-oldTail',
      '+newTail',
    ].join('\n')

    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

    // Traffic-light title bar (shared TrafficLightPanel chrome).
    expect(markup).toContain('●')
    // Header strip: file path (extracted from diff --git b/ side) + counts.
    expect(markup).toContain('src/app.ts')
    expect(markup).toContain('+2 -2')
    // Muted metadata row keeps the raw header line visible.
    expect(markup).toContain('diff --git')
    // The SECOND hunk row renders (the first is suppressed — see the
    // suppression test below).
    expect(markup).toContain('@@ -20,2 +20,2 @@')
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

  test('renders a surviving @@ hunk row as muted metadata, not the diff accent (FID-2026-0927-004)', () => {
    // TWO hunks, so the second one renders and there is a real hunk row to
    // assert on. With a single hunk the row is suppressed entirely and there
    // would be nothing to colour-check — which is exactly how a colour test
    // silently becomes vacuous.
    const diff = [
      '@@ -1,3 +1,3 @@',
      ' const c = 1',
      '-old',
      '+new',
      '@@ -20,2 +20,2 @@',
      ' tail',
    ].join('\n')
    const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)
    const theme = useThemeStore.getState().theme

    // POSITIVE assertion, scoped to the hunk row itself. A whole-document
    // `toContain(theme.diffMeta)` would be VACUOUS: in the dark palette
    // `muted` and `diffMeta` are BOTH '#8f8f99', so the gutter spans already
    // satisfy it and the test would pass with the hunk row still teal. The
    // regex reads the foreground of the span that literally wraps `@@`, which
    // only the hunk row can produce.
    const hunkForeground = markup.match(/<span fg="([^"]+)">@@/)?.[1]
    expect(hunkForeground).toBe(theme.diffMeta)

    // And the hunk row carries NO background tint. Scoped the same way: the
    // `<box ...>` immediately opening the row that contains `@@`.
    const rowStart = markup.lastIndexOf('<box', markup.indexOf('>@@'))
    const hunkRowTag = markup.slice(rowStart, markup.indexOf('>', rowStart) + 1)
    expect(hunkRowTag).not.toContain('background-color')

    // Retained as a whole-document regression: the accent hex must be gone
    // from the panel entirely, so no row reintroduces it.
    expect(markup).not.toContain(theme.diffHunkHeader)
  })

  // ---------------------------------------------------------------------------
  // Operator directive 2026-09-27: suppress the FIRST hunk row.
  // ---------------------------------------------------------------------------
  describe('first-hunk-row suppression', () => {
    test('drops the leading @@ row in a single-hunk diff', () => {
      // The first `@@` only restates the start numbers the gutter already
      // prints on the rows below it, so in a single-hunk diff the row is
      // dropped entirely and the panel starts at the change content.
      const diff = '@@ -1,3 +1,3 @@\n ctx\n-old\n+new\n'
      const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

      expect(markup).not.toContain('@@')
      // The change content is untouched.
      expect(markup).toContain('old')
      expect(markup).toContain('new')
    })

    test('keeps LATER @@ rows — they mark real elisions in a multi-hunk diff', () => {
      // Suppressing every hunk row would hide the discontinuity between line
      // 3 and line 20, which no other row communicates. Only the first goes.
      const diff = '@@ -1,3 +1,3 @@\n ctx\n@@ -20,2 +20,2 @@\n-old\n+new\n'
      const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

      expect(markup).not.toContain('@@ -1,3 +1,3 @@')
      expect(markup).toContain('@@ -20,2 +20,2 @@')
    })

    test('suppression is DISPLAY-ONLY — gutter numbering still works', () => {
      // THE regression guard. `parseDiffLines` owns the counter reset
      // (`diff-stats.ts:120`), so implementing this in the parser instead of
      // the renderer would leave both counters at 0 and blank the gutter on
      // every row — a "cosmetic" change that silently destroys line numbers.
      const diff = '@@ -14,2 +24,2 @@\n keep\n- bye\n+ hi\n'
      const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

      // The row is gone…
      expect(markup).not.toContain('@@')
      // …but every number it seeded is still rendered.
      expect(markup).toMatch(/>14<\//)
      expect(markup).toMatch(/>15<\//)
      expect(markup).toMatch(/>24<\//)
      expect(markup).toMatch(/>25<\//)
    })

    test('a diff with no hunk row is unaffected', () => {
      // `extractDiff`'s construction paths (constructDiffFromReplacements /
      // constructDiffFromWriteFile) emit no `@@` at all. `findIndex` returns
      // -1 there, which must not match any real index and drop a row.
      const diff = '- old\n+ new\n+ added\n'
      const markup = renderToStaticMarkup(<DiffViewer diffText={diff} />)

      expect(markup).toContain('old')
      expect(markup).toContain('new')
      expect(markup).toContain('added')
    })
  })
})
