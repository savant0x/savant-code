/**
 * Minimal zero-dependency PNG decoder for the verify harness.
 *
 * Supports what headless Chromium screenshots emit: 8-bit depth, color type
 * 2 (RGB) or 6 (RGBA), no interlace. Enough for composited-raster contrast
 * math without pulling an image library into the skill.
 */
import { inflateSync } from 'node:zlib'

export interface DecodedPng {
  width: number
  height: number
  /** RGBA, 4 bytes per pixel, row-major. */
  rgba: Uint8Array
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  )
}

function hasSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

interface Chunk {
  type: string
  data: Uint8Array
}

function parseChunks(bytes: Uint8Array): Chunk[] {
  const chunks: Chunk[] = []
  let offset = 8
  while (offset + 8 <= bytes.length) {
    const length = readU32(bytes, offset)
    let type = ''
    for (let i = 0; i < 4; i += 1) {
      type += String.fromCharCode(bytes[offset + 4 + i] ?? 0)
    }
    const start = offset + 8
    if (start + length > bytes.length) break
    chunks.push({ type, data: bytes.slice(start, start + length) })
    offset = start + length + 4 // skip CRC
  }
  return chunks
}

/** Decode an 8-bit RGB/RGBA non-interlaced PNG buffer to RGBA pixels. */
export function decodePng(buffer: Uint8Array): DecodedPng {
  if (!hasSignature(buffer)) throw new Error('not a PNG buffer')
  const chunks = parseChunks(buffer)
  const ihdr = chunks.find((chunk) => chunk.type === 'IHDR')
  if (ihdr === undefined || ihdr.data.length < 13)
    throw new Error('missing IHDR chunk')
  const width = readU32(ihdr.data, 0)
  const height = readU32(ihdr.data, 4)
  const bitDepth = ihdr.data[8] ?? 0
  const colorType = ihdr.data[9] ?? 0
  const interlace = ihdr.data[12] ?? 0
  if (bitDepth !== 8)
    throw new Error(`unsupported bit depth ${bitDepth} (want 8)`)
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(
      `unsupported color type ${colorType} (want 2=RGB or 6=RGBA)`,
    )
  }
  if (interlace !== 0) throw new Error('interlaced PNG not supported')
  const channels = colorType === 6 ? 4 : 3
  const idat = Buffer.concat(
    chunks
      .filter((chunk) => chunk.type === 'IDAT')
      .map((chunk) => Buffer.from(chunk.data)),
  )
  const raw = inflateSync(idat)
  const stride = width * channels
  const expected = (stride + 1) * height
  if (raw.length < expected)
    throw new Error(`truncated PNG data (${raw.length} < ${expected})`)
  const rgba = new Uint8Array(width * height * 4)
  let previous = new Uint8Array(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)] ?? 0
    const line = new Uint8Array(stride)
    for (let i = 0; i < stride; i += 1) {
      const rawByte = raw[y * (stride + 1) + 1 + i] ?? 0
      const left = i >= channels ? (line[i - channels] ?? 0) : 0
      const up = previous[i] ?? 0
      const upperLeft = i >= channels ? (previous[i - channels] ?? 0) : 0
      let value: number
      switch (filter) {
        case 1:
          value = rawByte + left
          break
        case 2:
          value = rawByte + up
          break
        case 3:
          value = rawByte + Math.floor((left + up) / 2)
          break
        case 4:
          value = rawByte + paethPredictor(left, up, upperLeft)
          break
        default:
          value = rawByte
      }
      line[i] = value & 0xff
    }
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = x * channels
      const targetIndex = (y * width + x) * 4
      rgba[targetIndex] = line[sourceIndex] ?? 0
      rgba[targetIndex + 1] = line[sourceIndex + 1] ?? 0
      rgba[targetIndex + 2] = line[sourceIndex + 2] ?? 0
      rgba[targetIndex + 3] =
        channels === 4 ? (line[sourceIndex + 3] ?? 255) : 255
    }
    previous = line
  }
  return { width, height, rgba }
}
