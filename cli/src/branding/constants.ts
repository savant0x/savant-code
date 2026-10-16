import { readFileSync } from 'fs'
import { join } from 'path'

export const WEBSITE_URL = 'https://savant-code.com'

export const LOGIN_WEBSITE_URL = WEBSITE_URL

// Read logo from art file — single source of truth
const ART_PATH = join(import.meta.dir, '..', 'art', 'savant-text-graf.md')
let _logoCache: string | null = null
function getLogoFromArt(): string {
  if (_logoCache) return _logoCache
  try {
    _logoCache = '\n' + readFileSync(ART_PATH, 'utf-8')
  } catch {
    _logoCache = '\nSAVANT'
  }
  return _logoCache
}

/** Test isolation: clears the memoized art-file logo — process-lifetime state
 *  `bun test` shares across files (FID-2026-1007-002). */
export function resetLogoCache(): void {
  _logoCache = null
}

const LOGO_SAVANT_CODE = getLogoFromArt()
const LOGO_SMALL_SAVANT_CODE = getLogoFromArt()
export const LOGO = LOGO_SAVANT_CODE
export const LOGO_SMALL = LOGO_SMALL_SAVANT_CODE

// Characters that receive the sheen animation effect (block chars + border/shadow)
export const SHADOW_CHARS = new Set([
  '╚',
  '═',
  '╝',
  '║',
  '╔',
  '╗',
  '╠',
  '╣',
  '╦',
  '╩',
  '╬',
  '▄',
  '▀',
  '█',
])

// Sheen animation constants
export const SHEEN_WIDTH = 5
export const SHEEN_STEP = 2 // Advance 2 positions per frame for efficiency
export const SHEEN_INTERVAL_MS = 150
