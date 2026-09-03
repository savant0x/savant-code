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

/** Landmark emissive level — stations glow steadily between robot states
 * (standby 0.32 / active 0.95 in the cast; stations sit between). */
export const STATION_EMISSIVE = 0.45

/**
 * FID-2026-0828-002 B: the body must read as its ROLE accent, not the
 * stage lighting. The previous recipe (near-black `surface` base +
 * metalness 0.55) let the cyan key/fill lights dominate the metallic
 * diffuse response, so every figure rendered the reigning scene tint and
 * the accent never read. Fix: tint the base toward the accent (dark, so
 * the chassis stays dark) and drop metalness so the lights cannot
 * re-tint the body; the emissive then carries the role hue.
 */
export const ROBOT_METALNESS = 0.2
export const ROBOT_ROUGHNESS = 0.45

export interface HologramOptions {
  /** <1 renders the body translucent so inner scan-lattice detail reads
   * through — the projection look (operator direction 2026-08-25 01:10). */
  readonly opacity?: number
}

/** Build one hologram material for an accent color at an emissive level.
 * The body base is a dark tint OF THE ACCENT (not the neutral surface), so
 * diffuse + emissive agree on the role hue under any lighting rig. */
export function createHologramMaterial(
  accent: string,
  emissiveIntensity: number,
  options: HologramOptions = {},
): MeshStandardMaterial {
  const opacity = options.opacity ?? 1
  const accentColor = new Color(accent)
  // Dark-accent base: 50% of the accent — the deck must be unmistakably
  // alive (FID-2026-0829-001 L1). At 0.35 the diffuse was still dim enough
  // to read as scene tint under bright lighting; 0.50 makes the body read
  // the accent even at standby, while keeping the chassis dark. */
  const bodyBase = accentColor.clone().multiplyScalar(0.5)
  return new MeshStandardMaterial({
    color: bodyBase,
    emissive: accentColor,
    emissiveIntensity,
    metalness: ROBOT_METALNESS,
    roughness: ROBOT_ROUGHNESS,
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
