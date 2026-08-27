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
 */

import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  CanvasTexture,
  CapsuleGeometry,
  Group,
  Mesh,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  createHologramMaterial,
  createStrokeMaterial,
} from './hologram-material'

import type {
  AnimationClip,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
} from 'three'

export const ROBOT_MODEL_URL = '/floor-assets/robots/robot.glb'

/** Cast figures normalize to this height (world units). EYE-SCALING
 * session per operator directive (2026-08-25 01:05): math-derived heights
 * kept reading as pixels on the live webview, so we overshoot massively and
 * tune by eye against the running window. */
export const ROBOT_TARGET_HEIGHT = 25

/** Emissive intensity levels — standby glows clearly, active burns brighter.
 * Raised from 0.32/0.95 (FID-2026-0824-028): a 0.32-emissive figure on the
 * void floor was imperceptible at camera distance ~34 — the operator saw
 * "nameplates floating over nothing". */
const STANDBY_EMISSIVE = 0.7
const ACTIVE_EMISSIVE = 1.2
/** Crossfade speed for clip weights and emissive levels (0..1 per second). */
const BLEND_RATE_PER_SEC = 6

interface RobotTemplate {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
}

let templatePromise: Promise<RobotTemplate | null> | null = null

/** The loader must never hang silently — H1 in FID-2026-0824-028. */
const TEMPLATE_LOAD_TIMEOUT_MS = 8000

let lastOutcome = 'pending'

/** Last loader outcome for UI telemetry (FID-2026-0824-030). */
export function lastTemplateOutcome(): string {
  return lastOutcome
}

/** One honest console line per load outcome (H1/H2 diagnostics). */
function reportTemplateOutcome(note: string): void {
  lastOutcome = note
  // eslint-disable-next-line no-console
  console.info(`[deck] robot template ${note}`)
}

/** Load (once) the vendored robot; null when missing/corrupt/timed out. */
export function loadRobotTemplate(
  url: string = ROBOT_MODEL_URL,
): Promise<RobotTemplate | null> {
  if (templatePromise === null) {
    templatePromise = new Promise((resolve) => {
      let settled = false
      const finish = (result: RobotTemplate | null, note: string): void => {
        if (settled) return
        settled = true
        reportTemplateOutcome(note)
        // A failed/timed-out load clears the cache so the next figure mount
        // retries the real asset — one transient failure must not permanently
        // degrade the cast to fallback silhouettes (Verifier C2).
        if (result === null) templatePromise = null
        resolve(result)
      }
      const timeout = setTimeout(
        () =>
          finish(
            null,
            'load TIMED OUT after 8s — mounting fallback silhouettes',
          ),
        TEMPLATE_LOAD_TIMEOUT_MS,
      )
      try {
        new GLTFLoader().load(
          url,
          (gltf) => {
            clearTimeout(timeout)
            finish(
              { scene: gltf.scene, animations: gltf.animations },
              `loaded (${gltf.animations.length} clips)`,
            )
          },
          undefined,
          () => {
            clearTimeout(timeout)
            finish(null, 'failed to load — mounting fallback silhouettes')
          },
        )
      } catch (error: unknown) {
        clearTimeout(timeout)
        finish(
          null,
          `loader threw: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    })
  }
  return templatePromise
}

/** Case-insensitive clip lookup ('idle' → "Idle"); undefined when absent. */
function findClip(
  animations: readonly AnimationClip[],
  keyword: string,
): AnimationClip | undefined {
  return animations.find((clip) => clip.name.toLowerCase().includes(keyword))
}

interface GlowSprite {
  readonly sprite: Sprite
  dispose(): void
}

/** Soft additive halo behind a figure — the projection's light bloom.
 * DOM-free environments (bun tests) skip it; the figure stays structurally
 * identical minus the sprite (Law 14 degradation, nameplate pattern). */
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

export interface RobotFigure {
  readonly root: Group
  /** Advance animations; dtMs is the injected clock delta (clamped upstream). */
  update(dtMs: number, state: { moving: boolean; reduced: boolean }): void
  /** Standby dims the emissive; active burns the role accent. */
  setActive(active: boolean): void
  dispose(): void
}

/**
 * Assemble one cast figure from the loaded template: bone-deep clone,
 * height-normalized with feet on y=0, hologram-skinned, mixer running Idle.
 */
export function createRobotFigure(
  template: RobotTemplate,
  accent: string,
  options: { height?: number } = {},
): RobotFigure {
  const model = skeletonClone(template.scene)
  const bounds = new Box3().setFromObject(model)
  const size = new Vector3()
  bounds.getSize(size)
  const height = options.height ?? ROBOT_TARGET_HEIGHT
  const scale = size.y > 1e-6 ? height / size.y : 1
  model.scale.setScalar(scale)
  const scaledBounds = new Box3().setFromObject(model)
  model.position.y = -scaledBounds.min.y

  const materials: MeshStandardMaterial[] = []
  const strokeMaterials: MeshBasicMaterial[] = []
  const solidMeshes: Mesh[] = []
  model.traverse((child) => {
    if (child instanceof Mesh) {
      // Skinned meshes frustum-cull against bind-pose bounds that never
      // track the posed skeleton — the classic invisible-robot bug (the
      // operator saw floating nameplates over nothing). Figures always
      // render; culling buys nothing at this population size.
      child.frustumCulled = false
      // Translucent body: inner scan-lattice detail reads through the surface
      // (operator direction 2026-08-25 01:10 — hologram depth pass).
      const material = createHologramMaterial(accent, STANDBY_EMISSIVE, {
        opacity: 0.92,
      })
      child.material = material
      materials.push(material)
      solidMeshes.push(child)
    }
  })
  // Inner strokes attach AFTER traversal — each stroke is itself a visitable
  // Mesh child, so adding during traverse recurses stroke-of-stroke until
  // the stack dies (caught live by the visibility suite, 01:23).
  for (const mesh of solidMeshes) {
    const strokeMaterial = createStrokeMaterial(accent)
    const stroke = new Mesh(mesh.geometry, strokeMaterial)
    stroke.frustumCulled = false
    mesh.add(stroke)
    strokeMaterials.push(strokeMaterial)
  }

  const root = new Group()
  root.add(model)
  const glow = createGlow(accent, height)
  if (glow !== null) root.add(glow.sprite)

  const mixer = new AnimationMixer(model)
  const idleClip =
    findClip(template.animations, 'idle') ?? template.animations[0]
  const walkClip =
    findClip(template.animations, 'walk') ??
    findClip(template.animations, 'run')
  const idleAction = idleClip !== undefined ? mixer.clipAction(idleClip) : null
  const walkAction = walkClip !== undefined ? mixer.clipAction(walkClip) : null
  idleAction?.play()
  walkAction?.play()
  walkAction?.setEffectiveWeight(0)

  let active = false
  return {
    root,
    update(dtMs, { moving, reduced }) {
      // Reduced motion freezes the mixer — poses hold, nothing advances.
      if (reduced) return
      const dtSec = Math.max(0, dtMs) / 1000
      mixer.update(dtSec)
      const blend = Math.min(1, dtSec * BLEND_RATE_PER_SEC)
      if (walkAction !== null && idleAction !== null) {
        const target = moving ? 1 : 0
        const next =
          walkAction.getEffectiveWeight() +
          (target - walkAction.getEffectiveWeight()) * blend
        walkAction.setEffectiveWeight(next)
        idleAction.setEffectiveWeight(1 - next)
      }
      const targetEmissive = active ? ACTIVE_EMISSIVE : STANDBY_EMISSIVE
      for (const material of materials) {
        material.emissiveIntensity +=
          (targetEmissive - material.emissiveIntensity) * blend
      }
    },
    setActive(next) {
      active = next
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(model)
      for (const material of materials) material.dispose()
      for (const strokeMaterial of strokeMaterials) strokeMaterial.dispose()
      glow?.dispose()
    },
  }
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
