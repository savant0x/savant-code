import { describe, expect, test } from 'bun:test'
import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Scene,
  Sprite,
} from 'three'

import { StationLayer } from '../stage/deck-stations'
import { STATION_COUNT, stationPosition } from '../stations'

describe('station pedestal layer (FID-2026-0822-012 P3)', () => {
  test('builds exactly six pedestals at their hexagon positions', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    try {
      // One root group; six pedestal groups inside it.
      expect(scene.children).toHaveLength(1)
      const root = scene.children[0]
      expect(root.children).toHaveLength(STATION_COUNT)
      for (let index = 0; index < STATION_COUNT; index += 1) {
        const pedestal = root.children[index]
        const pad = stationPosition(index)
        expect(pedestal.position.x).toBeCloseTo(pad.x, 10)
        expect(pedestal.position.z).toBeCloseTo(pad.z, 10)
      }
    } finally {
      layer.dispose()
    }
  })

  test('dispose empties the scene and is idempotent under double-mount', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    layer.dispose()
    expect(scene.children).toHaveLength(0)
    layer.dispose()
    expect(scene.children).toHaveLength(0)
  })

  test('pedestals are solid emissive hologram material — zero wireframe (asset pass)', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    try {
      const meshes: Mesh[] = []
      scene.traverse((child) => {
        if (child instanceof Mesh) meshes.push(child)
      })
      expect(meshes.length).toBeGreaterThan(0)
      for (const mesh of meshes) {
        const material = mesh.material
        // The projector beam is the one additive MeshBasicMaterial; every
        // other surface is the hologram MeshStandardMaterial recipe.
        if (material instanceof MeshBasicMaterial) {
          expect(material.wireframe).toBe(false)
          expect(material.transparent).toBe(true)
          expect(material.blending).toBe(AdditiveBlending)
        } else {
          expect(material instanceof MeshStandardMaterial).toBe(true)
          if (material instanceof MeshStandardMaterial) {
            expect(material.wireframe).toBe(false)
            expect(material.emissiveIntensity).toBeGreaterThan(0)
            expect(material.emissive.getHex()).not.toBe(0)
          }
        }
      }
    } finally {
      layer.dispose()
    }
  })

  test('pedestals carry a billboard nameplate (asset pass)', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    try {
      const root = scene.children[0]
      expect(root.children).toHaveLength(STATION_COUNT)
      for (const pedestal of root.children) {
        expect(pedestal.children.some((child) => child instanceof Sprite)).toBe(
          true,
        )
      }
    } finally {
      layer.dispose()
    }
  })

  test('syncBusy flips station chips; isBusy reports the state', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    try {
      expect(layer.isBusy(0)).toBe(false)
      layer.syncBusy(new Set(['file-forge'] as const))
      expect(layer.isBusy(0)).toBe(true)
      expect(layer.isBusy(1)).toBe(false)
      layer.syncBusy(new Set())
      expect(layer.isBusy(0)).toBe(false)
      // Post-dispose sync is a no-op, not a crash.
      layer.dispose()
      layer.syncBusy(new Set(['file-forge'] as const))
      expect(layer.isBusy(0)).toBe(false)
    } finally {
      layer.dispose()
    }
  })

  test('cores spin deterministically from the injected clock (visual rework)', () => {
    const scene = new Scene()
    const layer = new StationLayer(scene)
    try {
      layer.sync(0)
      expect(layer.coreSpin(0)).toBeCloseTo(0, 5)
      // 2.5s at 0.8 rad/s = 2 rad.
      layer.sync(2500)
      expect(layer.coreSpin(0)).toBeCloseTo(2, 5)
      expect(layer.coreSpin(1)).toBeCloseTo(2, 5)
    } finally {
      layer.dispose()
    }
  })
})
