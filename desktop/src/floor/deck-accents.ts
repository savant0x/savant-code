/**
 * FID-2026-0828-002 — deck accent palette (floor-renderer only).
 *
 * The contract tokens (`DECK_TOKENS`, generated from the design system) are
 * tuned for terminal chrome: saturated neons that pop on dark UI panels. On
 * the 3D floor the same values are consumed by ADDITIVE blending and
 * emissive materials, where saturation compounds — the operator saw the cyan
 * (`#18faf9`) and amber (`#ff9500`) wash the grid into an over-bright glow
 * and the figures read as one undifferentiated neon slab.
 *
 * This module is the single tuning seam for the floor renderer: every
 * deck stage/layer file imports its accents from HERE, never from the raw
 * generated tokens. Chrome (chat UI, analytical SVG) keeps the contract
 * tokens untouched. Values are the contract hues pulled toward pastel
 * (≈78% saturation, +luma) so additive stacking converges instead of
 * clipping; hue direction is unchanged.
 */

import { DECK_TOKENS } from './deck-tokens.generated'

export const DECK_ACCENTS = {
  /** Console + Savant (was #18faf9 — saturated cyan). */
  primary: '#5fd8d8',
  /** Detective (was #22d3ee). */
  inlineCodeFg: '#5ccbd8',
  /** Forge (was #ff9500 — the yellow half of the cyan/yellow wash). */
  warning: '#e0aa4f',
  /** Verifier (was #39ff14 — the green half of the wash). */
  success: '#67d97e',
  /** Recorder (was #e4e4e8 — pure white bloomed hard under additive). */
  foreground: '#c4c4d0',
  /** Thinker (was shared with scribe). */
  muted: '#a8a8b4',
  /** Adversary (was #ff2d55). */
  error: '#e8608a',
  /** Scout — seafoam; split from savant's cyan (FID-2026-0828-002 B). */
  scout: '#7fd4b8',
  /** Researcher — lavender; split from savant's cyan (FID-2026-0828-002 B). */
  researcher: '#b8a6e8',
  /** Scribe — slate; split from thinker's warm muted (FID-2026-0828-002 B). */
  scribe: '#8f9aa8',
} as const

export type DeckAccentKey = keyof typeof DECK_ACCENTS

/** One accent per role id — no collisions (FID-2026-0828-002 B). */
export const ROLE_FLOOR_ACCENTS: Readonly<Record<string, string>> = {
  savant: DECK_ACCENTS.primary,
  detective: DECK_ACCENTS.inlineCodeFg,
  forge: DECK_ACCENTS.warning,
  verifier: DECK_ACCENTS.success,
  recorder: DECK_ACCENTS.foreground,
  thinker: DECK_ACCENTS.muted,
  scout: DECK_ACCENTS.scout,
  researcher: DECK_ACCENTS.researcher,
  scribe: DECK_ACCENTS.scribe,
  adversary: DECK_ACCENTS.error,
}

/** True when the value is a raw contract token the floor must not glow with. */
export function isRawToken(hex: string): boolean {
  return Object.values(DECK_TOKENS).includes(
    hex as (typeof DECK_TOKENS)[keyof typeof DECK_TOKENS],
  )
}
