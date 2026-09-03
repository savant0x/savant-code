/**
 * FID-2026-0831-002 P6b — office cast robot loader.
 *
 * Loads the vendored CC0 robot models (public/floor-assets/robots/, per
 * ASSET-MANIFEST.md) once per URL and hands templates to the shared figure
 * factory in `stage/deck-robots.ts` (createRobotFigure clones the template,
 * so one load serves every cast member). Two distinct designs alternate
 * across the pad ring — the operator asked for multiple robot designs, not
 * one cloned figure.
 *
 * The loader never throws: a missing or corrupt asset resolves null and the
 * caller falls back to the solid minimal silhouette (never a wireframe).
 */

import {
  AdditiveBlending,
  AnimationMixer,
  BackSide,
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import type { AnimationClip, Object3D, MeshStandardMaterial } from 'three'

export interface RobotTemplate {
  readonly scene: Object3D
  readonly animations: readonly AnimationClip[]
}

/** Two free robot designs (CC0): Quaternius pack + Khronos expressive bot. */
export const CAST_MODEL_URLS = [
  '/floor-assets/robots/robot.glb',
  '/floor-assets/robots/RobotExpressive.glb',
] as const

/** Deterministic design rotation across the pad ring. */
export function castModelUrlForPad(padIndex: number): string {
  return (
    CAST_MODEL_URLS[padIndex % CAST_MODEL_URLS.length] ?? CAST_MODEL_URLS[0]
  )
}

const templateCache = new Map<string, Promise<RobotTemplate | null>>()
const TEMPLATE_LOAD_TIMEOUT_MS = 8000

const WALK_BLEND_PER_SEC = 6

export interface OfficeRobotFigure {
  readonly root: Group
  /** Structurally compatible with the stage RobotFigure contract. */
  readonly visualGroundOffset: { x: number; z: number }
  /** Advance animations; dtMs is the injected clock delta (clamped upstream). */
  update(dtMs: number, state: { moving: boolean; reduced: boolean }): void
  /** Active agents pulse their ground ring. */
  setActive(active: boolean): void
  dispose(): void
}

/**
 * Office cast figure (P6b fix — operator: "agents have no details, they are
 * just glowing"): unlike the stage hologram factory, this KEEPS the robot's
 * original GLB materials — its own colors, panels and parts are the detail —
 * and adds only an activity ground ring. Height-normalized with feet on y=0
 * and the footprint centered on the root origin.
 *
 * P7 (operator: "all of the agents need a glowing stroke of their specific
 * color too"): a synced INVERTED-HULL outline — a second bone-deep clone,
 * scaled slightly larger, rendered BackSide + additive in the role accent —
 * traces a crisp neon rim around the animated silhouette. Unlike a wireframe
 * child on a skinned mesh (which detaches from the posed surface), the hull
 * shares the skeleton via a clone and advances on its own synced mixer, so
 * the rim hugs the body through every frame.
 */
export function createOfficeRobotFigure(
  template: RobotTemplate,
  accent: string,
  height = 1.85,
): OfficeRobotFigure {
  const accentColor = new Color(accent)

  /** Normalize a template clone: height to `height`, feet on y=0, footprint
   *  centered on the origin. Returns the transformed model and its mixer. */
  const buildClone = (): { model: Object3D; mixer: AnimationMixer } => {
    const model = skeletonClone(template.scene)
    // Force a full matrix pass BEFORE measuring (stale world matrices would
    // misplace the normalization origin — see stage/deck-robots.ts).
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model)
    const size = new Vector3()
    bounds.getSize(size)
    const scale = size.y > 1e-6 ? height / size.y : 1
    model.scale.setScalar(scale)
    const scaled = new Box3().setFromObject(model)
    model.position.y = -scaled.min.y
    model.position.x = -(scaled.min.x + scaled.max.x) / 2
    model.position.z = -(scaled.min.z + scaled.max.z) / 2
    // Skinned meshes frustum-cull against bind-pose bounds — always render.
    model.traverse((child) => {
      if (child instanceof Mesh) child.frustumCulled = false
    })
    return { model, mixer: new AnimationMixer(model) }
  }

  // Body: original GLB materials, tinted 45% toward the role accent so the
  // cast reads as distinct agents while the robot's real detail stays.
  const body = buildClone()
  const tintedMaterials: MeshStandardMaterial[] = []
  body.model.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false
      const material = child.material as MeshStandardMaterial
      if (material !== undefined && material !== null && 'color' in material) {
        const tinted = material.clone()
        tinted.color.lerp(accentColor, 0.45)
        child.material = tinted
        tintedMaterials.push(tinted)
      }
    }
  })

  // Neon rim (P7): a single shared BackSide additive accent material over a
  // slightly-enlarged clone. BackSide + FrontSide culling means you see only
  // the outer edge — a crisp glowing stroke of the role color.
  const rim = buildClone()
  rim.model.scale.multiplyScalar(1.06)
  const rimMaterial = new MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    side: BackSide,
  })
  rim.model.traverse((child) => {
    if (child instanceof Mesh) {
      child.frustumCulled = false
      child.material = rimMaterial
    }
  })

  const root = new Group()
  root.add(rim.model)
  root.add(body.model)

  // Activity ring: additive ground halo, visible only while active.
  const ring = new Mesh(
    new TorusGeometry(height * 0.24, 0.035, 8, 40),
    new MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.1
  ring.visible = false
  ring.frustumCulled = false
  root.add(ring)

  // Clip lookup tolerates both vendored rigs' naming (Quaternius + Khronos).
  const findClip = (keywords: string[]): AnimationClip | undefined => {
    for (const keyword of keywords) {
      const clip = template.animations.find((candidate) =>
        candidate.name.toLowerCase().includes(keyword),
      )
      if (clip !== undefined) return clip
    }
    return undefined
  }
  const idleClip =
    findClip(['idle', 'stand', 'breath', 'pose']) ?? template.animations[0]
  const walkClip = findClip(['walk', 'run', 'move', 'step'])

  // Drive body + rim mixers in lockstep so the hull hugs the posed surface.
  const bindActions = (mixer: AnimationMixer) => {
    const idleAction =
      idleClip !== undefined ? mixer.clipAction(idleClip) : null
    const walkAction =
      walkClip !== undefined ? mixer.clipAction(walkClip) : null
    idleAction?.play()
    walkAction?.play()
    walkAction?.setEffectiveWeight(0)
    return { idleAction, walkAction }
  }
  const bodyActions = bindActions(body.mixer)
  const rimActions = bindActions(rim.mixer)

  let active = false
  return {
    root,
    visualGroundOffset: { x: 0, z: 0 },
    update(dtMs, { moving, reduced }) {
      // Reduced motion freezes the mixer — poses hold, nothing advances.
      if (reduced) return
      const dtSec = Math.max(0, dtMs) / 1000
      body.mixer.update(dtSec)
      rim.mixer.update(dtSec)
      const blend = Math.min(1, dtSec * WALK_BLEND_PER_SEC)
      const apply = (actions: typeof bodyActions) => {
        if (actions.walkAction !== null && actions.idleAction !== null) {
          const target = moving ? 1 : 0
          const next =
            actions.walkAction.getEffectiveWeight() +
            (target - actions.walkAction.getEffectiveWeight()) * blend
          actions.walkAction.setEffectiveWeight(next)
          actions.idleAction.setEffectiveWeight(1 - next)
        }
      }
      apply(bodyActions)
      apply(rimActions)
      ring.visible = active
      if (active) {
        const t = (performance.now() / 1000) * Math.PI * 2
        ring.scale.setScalar(1 + Math.sin(t) * 0.06)
        ;(ring.material as MeshBasicMaterial).opacity = 0.5 + Math.sin(t) * 0.1
      }
    },
    setActive(next) {
      active = next
    },
    dispose() {
      // GLB materials/geometry are shared between clones — dispose ONLY the
      // per-figure resources this clone created.
      body.mixer.stopAllAction()
      body.mixer.uncacheRoot(body.model)
      rim.mixer.stopAllAction()
      rim.mixer.uncacheRoot(rim.model)
      ring.geometry.dispose()
      ;(ring.material as MeshBasicMaterial).dispose()
      ;(rimMaterial as MeshBasicMaterial).dispose()
      for (const material of tintedMaterials) material.dispose()
    },
  }
}

/** Per-URL cached load; null on missing/corrupt/timed-out (never throws). */
export function loadCastTemplate(url: string): Promise<RobotTemplate | null> {
  const cached = templateCache.get(url)
  if (cached !== undefined) return cached
  const promise = new Promise<RobotTemplate | null>((resolve) => {
    let settled = false
    const finish = (result: RobotTemplate | null): void => {
      if (settled) return
      settled = true
      // A failed/timed-out load clears the cache so the next mount retries
      // the real asset — one transient failure must not permanently
      // degrade the cast to fallback silhouettes.
      if (result === null) templateCache.delete(url)
      resolve(result)
    }
    const timeout = setTimeout(() => finish(null), TEMPLATE_LOAD_TIMEOUT_MS)
    try {
      new GLTFLoader().load(
        url,
        (gltf) => {
          clearTimeout(timeout)
          finish({ scene: gltf.scene, animations: gltf.animations })
        },
        undefined,
        () => {
          clearTimeout(timeout)
          finish(null)
        },
      )
    } catch {
      clearTimeout(timeout)
      finish(null)
    }
  })
  templateCache.set(url, promise)
  return promise
}
