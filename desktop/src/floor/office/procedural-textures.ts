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
 */

import * as THREE from 'three'

export interface PbrTextureSet {
  map: THREE.Texture | null
  roughnessMap: THREE.Texture | null
}

const EMPTY_SET: PbrTextureSet = { map: null, roughnessMap: null }

const textureCache = new Map<string, PbrTextureSet>()

type CanvasContext = {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  size: number
}

const makeCanvas = (size: number): CanvasContext | null => {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  return { canvas, ctx, size }
}

const toTexture = (
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
const hash2 = (x: number, y: number, seed: number): number => {
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

const fbm = (x: number, y: number, seed: number, octaves = 4): number => {
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

const cached = (key: string, build: () => PbrTextureSet): PbrTextureSet => {
  const existing = textureCache.get(key)
  if (existing) return existing
  const built = build()
  textureCache.set(key, built)
  return built
}

/** Warm oak plank floor with per-plank tone shifts, grain and seams. */
export const getWoodFloorTextures = (): PbrTextureSet =>
  cached('wood-floor', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    const plankHeight = size / 8
    const plankWidth = size / 2

    for (let row = 0; row < 8; row += 1) {
      const rowOffset =
        (row % 2) * plankWidth * 0.5 + hash2(row, 7, 11) * plankWidth * 0.35
      for (let col = -1; col < 3; col += 1) {
        const px = col * plankWidth + rowOffset
        const tone = 0.82 + hash2(row, col, 23) * 0.36
        const baseR = 168 * tone
        const baseG = 122 * tone
        const baseB = 82 * tone
        albedo.ctx.fillStyle = `rgb(${baseR | 0},${baseG | 0},${baseB | 0})`
        albedo.ctx.fillRect(px, row * plankHeight, plankWidth, plankHeight)
        const roughTone = 120 + hash2(row, col, 51) * 70
        rough.ctx.fillStyle = `rgb(${roughTone | 0},${roughTone | 0},${roughTone | 0})`
        rough.ctx.fillRect(px, row * plankHeight, plankWidth, plankHeight)
        // Plank end seam.
        albedo.ctx.fillStyle = 'rgba(40,24,12,0.85)'
        albedo.ctx.fillRect(px, row * plankHeight, 3, plankHeight)
      }
      // Long seam between rows.
      albedo.ctx.fillStyle = 'rgba(40,24,12,0.9)'
      albedo.ctx.fillRect(0, row * plankHeight, size, 3)
    }

    // Wood grain streaks + mottling.
    const albedoData = albedo.ctx.getImageData(0, 0, size, size)
    const roughData = rough.ctx.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const grain =
          fbm(x * 0.11, y * 0.009, 5, 4) * 0.7 +
          fbm(x * 0.02, y * 0.02, 9, 3) * 0.3
        const shade = 0.86 + grain * 0.28
        const index = (x + y * size) * 4
        albedoData.data[index] = Math.min(255, albedoData.data[index] * shade)
        albedoData.data[index + 1] = Math.min(
          255,
          albedoData.data[index + 1] * shade,
        )
        albedoData.data[index + 2] = Math.min(
          255,
          albedoData.data[index + 2] * shade,
        )
        roughData.data[index] = Math.min(
          255,
          Math.max(70, roughData.data[index] + (grain - 0.5) * 60),
        )
        roughData.data[index + 1] = roughData.data[index]
        roughData.data[index + 2] = roughData.data[index]
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    rough.ctx.putImageData(roughData, 0, 0)

    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })

/** Soft mottled plaster for interior walls. */
export const getPlasterTextures = (): PbrTextureSet =>
  cached('plaster', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    const albedoData = albedo.ctx.createImageData(size, size)
    const roughData = rough.ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const mottle = fbm(x * 0.014, y * 0.014, 31, 4)
        const fine = fbm(x * 0.16, y * 0.16, 77, 2)
        const shade = 208 + (mottle - 0.5) * 26 + (fine - 0.5) * 10
        const index = (x + y * size) * 4
        albedoData.data[index] = shade
        albedoData.data[index + 1] = shade * 0.985
        albedoData.data[index + 2] = shade * 0.955
        albedoData.data[index + 3] = 255
        const roughness = 220 + (fine - 0.5) * 40
        roughData.data[index] = roughness
        roughData.data[index + 1] = roughness
        roughData.data[index + 2] = roughness
        roughData.data[index + 3] = 255
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    rough.ctx.putImageData(roughData, 0, 0)
    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })

/** Short-pile carpet with fibre noise — used for the rug and soft zones. */
export const getCarpetTextures = (): PbrTextureSet =>
  cached('carpet', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    const albedoData = albedo.ctx.createImageData(size, size)
    const roughData = rough.ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const fibre = hash2(x, y, 3)
        const tuft = fbm(x * 0.09, y * 0.09, 17, 3)
        const shade = 205 + (fibre - 0.5) * 46 + (tuft - 0.5) * 30
        const index = (x + y * size) * 4
        albedoData.data[index] = shade
        albedoData.data[index + 1] = shade
        albedoData.data[index + 2] = shade
        albedoData.data[index + 3] = 255
        roughData.data[index] = 245
        roughData.data[index + 1] = 245
        roughData.data[index + 2] = 245
        roughData.data[index + 3] = 255
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    rough.ctx.putImageData(roughData, 0, 0)
    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })

/**
 * Cyberpunk tech floor: dark metal panels with faint cyan seam lines and
 * subtle per-panel tone variation (FID-2026-0831-002 P6b — operator:
 * "textures need to be cyberpunk ... glows").
 */
export const getTechFloorTextures = (): PbrTextureSet =>
  cached('tech-floor', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    const cell = size / 8
    albedo.ctx.fillStyle = '#232b36'
    albedo.ctx.fillRect(0, 0, size, size)
    rough.ctx.fillStyle = 'rgb(70,70,80)'
    rough.ctx.fillRect(0, 0, size, size)
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const tone = 38 + hash2(col, row, 41) * 20
        albedo.ctx.fillStyle = `rgb(${tone | 0},${(tone * 1.12) | 0},${(tone * 1.35) | 0})`
        albedo.ctx.fillRect(col * cell + 2, row * cell + 2, cell - 4, cell - 4)
        const roughTone = 60 + hash2(col, row, 43) * 50
        rough.ctx.fillStyle = `rgb(${roughTone | 0},${roughTone | 0},${roughTone | 0})`
        rough.ctx.fillRect(col * cell + 2, row * cell + 2, cell - 4, cell - 4)
        // Bright cyan seam glow along panel edges.
        albedo.ctx.strokeStyle = 'rgba(42, 223, 255, 0.5)'
        albedo.ctx.lineWidth = 2
        albedo.ctx.strokeRect(
          col * cell + 3,
          row * cell + 3,
          cell - 6,
          cell - 6,
        )
      }
    }
    // Grime mottling so the floor is not uniform.
    const albedoData = albedo.ctx.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const mottle = fbm(x * 0.03, y * 0.03, 71, 3)
        const index = (x + y * size) * 4
        const shade = 0.92 + mottle * 0.16
        albedoData.data[index] = Math.min(255, albedoData.data[index] * shade)
        albedoData.data[index + 1] = Math.min(
          255,
          albedoData.data[index + 1] * shade,
        )
        albedoData.data[index + 2] = Math.min(
          255,
          albedoData.data[index + 2] * shade,
        )
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })

/** Dark wall panels with horizontal grooves — the cyberpunk interior shell. */
export const getDarkPanelTextures = (): PbrTextureSet =>
  cached('dark-panels', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    albedo.ctx.fillStyle = '#1d232c'
    albedo.ctx.fillRect(0, 0, size, size)
    rough.ctx.fillStyle = 'rgb(120,120,130)'
    rough.ctx.fillRect(0, 0, size, size)
    for (let band = 0; band < 4; band += 1) {
      const y = band * (size / 4)
      const tone = 24 + hash2(0, band, 83) * 12
      albedo.ctx.fillStyle = `rgb(${tone | 0},${(tone * 1.12) | 0},${(tone * 1.4) | 0})`
      albedo.ctx.fillRect(0, y + 3, size, size / 4 - 6)
      // Groove line between bands.
      albedo.ctx.fillStyle = '#0d1117'
      albedo.ctx.fillRect(0, y, size, 3)
    }
    const albedoData = albedo.ctx.getImageData(0, 0, size, size)
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const mottle = fbm(x * 0.02, y * 0.02, 91, 3)
        const index = (x + y * size) * 4
        const shade = 0.88 + mottle * 0.24
        albedoData.data[index] = Math.min(255, albedoData.data[index] * shade)
        albedoData.data[index + 1] = Math.min(
          255,
          albedoData.data[index + 1] * shade,
        )
        albedoData.data[index + 2] = Math.min(
          255,
          albedoData.data[index + 2] * shade,
        )
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })

/**
 * Savant center emblem: a blacked-out robot-bust silhouette with a cyan
 * neon glow outline (P6d — operator: "the center should be this image
 * blacked out w/ a neon glow outline"). Drawn on a canvas; the cyan stroke
 * + additive bloom make the outline glow.
 */
export const getSavantEmblemTexture = (): THREE.CanvasTexture | null => {
  const context = makeCanvas(512)
  if (!context) return null
  const { canvas, ctx, size } = context
  ctx.clearRect(0, 0, size, size)

  // Manual rounded-rect path (avoids lib.dom roundRect typing variance).
  const rr = (x: number, y: number, w: number, h: number, r: number): void => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  const cx = size / 2
  const neon = '#2adfff'
  const drawSlab = (angle: number, tx: number, ty: number): void => {
    ctx.save()
    ctx.translate(tx, ty)
    ctx.rotate(angle)
    ctx.fillStyle = '#04070c'
    ctx.strokeStyle = neon
    ctx.lineWidth = 5
    rr(-size * 0.36, -size * 0.16, size * 0.34, size * 0.18, 10)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  drawSlab(-0.5, cx, size * 0.82)
  drawSlab(0.5, cx, size * 0.82)
  // Head (rounded block).
  ctx.fillStyle = '#04070c'
  ctx.strokeStyle = neon
  ctx.lineWidth = 6
  rr(cx - size * 0.19, size * 0.26, size * 0.38, size * 0.4, 26)
  ctx.fill()
  ctx.stroke()
  // Cat-ear fins (the reference headwear).
  ctx.fillStyle = '#04070c'
  ctx.strokeStyle = neon
  ctx.lineWidth = 4
  for (const dir of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(cx + dir * size * 0.1, size * 0.32)
    ctx.lineTo(cx + dir * size * 0.32, size * 0.16)
    ctx.lineTo(cx + dir * size * 0.2, size * 0.34)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  // Visor band: the one bright cyan face element.
  ctx.fillStyle = neon
  rr(cx - size * 0.13, size * 0.44, size * 0.26, size * 0.05, 6)
  ctx.fill()
  const texture = toTexture(canvas, { srgb: true })
  return texture
}

/** Brushed metal with directional micro-streaks (legs, frames, appliances). */
export const getBrushedMetalTextures = (): PbrTextureSet =>
  cached('brushed-metal', () => {
    const albedo = makeCanvas(512)
    const rough = makeCanvas(512)
    if (!albedo || !rough) return EMPTY_SET
    const size = albedo.size
    const albedoData = albedo.ctx.createImageData(size, size)
    const roughData = rough.ctx.createImageData(size, size)
    for (let y = 0; y < size; y += 1) {
      const line = hash2(0, y, 7)
      for (let x = 0; x < size; x += 1) {
        const streak = fbm(x * 0.004, y * 0.6, 29, 3)
        const shade = 196 + (line - 0.5) * 16 + (streak - 0.5) * 22
        const index = (x + y * size) * 4
        albedoData.data[index] = shade
        albedoData.data[index + 1] = shade * 1.005
        albedoData.data[index + 2] = shade * 1.015
        albedoData.data[index + 3] = 255
        const roughness = 92 + (streak - 0.5) * 60 + (line - 0.5) * 28
        roughData.data[index] = roughness
        roughData.data[index + 1] = roughness
        roughData.data[index + 2] = roughness
        roughData.data[index + 3] = 255
      }
    }
    albedo.ctx.putImageData(albedoData, 0, 0)
    rough.ctx.putImageData(roughData, 0, 0)
    return {
      map: toTexture(albedo.canvas, { srgb: true }),
      roughnessMap: toTexture(rough.canvas),
    }
  })
