/**
 * GLB cast-figure factory: bone-deep clone of the loaded robot template,
 * height-normalized with feet on y=0 and footprint centered, hologram-
 * skinned with an active glow ring, AnimationMixer driving Idle/Walking.
 * Extracted verbatim from deck-robots.ts.
 */

import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  SkinnedMesh,
  TorusGeometry,
  Vector3,
} from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import {
  ACTIVE_EMISSIVE,
  BLEND_RATE_PER_SEC,
  ROBOT_TARGET_HEIGHT,
  STANDBY_EMISSIVE,
} from './deck-robots-constants'
import {
  createHologramMaterial,
  createStrokeMaterial,
} from './hologram-material'

import type { RobotTemplate } from './deck-robots-loader'
import type { AnimationClip, MeshStandardMaterial } from 'three'

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

/** Case-insensitive clip lookup ('idle' → "Idle"); undefined when absent. */
function findClip(
  animations: readonly AnimationClip[],
  keyword: string,
): AnimationClip | undefined {
  return animations.find((clip) => clip.name.toLowerCase().includes(keyword))
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
