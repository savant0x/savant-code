/**
 * ASCII Art Branding (FID-2026-0720-033b Phase B Step 3)
 *
 * Renders the Savant header wordmark using OpenTUI's declarative `<ascii-font>`
 * JSX element (registered in @opentui/react baseComponents). Theme-aware color
 * via ChatTheme tokens. Multiple ASCII font styles.
 *
 * Law 14: if the native render lib is unavailable, the parent box renders
 * empty — the TUI remains functional without branding. The declarative
 * element avoids the imperative DOM/cast approach that broke under OpenTUI's
 * own reconciler.
 */

import React from 'react'

import { useTheme } from '../../hooks/use-theme'

import type { ChatTheme } from '../../types/theme-system'

/** ASCII font styles supported by OpenTUI's ASCIIFontRenderable. */
export type BrandingStyle = 'tiny' | 'block' | 'slick' | 'shade'

export interface BrandingProps {
  /** ASCII font style. Defaults to `tiny` (compact, fits header rows). */
  font?: BrandingStyle
  /** Wordmark text. Defaults to `Savant`. */
  text?: string
  /** Theme color key for the wordmark fill. Defaults to `primary`. */
  color?: 'primary' | 'surface' | 'foreground'
}

/**
 * Resolve a BrandingProps color key to a concrete ChatTheme color.
 * Falls back to `theme.primary` if absent (defensive — never throws, Law 14).
 */
const resolveBrandingColor = (
  theme: ChatTheme,
  key: NonNullable<BrandingProps['color']>,
): string => {
  const value = theme[key]
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return theme.primary
}

export function Branding({
  font = 'tiny',
  text = 'Savant',
  color = 'primary',
}: BrandingProps) {
  const theme = useTheme()
  const resolvedColor = resolveBrandingColor(theme, color)

  // Declarative <ascii-font> element — OpenTUI React handles lifecycle.
  // If the native lib is unavailable, OpenTUI degrades the renderable safely
  // (the element renders empty rather than crashing the reconciler).
  return <ascii-font text={text} font={font} color={resolvedColor} />
}
