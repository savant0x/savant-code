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
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SkinnedMesh,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  createHologramMaterial,
  createStrokeMaterial,
} from './hologram-material'

import type { AnimationClip, MeshStandardMaterial, Object3D } from 'three'

export const ROBOT_MODEL_URL = '/floor-assets/robots/robot.glb'

/** Cast figures normalize to this height (world units). FID-2026-0828-002
 * coherent-world rescale: the earlier 25-unit target came from an
 * eye-scaling session against a broken normalization (stale matrices), so
 * the multiplier tuning was compensating for a measurement bug. With the
 * bounds now measured truthfully, the floor was originally designed around
 * a ~5-unit cast: pad ring radius 16, station ring radius 9, pad spacing
 * ~8.3 units, camera default distance 22 — a 62-unit cast cannot fit in
 * that world without stacking. Return to the designed scale.
 * Rescale 25 → 6 (operator: robots now massive and stacked on top of each
 * other; a specialist pad has ~8.3 units of separation). */
export const ROBOT_TARGET_HEIGHT = 6

/** Emissive intensity levels — the 1:1 chat-mirror contract: IDLE cast is
 * visibly dim standby holograms; only an agent with a LIVE contract burns
 * full holographic brightness (operator: "non-active agents should be
 * dimmer, the active ones should be fully holographic"). The old 1.4/2.2
 * pair made the whole roster read active all the time.
 * FID-2026-0829-001 L1: active 2.2 → 4.0, standby 0.7 → 1.2. The deck
 * must be unmistakably alive — agents glow brightly when active and
 * visibly at standby (not off). The dim standby LOOK still comes from
 * the translucent base + dark tinted chassis, but the emissive is now
 * high enough to read the accent under any lighting rig. */
const STANDBY_EMISSIVE = 1.2
const ACTIVE_EMISSIVE = 4.0
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

export interface RobotFigure {
  readonly root: Group
  /** Visual ground anchor in the figure root's local coordinates. */
  readonly visualGroundOffset: { x: number; z: number }
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
  // FID-2026-0828-002 (operator: items hovering off the deck plane):
  // skeletonClone copies the hierarchy but its descendant world matrices
  // are stale until the first updateMatrixWorld — bounds measured before
  // that can misplace the normalization origin, leaving feet below or
  // above y=0. Force a full matrix pass BEFORE measuring so the bounds
  // reflect the real geometry, then zero the root offset.
  model.updateMatrixWorld(true)
  const bounds = new Box3().setFromObject(model)
  const size = new Vector3()
  bounds.getSize(size)
  const height = options.height ?? ROBOT_TARGET_HEIGHT
  const scale = size.y > 1e-6 ? height / size.y : 1
  model.scale.setScalar(scale)
  const scaledBounds = new Box3().setFromObject(model)
  model.position.y = -scaledBounds.min.y
  // FID-2026-0829-001 (operator: "circles not aligned to the exact same
  // x-y"): normalization centered only Y. If the GLB footprint is off-
  // origin in X/Z, every ground ring placed at the root reads displaced —
  // and the offset ROTATES with the figure's facing, so the ring looks
  // like it floats behind the model. Center the footprint on the root
  // origin so root XZ == visual body center for rings, lanes, and trails.
  model.position.x = -(scaledBounds.min.x + scaledBounds.max.x) / 2
  model.position.z = -(scaledBounds.min.z + scaledBounds.max.z) / 2

  const materials: MeshStandardMaterial[] = []
  const strokeMaterials: MeshBasicMaterial[] = []
  // (bind-pose snapshot BEFORE any world-matrix updates; skinned meshes
  // render the posed skeleton, not world transforms — see below)
  const skinnedMeshes: Mesh[] = []
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
      // FID-2026-0828-002 (operator: "arms are floating and not attached"):
      // a stroke overlay added as a child of a SKINNED mesh renders its
      // vertices from world matrices, which for a posed skeleton stay in
      // the bind pose — the wireframe detaches from the animated surface
      // and limbs appear to float. Skinned meshes get NO stroke child;
      // only rigid meshes do (their world transform is authoritative).
      if (child instanceof SkinnedMesh) {
        skinnedMeshes.push(child)
      } else {
        solidMeshes.push(child)
      }
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
  // FID-2026-0829-001 L1: pulsing glow ring — a torus around the agent
  // that appears only when active, pulsing to make the activation
  // unmistakable. AdditiveBlending so it reads as a light halo, not
  // a solid object. The old additive quad was removed because it read
  // as a ball ON the floor; this ring orbits the figure's midsection.
  const glowRing = new Mesh(
    // FID-2026-0829-001 (operator: "multiple circles... not matching in
    // size"): ONE ground halo per active agent, sitting in the lane plane
    // (y≈0.12) at footprint radius — NOT the old chest-height torus
    // (radius 1.5 at y=3) that read as a second floating circle detached
    // from the model under perspective.
    new TorusGeometry(ROBOT_TARGET_HEIGHT * 0.18, 0.06, 8, 40),
    new MeshBasicMaterial({
      color: new Color(accent),
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  )
  glowRing.frustumCulled = false
  glowRing.rotation.x = Math.PI / 2
  glowRing.position.y = 0.12
  glowRing.visible = false
  root.add(glowRing)

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
    visualGroundOffset: { x: 0, z: 0 },
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
      // FID-2026-0829-001 L1: ground-halo pulse — visible only when
      // active, gentle 0.94-1.06× breathing so it reads as attached to
      // the feet rather than expanding/contracting as a separate object.
      glowRing.visible = active
      if (active) {
        const t = (performance.now() / 1000) * Math.PI * 2
        const pulse = 1 + Math.sin(t) * 0.06
        glowRing.scale.setScalar(pulse)
        glowRing.rotation.z += dtSec * 0.5
        ;(glowRing.material as MeshBasicMaterial).opacity =
          0.55 + Math.sin(t) * 0.1
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
      ;(glowRing.material as MeshBasicMaterial).dispose()
      glowRing.geometry.dispose()
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
