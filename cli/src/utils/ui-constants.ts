import type { BorderCharacters } from '@opentui/core'

/**
 * Dark text color for focused/inverted controls (dark label on the green
 * `theme.primary` fill). The themes set `background: 'transparent'`, so it
 * can't be used as an inverted-text color — a transparent foreground on the
 * green fill renders the label invisible. This near-black reads cleanly on the
 * bright green fill in both the dark and light themes.
 */
export const INVERTED_CTA_FG = '#10131a'

/**
 * Dimmed backdrop RGBA for the DialogOverlay scrim (FID-2026-0822-007).
 * Report §14.2 verified Porter-Duff blending: the 80-suffix encodes ~50%
 * alpha over the chat surface. Alpha-dependent — cannot be a solid ChatTheme
 * token; promoted here from components/dialog-overlay.tsx (gate-exempt utils/
 * location, INVERTED_CTA_FG precedent).
 */
export const DIALOG_BACKDROP_COLOR = '#00000080'

/**
 * Bright on-fill text anchor for transition-phase (FID-2026-0822-007).
 * White text on dark/red phase fills (luminance < 0.25 floor).
 */
export const ON_FILL_BRIGHT = '#ffffff'

/**
 * Dark on-fill text anchor for transition-phase (FID-2026-0822-007).
 * Black text on bright phase fills (idle gray, cyan, green, amber).
 */
export const ON_FILL_DARK = '#000000'

export const BORDER_CHARS: BorderCharacters = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
}

/** Dashed border characters with rounded corners for ghost/ephemeral UI */
export const DASHED_BORDER_CHARS: BorderCharacters = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '┄',
  vertical: '┆',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
}

/** Square corner border for image cards (separate from the rounded default) */
export const IMAGE_CARD_BORDER_CHARS: BorderCharacters = {
  horizontal: '─',
  vertical: '│',
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
}

/** Dashed border with rounded corners for proposal cards */
export const PROPOSAL_BORDER_CHARS: BorderCharacters = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '┈',
  vertical: '┊',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
}
