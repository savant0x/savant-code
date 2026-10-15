import { describe, expect, test } from 'bun:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { initializeThemeStore } from '../../../../hooks/use-theme'
import { chatThemes } from '../../../../utils/theme-system/palette'
import { Badge } from '../badge'

initializeThemeStore()

// FID-2026-0822-007: Badge severity variants must resolve from ChatTheme
// semantic tokens (never inline hex). Each variant maps to the documented
// token key — assert the rendered fg equals the theme value for every variant.
describe('Badge tone map (FID-2026-0822-007)', () => {
  const theme = chatThemes.dark

  const expected: Array<[string, string]> = [
    ['open', theme.primary],
    ['closed', theme.success],
    ['critical', theme.error],
    ['high', theme.warning],
    ['medium', theme.link],
    ['low', theme.muted],
    ['info', theme.link],
    ['success', theme.success],
    ['warning', theme.warning],
    ['error', theme.error],
  ]

  test('every variant resolves to its semantic token in the dark theme', () => {
    for (const [variant, token] of expected) {
      const markup = renderToStaticMarkup(
        <Badge variant={variant as 'info'}>{variant}</Badge>,
      )
      // The rendered fg must equal the TOKEN's value from the palette (the
      // token authority). The no-inline-hex gate is a SOURCE-level check on
      // components/ — rendered output legitimately carries palette values.
      expect(markup).toContain(`fg="${token}"`)
    }
  })

  test('unknown variant falls back to theme.muted', () => {
    const markup = renderToStaticMarkup(
      <Badge variant={'bogus' as 'info'}>x</Badge>,
    )
    expect(markup).toContain(`fg="${theme.muted}"`)
  })
})
