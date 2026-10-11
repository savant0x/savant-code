/**
 * Savant icon-set palette — the vector tokens the hand-authored icon
 * families in `art/icons/cyberpunk/` use. Cyan/magenta/blue mirror the
 * chat theme's cyberdeck accents; green and acid extend the semantic
 * set (verification/complete marks, partial/caveat marks) beyond the
 * four theme roles. The icon manifest cites this module as its palette
 * source, so the tokens have exactly one home.
 */
export const ICON_PALETTE = {
  cyan: '#18faf9', // structure — circuit traces, frames
  magenta: '#ff2bd6', // mind/energy — cores, alert accents
  blue: '#4fa8ff', // frame — HUD brackets, pending cells
  white: '#ffffff', // hot centers
  green: '#3dff9a', // verification — complete, success, active
  acid: '#f3e600', // caveat — partial, warning
} as const

export type IconPalette = typeof ICON_PALETTE
