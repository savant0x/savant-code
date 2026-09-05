/**
 * FID-2026-0822-012 asset pass — robot figure factory.
 *
 * Loads the vendored CC0 rigged robot (`public/floor-assets/robots/
 * robot.glb` — Quaternius' RobotExpressive, per ASSET-MANIFEST.md) once and
 * assembles per-role cast figures: SkeletonUtils clones (skinned meshes need
 * bone-deep copies, not Object3D.clone), height-normalized, skinned in a
 * per-role emissive hologram material — dark chassis + accent emissive under
 * the stage lights. The research doc's single-pass glow: a bright emissive
 * base beats a bloom pass for our frame budget. An AnimationMixer drives the
 * model's Idle / Walking clips; reduced motion freezes the mixer entirely.
 *
 * The loader never throws: a missing or corrupt asset resolves null and the
 * walker layer falls back to a solid minimal silhouette (never the hated
 * wireframe — operator directive 2026-08-24).
 *
 * Decomposition: cast constants live in `deck-robots-constants.ts`, the
 * template loader in `deck-robots-loader.ts`, the GLB figure factory in
 * `deck-robots-figure.ts`, and the fallback silhouette in
 * `deck-robots-fallback.ts`. All are re-exported here so the
 * `./deck-robots` import surface is unchanged.
 */

export * from './deck-robots-constants'
export * from './deck-robots-fallback'
export * from './deck-robots-figure'
export * from './deck-robots-loader'
