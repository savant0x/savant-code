/**
 * Holo Frame design tokens (FID-2026-1009-008 Phase 1 preview).
 *
 * The operator's preferred sidebar style — design #8 "Holo Frame" from
 * dev/fixtures/sidebar-style-samples.html: raised inner panels with a
 * magenta-tinted border, a lifted `#14141c` panel fill and magenta section
 * titles on a centered header.
 *
 * Everything here is text-native: rounded borders, background fills, colored
 * titles and centered alignment — no raster images and no terminal graphics
 * protocol. The tokens mirror the fixture's `.d8` rules so the terminal
 * preview stays recognizably the same design.
 */

/** Raised panel fill — the fixture's `--surface-2`. */
export const HOLO_PANEL_FILL = '#14141c'

/** Panel border — the fixture's magenta-tinted `#3a1733`. */
export const HOLO_PANEL_BORDER = '#3a1733'

/** Section titles — the fixture's `--magenta`. */
export const HOLO_TITLE = '#ff2bd6'

/** Masthead copy — the fixture's centered-header treatment. */
export const HOLO_SUBTITLE = 'HOLO FRAME · ONE MIND'
