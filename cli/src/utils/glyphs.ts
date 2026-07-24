/**
 * Glyph / Icon System (FID-2026-0720-033b Phase B)
 *
 * Centralized icon map with a 3-tier fallback chain:
 *   Nerd Font  →  Unicode  →  ASCII
 *
 * Detection result is cached per session. Consumers call `glyph(name)` to get
 * the best available character for the current terminal; the `Icon` component
 * (cli/src/components/savant-ui/icon.tsx) applies theme-token color and size.
 *
 * Graceful degradation (Law 14): detection failure defaults to the Unicode
 * tier; a missing icon name renders a `?` placeholder + warning log. A glyph
 * failure must NEVER prevent the UI from rendering text content.
 */

import { logger } from './logger'

/** Three supported font tiers, ordered richest → sparsest. */
export type GlyphTier = 'nerdfont' | 'unicode' | 'ascii'

/** Canonical icon names consumed by the Savant TUI. */
export type GlyphName =
  | 'phaseIdle'
  | 'phaseActive'
  | 'phaseComplete'
  | 'phaseError'
  | 'phaseAudit'
  | 'phaseFix'
  | 'phaseDone'
  | 'activityThinking'
  | 'activityTool'
  | 'activitySubagent'
  | 'activityResearching'
  | 'statusActive'
  | 'statusInactive'
  | 'statusPartial'
  | 'navBack'
  | 'navForward'
  | 'navUp'
  | 'navDown'
  | 'alertInfo'
  | 'alertSuccess'
  | 'alertWarning'
  | 'alertError'
  | 'toggleOn'
  | 'toggleOff'
  | 'treeExpanded'
  | 'treeCollapsed'
  | 'check'
  | 'cross'
  | 'arrowRight'
  | 'bullet'

/**
 * Per-icon, per-tier character table. Every name MUST define all three tiers
 * so the fallback chain always resolves. Add new icons here — never inline
 * icon characters in components (Law 13: one truth).
 */
const GLYPH_TABLE: Record<GlyphName, Record<GlyphTier, string>> = {
  // FSM phases
  phaseIdle: { nerdfont: '󰝤', unicode: '○', ascii: 'o' },
  phaseActive: { nerdfont: '󰦕', unicode: '●', ascii: '*' },
  phaseComplete: { nerdfont: '󰱐', unicode: '✓', ascii: '+' },
  phaseError: { nerdfont: '󰅗', unicode: '✗', ascii: 'x' },
  phaseAudit: { nerdfont: '󰡨', unicode: '●', ascii: '*' },
  phaseFix: { nerdfont: '󰆌', unicode: '↻', ascii: 'r' },
  phaseDone: { nerdfont: '󰄭', unicode: '◆', ascii: '#' },
  // Activity indicators
  activityThinking: { nerdfont: '󰥩', unicode: '⚡', ascii: '!' },
  activityTool: { nerdfont: '󰙨', unicode: '⚙', ascii: '@' },
  activitySubagent: { nerdfont: '󰣖', unicode: '◆', ascii: '>' },
  activityResearching: { nerdfont: '󰈉', unicode: '◇', ascii: '?' },
  // Status
  statusActive: { nerdfont: '󰪶', unicode: '●', ascii: '*' },
  statusInactive: { nerdfont: '󰪱', unicode: '○', ascii: 'o' },
  statusPartial: { nerdfont: '󰪴', unicode: '◐', ascii: '%' },
  // Navigation
  navBack: { nerdfont: '󰅂', unicode: '←', ascii: '<' },
  navForward: { nerdfont: '󰅀', unicode: '→', ascii: '>' },
  navUp: { nerdfont: '󰅎', unicode: '↑', ascii: '^' },
  navDown: { nerdfont: '󰅍', unicode: '↓', ascii: 'v' },
  // Alerts
  alertInfo: { nerdfont: '󰋼', unicode: 'ℹ', ascii: 'i' },
  alertSuccess: { nerdfont: '󰄬', unicode: '✓', ascii: '+' },
  alertWarning: { nerdfont: '󰀪', unicode: '⚠', ascii: '!' },
  alertError: { nerdfont: '󰅙', unicode: '✗', ascii: 'x' },
  // Toggles
  toggleOn: { nerdfont: '󰄯', unicode: '◉', ascii: '(x)' },
  toggleOff: { nerdfont: '󰄮', unicode: '◎', ascii: '( )' },
  // Tree
  treeExpanded: { nerdfont: '󰅀', unicode: '▼', ascii: 'v' },
  treeCollapsed: { nerdfont: '󰅂', unicode: '▶', ascii: '>' },
  // Misc
  check: { nerdfont: '󰄬', unicode: '✓', ascii: '+' },
  cross: { nerdfont: '󰅙', unicode: '✗', ascii: 'x' },
  arrowRight: { nerdfont: '󰅀', unicode: '→', ascii: '>' },
  bullet: { nerdfont: '󰧙', unicode: '•', ascii: '.' },
}

/** Terminal programs known to ship Nerd Font glyphs by default. */
const KNOWN_NERDFONT_TERMINALS = new Set(['wezterm', 'kitty', 'ghostty'])

/** Session-cached detection result. null = not yet probed. */
let nerdFontCache: boolean | null = null

/**
 * Probe whether the current terminal renders Nerd Font private-use glyphs.
 *
 * Heuristic: Nerd Font glyphs occupy the Unicode Supplementary Private Use
 * Area (U+E000–U+F8FF). Terminals without a Nerd Font render these as tofu
 * (missing-char boxes) or zero-width. We cannot directly measure rendered
 * width from inside OpenTUI, so we honor (in priority order):
 *   1. Explicit override via `SAVANT_GLYPH_TIER` env var
 *   2. Known Nerd Font terminal programs (TERM_PROGRAM allowlist)
 *   3. Default: false (Unicode tier) — safe everywhere
 *
 * The result is cached for the session. Failures default to false (Unicode).
 */
export const hasNerdFont = (): boolean => {
  if (nerdFontCache !== null) return nerdFontCache

  try {
    const override = (
      process.env.SAVANT_GLYPH_TIER ?? ''
    ).toLowerCase()
    if (override === 'nerdfont') {
      nerdFontCache = true
      return true
    }
    if (override === 'unicode' || override === 'ascii') {
      nerdFontCache = false
      return false
    }

    const termProgram = (process.env.TERM_PROGRAM ?? '').toLowerCase()
    // VS Code / Cursor render Nerd Font when the user has configured it; we
    // opt-in conservatively because the default editor font is not Nerd Font.
    nerdFontCache = KNOWN_NERDFONT_TERMINALS.has(termProgram)
    return nerdFontCache
  } catch (error) {
    logger.warn(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'Nerd Font detection failed — defaulting to Unicode tier',
    )
    nerdFontCache = false
    return false
  }
}

/** Resolve the active tier for the session. */
export const activeGlyphTier = (): GlyphTier =>
  hasNerdFont() ? 'nerdfont' : 'unicode'

/**
 * Resolve an icon to the best available character for the active tier.
 *
 * Falls through Unicode → ASCII if a tier is somehow missing (it never is —
 * the table is exhaustive — but the fallback defends against future edits).
 * Unknown names render `?` and log a warning (Law 14: never throw for a
 * cosmetic lookup).
 */
export const glyph = (name: GlyphName): string => {
  const entry = GLYPH_TABLE[name]
  if (!entry) {
    logger.warn({ glyphName: name }, 'Unknown glyph name — rendering placeholder')
    return '?'
  }

  const tier = activeGlyphTier()
  const primary = entry[tier]
  if (primary) return primary

  // Defensive fallbacks (table is exhaustive, but guard future edits).
  const unicode = entry.unicode
  if (unicode) return unicode
  return entry.ascii
}

/**
 * Reset detection cache. Exposed for tests so tier switching can be exercised
 * without env mutation leaking across cases.
 */
export const _resetGlyphCacheForTests = (): void => {
  nerdFontCache = null
}
