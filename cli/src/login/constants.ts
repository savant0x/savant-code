import { readFileSync } from 'fs'
import { join } from 'path'

import { SAVANT_FREE_WEB_URL_PROD } from '@savant-code/common/constants/hosts'
import { env, IS_DEV } from '@savant-code/common/env'

import { IS_SAVANT_FREE } from '../utils/constants'

// Get the website URL from environment or use default
export const WEBSITE_URL = env.NEXT_PUBLIC_SAVANT_FREE_APP_URL || 'https://savant-code.com'

// SavantFree login flow uses the savant-free web app instead of savant-code.com
const SAVANT_FREE_WEB_URL = IS_DEV
  ? 'http://localhost:3002'
  : (env.NEXT_PUBLIC_SAVANT_FREE_APP_URL ?? SAVANT_FREE_WEB_URL_PROD)
export const LOGIN_WEBSITE_URL = IS_SAVANT_FREE ? SAVANT_FREE_WEB_URL : WEBSITE_URL

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
export const LOGO_SMALL = IS_SAVANT_FREE ? LOGO_SMALL_SAVANT_FREE : LOGO_SMALL_SAVANT_CODE

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

// Modal sizing constants
export const DEFAULT_TERMINAL_HEIGHT = 24
export const MODAL_VERTICAL_MARGIN = 2 // Space for top positioning (1) + bottom margin (1)
export const MAX_MODAL_BASE_HEIGHT = 22 // Maximum height when no warning banner
export const WARNING_BANNER_HEIGHT = 3 // Height of invalid credentials banner (padding + text + padding)

// Sheen animation constants
export const SHEEN_WIDTH = 5
export const SHEEN_STEP = 2 // Advance 2 positions per frame for efficiency
export const SHEEN_INTERVAL_MS = 150
