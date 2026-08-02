/**
 * Icon Component (FID-2026-0720-033b Phase B Step 2)
 *
 * Renders a centralized glyph (cli/src/utils/glyphs.ts) with theme-token color.
 * Auto-selects the active font tier (Nerd Font → Unicode → ASCII) and applies
 * the caller's theme color. Size variants pad the glyph for visual balance.
 */

import { TextAttributes } from '@opentui/core'
import React from 'react'

import { resolveThemeColor, type ThemeColorKey } from './icon-theme-keys'
import { useTheme } from '../../hooks/use-theme'
import { glyph, type GlyphName } from '../../utils/glyphs'

export interface IconProps {
  /** Canonical glyph name from the centralized map. */
  name: GlyphName
  /**
   * Theme token key whose color is applied. Defaults to `foreground`.
   * The mapping (key → ChatTheme color) lives in `icon-theme-keys.ts` so
   * this component never references hardcoded hex (Law 13: one truth).
   */
  color?: ThemeColorKey
  /** Optional bold attribute for high-emphasis icons. */
  bold?: boolean
}

/**
 * Inline icon span — composable inside `<text>` (unlike `<text>` itself, which
 * cannot nest in OpenTUI). This is the primary consumer-facing shape: callers
 * compose `<span>...<Icon .../> {label}</span>` or use the raw `glyph()` +
 * `resolveThemeColor()` helpers for tighter control.
 */
export function Icon({ name, color = 'foreground', bold = false }: IconProps) {
  const theme = useTheme()
  const resolvedColor = resolveThemeColor(theme, color)
  const char = glyph(name)

  // <span> composes inside <text>/<box> trees. No padding — callers control
  // spacing (e.g. `{icon} {label}`) to avoid double-space artifacts.
  return (
    <span
      fg={resolvedColor}
      attributes={bold ? TextAttributes.BOLD : undefined}
    >
      {char}
    </span>
  )
}

export { resolveThemeColor } from './icon-theme-keys'
export type { ThemeColorKey } from './icon-theme-keys'
