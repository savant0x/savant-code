/**
 * Fallback cast figure: a solid minimal silhouette used only when the GLB
 * cannot load — a dark chassis capsule with an emissive accent core, never a
 * wireframe (operator directive 2026-08-24). Includes the glow helpers it
 * owns. Extracted verbatim from deck-robots.ts.
 */

import {
  AdditiveBlending,
  CanvasTexture,
  CapsuleGeometry,
  Group,
  Mesh,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
} from 'three'

import {
  ACTIVE_EMISSIVE,
  ROBOT_TARGET_HEIGHT,
  STANDBY_EMISSIVE,
} from './deck-robots-constants'
import {
  createHologramMaterial,
  createStrokeMaterial,
} from './hologram-material'

import type { RobotFigure } from './deck-robots-figure'

interface GlowSprite {
  readonly sprite: Sprite
  dispose(): void
}

/** Soft additive halo behind a figure — the projection's light bloom.
 * DOM-free environments (bun tests) skip it; the figure stays structurally
 * identical minus the sprite (Law 14 degradation, nameplate pattern).
 *
 * FID-2026-0828-002 (operator: "the light is a glowing ball, it's become a
 * part of the scene"): the halo sprite scaled with the cast (height 25 ×
 * 1.4 ≈ a 35-unit additive quad dominating the floor) — under the dimmed
 * rig it reads as a giant glowing ball sitting AT item level, exactly the
 * wrong read for a projection bloom. The halo is DISABLED for cast figures:
 * the single-pass emissive glow on the body itself is the hologram light.
 * The DOM-free guard stays for the fallback halo helper contract.
 */
function createGlow(accent: string, height: number): GlowSprite | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx === null) return null
  const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64)
  gradient.addColorStop(0, `${accent}66`)
  gradient.addColorStop(0.45, `${accent}22`)
  gradient.addColorStop(1, '#00000000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  const material = new SpriteMaterial({
    map: texture,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new Sprite(material)
  sprite.scale.set(height * 1.4, height * 1.5, 1)
  sprite.position.y = height * 0.52
  return {
    sprite,
    dispose: () => {
      texture.dispose()
      material.dispose()
    },
  }
}

/** Fallback-figure halo: added INSIDE the normalized root so it inherits
 * the same normalization scaling as the body geometry. */
function glowFallback(accent: string, root: Group): GlowSprite | null {
  const glow = createGlow(accent, 3)
  if (glow === null) return null
  // Pre-normalization units (~3-unit figure): root scaling carries the halo
  // up to cast proportions alongside the body meshes.
  glow.sprite.scale.set(2.6, 2.8, 1)
  glow.sprite.position.y = 1.0
  root.add(glow.sprite)
  return glow
}

/**
 * Solid minimal silhouette used only when the GLB cannot load — a dark
 * chassis capsule with an emissive accent core. Never a wireframe
 * (operator directive 2026-08-24).
 */
export function buildFallbackFigure(accent: string): RobotFigure {
  const material = createHologramMaterial(accent, STANDBY_EMISSIVE, {
    opacity: 0.92,
  })
  const root = new Group()
  // Geometry is authored at legacy ~1.79-unit height, then normalized to
  // ROBOT_TARGET_HEIGHT so fallbacks always match GLB-cast proportions.
  root.scale.setScalar(ROBOT_TARGET_HEIGHT / 1.79)
  const torso = new Mesh(new CapsuleGeometry(0.32, 0.8, 4, 12), material)
  torso.position.y = 0.95
  const head = new Mesh(new SphereGeometry(0.24, 16, 12), material)
  head.position.y = 1.55
  torso.frustumCulled = false
  head.frustumCulled = false
  const torsoStrokeMaterial = createStrokeMaterial(accent)
  const headStrokeMaterial = createStrokeMaterial(accent)
  const torsoStroke = new Mesh(torso.geometry, torsoStrokeMaterial)
  const headStroke = new Mesh(head.geometry, headStrokeMaterial)
  torsoStroke.frustumCulled = false
  headStroke.frustumCulled = false
  const glow = glowFallback(accent, root)
  root.add(torso, head, torsoStroke, headStroke)
  let active = false
  return {
    root,
    visualGroundOffset: { x: 0, z: 0 },
    update() {
      material.emissiveIntensity = active ? ACTIVE_EMISSIVE : STANDBY_EMISSIVE
    },
    setActive(next) {
      active = next
    },
    dispose() {
      torso.geometry.dispose()
      head.geometry.dispose()
      material.dispose()
      torsoStrokeMaterial.dispose()
      headStrokeMaterial.dispose()
      glow?.dispose()
    },
  }
}
