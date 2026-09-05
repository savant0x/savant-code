/**
 * Shared machinery for the procedural PBR texture generators: canvas setup,
 * THREE texture wrapping, the deterministic hash-noise stack (FID-2026-0831-002
 * P6), and the module-level texture cache. Extracted verbatim from
 * procedural-textures.ts; only the symbols shared across the texture-family
 * modules gained `export`.
 */

import * as THREE from 'three'

export interface PbrTextureSet {
  map: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

export const EMPTY_SET: PbrTextureSet = { map: null, roughnessMap: null }

const textureCache = new Map<string, PbrTextureSet>()

type CanvasContext = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  size: number
}

export const makeCanvas = (size: number): CanvasContext | null => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx, size }
}

export const toTexture = (
  canvas: HTMLCanvasElement,
  options: { srgb?: boolean } = {},
): THREE.CanvasTexture => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  if (options.srgb) texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** Deterministic hash noise so textures look identical across sessions. */
export const hash2 = (x: number, y: number, seed: number): number => {
  let h = seed + x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  h ^= h >> 16
  return (h >>> 0) / 4294967295
}

const smoothNoise = (x: number, y: number, seed: number): number => {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const sx = xf * xf * (3 - 2 * xf)
  const sy = yf * yf * (3 - 2 * yf)
  const n00 = hash2(xi, yi, seed)
  const n10 = hash2(xi + 1, yi, seed)
  const n01 = hash2(xi, yi + 1, seed)
  const n11 = hash2(xi + 1, yi + 1, seed)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

export const fbm = (
  x: number,
  y: number,
  seed: number,
  octaves = 4,
): number => {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  for (let index = 0; index < octaves; index += 1) {
    value +=
      smoothNoise(x * frequency, y * frequency, seed + index * 101) * amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value
}

export const cached = (
  key: string,
  build: () => PbrTextureSet,
): PbrTextureSet => {
  const existing = textureCache.get(key)
  if (existing) return existing
  const built = build()
  textureCache.set(key, built)
  return built
}
