import type { UniverseImageDocument } from './types'

export const PREVIEW_MAX_BYTES = 1024 * 1024
export const DEFAULT_DOCUMENT_IMAGE_BYTES = 2 * 1024 * 1024
export const DEFAULT_DOCUMENT_TOTAL_MEDIA_BYTES = 16 * 1024 * 1024
export const IMAGE_TYPES: Record<string, UniverseImageDocument['mime']> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}
export const UNSUPPORTED_IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.heic',
  '.heif',
  '.ico',
  '.svg',
  '.tif',
  '.tiff',
])
export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
export const REGION_COLORS = [
  '#18faf9',
  '#4fa8ff',
  '#a78bfa',
  '#f472b6',
  '#f59e0b',
  '#34d399',
  '#fb7185',
  '#22d3ee',
]

export interface DocumentBudget {
  textBytes: number
  mediaBytes: number
  maxTotalTextBytes?: number
  maxTotalMediaBytes: number
}
