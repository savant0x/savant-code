/**
 * Savant TUI raster icon hook (FID-2026-1009-004 Phase 0).
 *
 * Produces a base64-PNG data URI for a family icon when the active terminal
 * supports an inline-image protocol (iTerm2/Kitty via
 * `cli/src/utils/terminal-images.ts`), and `null` otherwise. Callers render
 * the escape sequence where supported and MUST fall back to their existing
 * glyph/ASCII surface when null — a raster miss degrades to text, never an
 * error (Law 14).
 *
 * The resolved value is memoized per icon name and detection result; the
 * protocol cache lives in `terminal-images.ts` (process lifetime, test
 * resettable).
 */

import { SAVANT_ICON_PNG_DATA_URI, type SavantIconName } from '../constants/savant-icons'
import { detectTerminalImageSupport } from '../utils/terminal-images'

const RE_KEY = new RegExp(`^ICON_`)
const DENY_KEY = /_PNG$/

/** Stable icon name → generated constant key (`ICON_<Name>`). */
function toKey(name: SavantIconName): keyof typeof SAVANT_ICON_PNG_DATA_URI {
  return name as keyof typeof SAVANT_ICON_PNG_DATA_URI
}

/**
 * Resolve the raster data URI for an icon under the current terminal.
 * Returns `null` when the terminal has no inline-image protocol.
 */
export function savantRasterDataUri(
  name: SavantIconName,
): string | null {
  const protocol = detectTerminalImageSupport()
  if (protocol === 'none') return null
  const uri = SAVANT_ICON_PNG_DATA_URI[toKey(name)]
  if (typeof uri === 'string' && uri.length > 0) return uri
  return null
}

/**
 * Constant-key name helper for tests and callers: verifies a name exists in
 * the generated set and is not one of the PNG-member exports. Never throws —
 * returns the sanitized name or null (Law 14).
 */
export function validateSavantIconName(candidate: string): string | null {
  if (DENY_KEY.test(candidate)) return null
  if (!RE_KEY.test(candidate)) return null
  return candidate
}
