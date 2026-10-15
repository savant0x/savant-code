/**
 * FID-2026-0831-002 P6 — procedural PBR textures for the office deck.
 *
 * Adapted from the MIT-licensed Hermes3D retro-office reference
 * (resources/Hermes3D-main/src/features/retro-office/core/proceduralTextures.ts).
 * Everything is generated at runtime on a 2D canvas — no bundled image
 * assets, no licensing exposure. Each generator returns albedo/roughness
 * maps (normal maps omitted for perf) and results are cached so repeated
 * callers share GPU textures.
 *
 * Determinism: all noise comes from a seeded integer hash, so textures look
 * identical across sessions and machines.
 *
 * Decomposition: shared canvas/noise/cache machinery lives in
 * `procedural-textures/machinery.ts`, and the generators are grouped by
 * texture family — `organic.ts` (wood, plaster, carpet), `cyber.ts` (tech
 * floor, dark panels), and `props.ts` (emblem, brushed metal). All are
 * re-exported here so the `./procedural-textures` import surface is
 * unchanged.
 */

export * from './procedural-textures/cyber'
export type { PbrTextureSet } from './procedural-textures/machinery'
export * from './procedural-textures/organic'
export * from './procedural-textures/props'
