/**
 * WCAG 2.1 AA composited-raster contrast math for the verify harness.
 *
 * Text color comes from computed styles; the background is sampled from the
 * decoded screenshot pixels in a band around each text bounding box, so text
 * over canvases/videos/gradients is measured against what is actually painted.
 * Following upstream semantics, a line is graded at its brightest passing
 * background frame.
 */
import type { DecodedPng } from './png.ts'

export interface TextBox {
  /** Stable identifier, e.g. "h1@2" (tag + occurrence index). */
  id: string
  colorRgb: [number, number, number]
  largeText: boolean
  rect: { x: number; y: number; width: number; height: number }
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface ContrastFailure {
  id: string
  ratio: number
  required: number
}

export function srgbChannelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  )
}

/** WCAG contrast ratio between two luminances; direction-free by definition. */
export function contrastRatio(lumaA: number, lumaB: number): number {
  const lighter = Math.max(lumaA, lumaB)
  const darker = Math.min(lumaA, lumaB)
  return (lighter + 0.05) / (darker + 0.05)
}

export function requiredRatio(largeText: boolean): number {
  return largeText ? 3 : 4.5
}

function pixelLuminance(
  frame: DecodedPng,
  x: number,
  y: number,
): number | undefined {
  if (x < 0 || y < 0 || x >= frame.width || y >= frame.height) return undefined
  const index = (y * frame.width + x) * 4
  const alpha = frame.rgba[index + 3] ?? 0
  if (alpha < 250) return undefined // transparent pixels carry no ground truth
  return relativeLuminance(
    frame.rgba[index] ?? 0,
    frame.rgba[index + 1] ?? 0,
    frame.rgba[index + 2] ?? 0,
  )
}

/**
 * Sample a 3px band just outside each edge of the box (the painted background
 * around the glyphs) and return every valid luminance found.
 */
export function backgroundBandLuminances(
  frame: DecodedPng,
  rect: Rect,
): number[] {
  const samples: number[] = []
  const step = 3
  const left = Math.round(rect.x) - 3
  const right = Math.round(rect.x + rect.width) + 3
  const top = Math.round(rect.y) - 3
  const bottom = Math.round(rect.y + rect.height) + 3
  for (let x = left; x <= right; x += step) {
    for (const y of [top, bottom]) samples.push(y)
  }
  for (let y = top; y <= bottom; y += step) {
    for (const x of [left, right]) samples.push(x)
  }
  const values = new Map<string, number>()
  let cursor = 0
  for (let x = left; x <= right; x += step) {
    const yTop = samples[cursor]
    cursor += 1
    const yBottom = samples[cursor]
    cursor += 1
    const lumTop = pixelLuminance(frame, x, yTop ?? -1)
    const lumBottom = pixelLuminance(frame, x, yBottom ?? -1)
    if (lumTop !== undefined) values.set(`${x}:${yTop}`, lumTop)
    if (lumBottom !== undefined) values.set(`${x}:${yBottom}`, lumBottom)
  }
  for (let y = top; y <= bottom; y += step) {
    const xLeft = samples[cursor]
    cursor += 1
    const xRight = samples[cursor]
    cursor += 1
    const lumLeft = pixelLuminance(frame, xLeft ?? -1, y)
    const lumRight = pixelLuminance(frame, xRight ?? -1, y)
    if (lumLeft !== undefined) values.set(`${xLeft}:${y}`, lumLeft)
    if (lumRight !== undefined) values.set(`${xRight}:${y}`, lumRight)
  }
  return [...values.values()]
}

/**
 * Grade one decoded frame against its text boxes. Returns one failure per box
 * that misses its threshold at this frame's brightest sampled background.
 */
export function evaluateFrameContrast(
  frame: DecodedPng,
  boxes: TextBox[],
): ContrastFailure[] {
  const failures: ContrastFailure[] = []
  for (const box of boxes) {
    const fullyVisible =
      box.rect.x >= 0 &&
      box.rect.y >= 0 &&
      box.rect.x + box.rect.width <= frame.width &&
      box.rect.y + box.rect.height <= frame.height
    if (!fullyVisible || box.rect.width < 8 || box.rect.height < 6) continue
    const band = backgroundBandLuminances(frame, box.rect)
    if (band.length === 0) continue
    const brightestBackground = Math.max(...band)
    const textLuminance = relativeLuminance(...box.colorRgb)
    const ratio = contrastRatio(textLuminance, brightestBackground)
    const required = requiredRatio(box.largeText)
    if (ratio < required) {
      failures.push({
        id: box.id,
        ratio: Math.round(ratio * 100) / 100,
        required,
      })
    }
  }
  return failures
}
