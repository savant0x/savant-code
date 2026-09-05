/**
 * Organic surface textures for the office deck: warm oak floor, plaster
 * walls, and short-pile carpet. Generators extracted verbatim from
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
