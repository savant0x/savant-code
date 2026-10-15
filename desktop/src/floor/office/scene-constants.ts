// FID-2026-0905-005 — office-scene decomposition: shared constants.
//
// The scene's module-level dimensions and tuning tokens, extracted verbatim
// from office-scene.tsx so the scene-* stage modules share one source.

import { prefersReducedMotion } from './office-motion'

/** Reduced-motion is a boot-time constant in the scene (P5). */
export const REDUCED = prefersReducedMotion()

export const OFFICE_WIDTH = 42
export const OFFICE_DEPTH = 38
export const WALL_HEIGHT = 3.4
// Savant is taller than the cast, so its nameplate rides higher than the
// specialists' (which sit at NAMEPLATE_Y). Kept below the ceiling beams
// (raised in office-props.tsx) so it never pokes through.
export const NAMEPLATE_Y = 2.45

/** The real Savant brand character (assets/logo.png, copied into the
 * desktop public dir for the renderer). */
export const SAVANT_LOGO_URL = '/floor-assets/emblem/savant-logo.png'
/** Which axis a vendored robot GLB faces by default, in radians.
 * 0 = +Z. Quaternius/Khronos rigs face +Z, so travelling direction angle
 * `atan2(dx, dz)` is used directly. If a model read face-backwards, set PI. */
export const MODEL_FORWARD_OFFSET = 0

/** Dark metal desk-top tints rotated per desk so the floor does not read
 * as a single repeated slab. */
export const DESK_METAL_TONES = ['#1c232d', '#222a35', '#181e27'] as const
/** Cast figures normalize to office-world height (pad ring radius 16). */
export const ROBOT_OFFICE_HEIGHT = 1.85

export type LivePositions = Map<string, { x: number; z: number }>
