import { describe, expect, test } from 'bun:test'
import {
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  BoxGeometry,
  Group,
  Object3D,
} from 'three'

import { buildFallbackFigure, createRobotFigure } from '../stage/deck-robots'

// FID-2026-0822-012 hotfix — the operator saw nameplates floating over
// NOTHING: every skinned figure was frustum-culled against bind-pose bounds
// that never matched the posed skeleton. These tests pin the contract that
// every figure mesh renders unconditionally (frustumCulled false) under the
// hologram material, headlessly via a fake template.

function fakeTemplate(): { scene: Object3D; animations: [] } {
  const scene = new Object3D()
  const body = new Group()
  const torso = new Mesh(new BoxGeometry(1, 2, 1))
  const head = new Mesh(new BoxGeometry(0.5, 0.5, 0.5))
  body.add(torso, head)
  scene.add(body)
  return { scene, animations: [] }
}

describe('robot figure factory (visibility hotfix)', () => {
  test('every figure mesh is frustumCulled=false under the hologram material', () => {
    const figure = createRobotFigure(fakeTemplate(), '#18faf9')
    try {
      // Hologram depth pass (2026-08-25): every solid mesh carries a
      // wireframe scan-lattice twin — 2 solids + 2 strokes per figure.
      let solids = 0
      let strokes = 0
      figure.root.traverse((child) => {
        if (child instanceof Mesh) {
          expect(child.frustumCulled).toBe(false)
          if (child.material instanceof MeshBasicMaterial) {
            strokes += 1
          } else {
            solids += 1
            expect(child.material).toBeInstanceOf(MeshStandardMaterial)
          }
        }
      })
      expect(solids).toBe(2)
      expect(strokes).toBe(2)
    } finally {
      figure.dispose()
    }
  })

  test('figures height-normalize with feet on y=0', () => {
    const figure = createRobotFigure(fakeTemplate(), '#18faf9', {
      height: 1.7,
    })
    try {
      // The template is 2 units tall: scale 0.85, and the +y offset lifts
      // the scaled minimum (feet) onto the floor plane.
      const model = figure.root.children[0]
      expect(model.scale.y).toBeCloseTo(0.85, 5)
      expect(model.position.y).toBeCloseTo(0.85, 5)
    } finally {
      figure.dispose()
    }
  })

  test('setActive burns the emissive under the hologram material', () => {
    const figure = createRobotFigure(fakeTemplate(), '#18faf9')
    try {
      const found: MeshStandardMaterial[] = []
      figure.root.traverse((child) => {
        if (child instanceof Mesh) {
          found.push(child.material as MeshStandardMaterial)
        }
      })
      figure.setActive(true)
      // A 1s delta drives the blend factor to 1: full ACTIVE emissive.
      figure.update(1000, { moving: false, reduced: false })
      expect(found[0]?.emissiveIntensity).toBeCloseTo(1.2, 5)
    } finally {
      figure.dispose()
    }
  })

  test('reduced motion freezes both the mixer and the emissive blend', () => {
    const figure = createRobotFigure(fakeTemplate(), '#18faf9')
    try {
      const found: MeshStandardMaterial[] = []
      figure.root.traverse((child) => {
        if (child instanceof Mesh) {
          found.push(child.material as MeshStandardMaterial)
        }
      })
      figure.setActive(true)
      figure.update(1000, { moving: false, reduced: true })
      expect(found[0]?.emissiveIntensity).toBeCloseTo(0.7, 5)
    } finally {
      figure.dispose()
    }
  })

  test('the fallback silhouette is also never culled', () => {
    const figure = buildFallbackFigure('#18faf9')
    try {
      let solids = 0
      let strokes = 0
      figure.root.traverse((child) => {
        if (child instanceof Mesh) {
          expect(child.frustumCulled).toBe(false)
          if (child.material instanceof MeshBasicMaterial) {
            strokes += 1
          } else {
            solids += 1
            expect(child.material).toBeInstanceOf(MeshStandardMaterial)
          }
        }
      })
      expect(solids).toBe(2)
      expect(strokes).toBe(2)
    } finally {
      figure.dispose()
    }
  })

  test('the vendored GLB is a real rigged, animated model (asset regression)', async () => {
    // FID-2026-0824-028: the asset must carry skins, meshes, and animations
    // — a corrupt or empty GLB can never ship silently again.
    // Resolved from THIS file's location so the gate passes from any CWD
    // (fid:verify runs tests from the repo root, not desktop/).
    const bytes = await Bun.file(
      `${import.meta.dir}/../../../public/floor-assets/robots/robot.glb`,
    ).arrayBuffer()
    const view = new DataView(bytes)
    expect(view.getUint32(0, true)).toBe(0x46546c67) // 'glTF' magic
    expect(view.getUint32(16, true)).toBe(0x4e4f534a) // JSON chunk type
    const jsonLength = view.getUint32(12, true)
    const json = JSON.parse(
      new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)),
    ) as {
      skins?: unknown[]
      meshes?: unknown[]
      animations?: unknown[]
    }
    expect((json.skins ?? []).length).toBeGreaterThan(0)
    expect((json.meshes ?? []).length).toBeGreaterThan(0)
    expect((json.animations ?? []).length).toBeGreaterThan(0)
  })
})
