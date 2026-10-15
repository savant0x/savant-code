/**
 * Prop textures for the office deck: the Savant neon-glow emblem and brushed
 * metal. Generators extracted verbatim from procedural-textures.ts;
 * noise/canvas machinery comes from machinery.ts.
 */

import {
  cached,
  EMPTY_SET,
  fbm,
  hash2,
  makeCanvas,
  toTexture,
  type PbrTextureSet,
} from './machinery'

import type * as THREE from 'three'

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
