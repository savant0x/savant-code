/**
 * Cyberpunk surface textures for the office deck: the tech floor and dark
 * wall panels (FID-2026-0831-002 P6b — operator: "textures need to be
 * cyberpunk ... glows"). Generators extracted verbatim from
 * procedural-textures.ts; noise/canvas machinery comes from machinery.ts.
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
