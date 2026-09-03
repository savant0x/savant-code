/**
 * FID-2026-0831-001 P3 — neon-noir atmosphere (R3F scene layer).
 *
 * Post-processing and lighting that give the office its cyberpunk read:
 * bloom makes every emissive accent (bodies, desk slabs, signage) glow,
 * vignette pulls the eye to the center console. Calm-when-idle /
 * alive-when-active: the base rig is dim, so only real activity lights up.
 *
 * Perf discipline (carried from the stage): DPR is clamped by the Canvas
 * ([1,2] in OfficeScene); the quality tier here drops post-processing first
 * so low-end GPUs keep a correct scene, just without the glow.
 */

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

import { DECK_TOKENS } from '../deck-tokens.generated'

import type { JSX } from 'react'

/** Bloom intensity — tuned so idle emissive (~0.35) stays dim and active
 * emissive (~2.2) blooms hard. Raises with activity, not with time. */
export const BLOOM_INTENSITY = 0.85
export const BLOOM_LUMINANCE_THRESHOLD = 0.22
export const VIGNETTE_DARKNESS = 0.62

export interface QualityTier {
  readonly postFx: boolean
}

/** Two-tier quality: full post-processing, or bare scene. */
export const QUALITY_TIERS: readonly QualityTier[] = [
  { postFx: true },
  { postFx: false },
]

export function NeonAtmosphere({
  quality = QUALITY_TIERS[0],
}: {
  readonly quality?: QualityTier
}): JSX.Element {
  if (!quality.postFx) return <></>
  return (
    <EffectComposer>
      <Bloom
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        mipmapBlur
      />
      <Vignette darkness={VIGNETTE_DARKNESS} />
    </EffectComposer>
  )
}

/** Neon signage color for the console — single truth for the floor plan. */
export const CONSOLE_SIGN_COLOR = DECK_TOKENS.primary
