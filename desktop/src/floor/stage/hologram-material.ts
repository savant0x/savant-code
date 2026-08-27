/**
 * FID-2026-0822-012 asset pass — the single hologram material recipe.
 *
 * One truth for every hologram surface on the deck (robot cast, fallback
 * silhouettes, station pedestals): dark metal chassis + accent emissive
 * under the stage lights. The research doc's single-pass glow — a bright
 * emissive base beats a bloom post-processing pass for our frame budget,
 * and survives webglcontextrestored rebuilds untouched.
 */

import { Color, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import { DECK_TOKENS } from '../deck-tokens.generated'

/** Landmark emissive level — stations glow steadily between robot states
 * (standby 0.32 / active 0.95 in the cast; stations sit between). */
export const STATION_EMISSIVE = 0.45

export interface HologramOptions {
  /** <1 renders the body translucent so inner scan-lattice detail reads
   * through — the projection look (operator direction 2026-08-25 01:10). */
  readonly opacity?: number
}

/** Build one hologram material for an accent color at an emissive level. */
export function createHologramMaterial(
  accent: string,
  emissiveIntensity: number,
  options: HologramOptions = {},
): MeshStandardMaterial {
  const opacity = options.opacity ?? 1
  return new MeshStandardMaterial({
    color: new Color(DECK_TOKENS.surface),
    emissive: new Color(accent),
    emissiveIntensity,
    metalness: 0.55,
    roughness: 0.4,
    transparent: opacity < 1,
    opacity,
  })
}

/** Inner scan-lattice: a wireframe twin drawn over a solid hologram surface
 * reads as the structure inside the projection (accent-colored, additive-
 * friendly low alpha). Callers share geometry with the solid mesh and must
 * dispose the returned material themselves. */
export function createStrokeMaterial(
  accent: string,
  opacity = 0.35,
): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: new Color(accent),
    wireframe: true,
    transparent: true,
    opacity,
    depthWrite: false,
  })
}
