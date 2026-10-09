/**
 * SavantMark (FID-2026-1009-004 Phase 0)
 *
 * The production TUI consumer for the icon family: renders the Savant logo
 * as an inline terminal image (iTerm2/Kitty protocols via terminal-images.ts)
 * where the surface previously hardcoded the ASCII `<Branding text="S">`.
 *
 * Law 14: when the terminal has no inline-image protocol — the common case —
 * the component renders the same ASCII/Glyph fallback the surface had before,
 * so a raster miss ALWAYS degrades to text, never an error, and the visual
 * identity is never lost. The escape sequence is rendered exactly like the
 * image-card precedent (`<text>{sequence}</text>`).
 */

import React from 'react'

import { Branding } from './branding'
import { savantRasterDataUri } from '../../hooks/use-savant-raster'
import {
  renderInlineImage,
  supportsInlineImages,
} from '../../utils/terminal-images'

export interface SavantMarkProps {
  /** Rendered when the terminal cannot show inline images. */
  fallback: React.ReactNode
}

/**
 * Inline raster mark for supported terminals; `fallback` otherwise.
 * The sequence is built from the generated family PNG (single source of
 * truth: art/icons/cyberpunk/ via cli/scripts/generate-savant-icons.ts).
 */
export function SavantMark({ fallback }: SavantMarkProps) {
  if (!supportsInlineImages()) {
    return <>{fallback}</>
  }
  const dataUri = savantRasterDataUri('ICON_Logo')
  if (!dataUri) {
    return <>{fallback}</>
  }
  const sequence = renderInlineImage(dataUri.replace(/^data:image\/png;base64,/, ''), {
    width: 4, // cells — same footprint the ASCII "S" occupies (2 rows + margin)
    height: 2,
  })
  if (!sequence) {
    return <>{fallback}</>
  }
  return <text>{sequence}</text>
}

// Re-export Branding so callers can pass the fallback inline as a child of
// this module's import surface without dragging a second import.
export { Branding as SavantMarkFallback }
