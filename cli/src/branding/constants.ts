import { readFileSync } from 'fs'
import { join } from 'path'

import { SAVANT_FREE_WEB_URL_PROD } from '@savant-code/common/constants/hosts'
import { env, IS_DEV } from '@savant-code/common/env'

import { IS_SAVANT_FREE } from '../utils/constants'

// Get the website URL from environment or use default. FID-2026-0806-013:
// the legacy NEXT_PUBLIC_FREEBUFF_APP_URL env name is read as a fallback so
// pre-rebrand env files keep pointing at the right app.
const envWebUrl =
  env.NEXT_PUBLIC_SAVANT_FREE_APP_URL ??
  env.NEXT_PUBLIC_FREEBUFF_APP_URL ??
  undefined

export const WEBSITE_URL = envWebUrl || 'https://savant-code.com'

// SavantFree login flow uses the SavantFree web app URL (now on
// savant-code.com, FID-2026-0806-013)
const SAVANT_FREE_WEB_URL = IS_DEV
  ? 'http://localhost:3002'
  : (envWebUrl ?? SAVANT_FREE_WEB_URL_PROD)
export const LOGIN_WEBSITE_URL = IS_SAVANT_FREE
  ? SAVANT_FREE_WEB_URL
  : WEBSITE_URL

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

const LOGO_SAVANT_CODE = getLogoFromArt()
const LOGO_SMALL_SAVANT_CODE = getLogoFromArt()
const LOGO_SAVANT_FREE = getLogoFromArt()
const LOGO_SMALL_SAVANT_FREE = getLogoFromArt()

export const LOGO = IS_SAVANT_FREE ? LOGO_SAVANT_FREE : LOGO_SAVANT_CODE
export const LOGO_SMALL = IS_SAVANT_FREE
  ? LOGO_SMALL_SAVANT_FREE
  : LOGO_SMALL_SAVANT_CODE

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
