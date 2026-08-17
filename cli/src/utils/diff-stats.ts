/**
 * Diff parsing + tint helpers — FID-2026-0804-010.
 *
 * Pure, renderer-agnostic utilities that power two features:
 * 1. `parseDiffLines` classifies every row of a unified-diff string
 *    (`add` / `remove` / `context` / `hunk` / `header`) and counts the real
 *    added/removed content lines (excluding `+++`/`---` file headers and `@@`
 *    hunks), which feeds the `[-N/+M]` edit-stats counter.
 * 2. `blendHex` computes the "50% opacity" tint. Terminals/OpenTUI cannot
 *    render true alpha, so a 50%-opacity neon overlay on the transparent
 *    backdrop is defined as a 50/50 linear RGB blend with the theme
 *    background — deterministic and unit-testable.
 */

export type DiffLineKind = 'add' | 'remove' | 'context' | 'hunk' | 'header'

export interface DiffLine {
  kind: DiffLineKind
  text: string
  /**
   * Old-file line number for `context`/`remove` rows inside an active hunk
   * (derived from the `@@ -a,b +c,d @@` header). Blank when outside a hunk
   * or when the old side starts at 0 (create-file).
   */
  oldLine?: number
  /**
   * New-file line number for `context`/`add` rows inside an active hunk.
   * Blank when outside a hunk or when the new side starts at 0 (deleted
   * file).
   */
  newLine?: number
}

export interface DiffStats {
  lines: DiffLine[]
  /** Count of real added content lines (excludes `+++` headers + `@@` hunks). */
  added: number
  /** Count of real removed content lines (excludes `---` headers + `@@` hunks). */
  removed: number
}

/** Neon green — added-line tint source (FID-2026-0804-010). */
export const NEON_GREEN = '#39ff14'
/** Neon red — removed-line tint source (FID-2026-0804-010). */
export const NEON_RED = '#ff3131'
/** Dark foreground used on the green-tinted add rows for contrast. */
export const DIFF_ADD_FOREGROUND = '#0a3d0a'
/** Dark foreground used on the red-tinted remove rows for contrast. */
export const DIFF_REMOVE_FOREGROUND = '#3d0a0a'

/**
 * Prefixes that mark a unified-diff header row. Checked BEFORE the generic
 * `+`/`-` classification so `+++ b/file` / `--- a/file` never count as
 * additions/removals.
 */
const HEADER_PREFIXES = [
  'diff ',
  'index ',
  'new file ',
  'deleted file ',
  'old mode ',
  'new mode ',
  'similarity index ',
  'rename from ',
  'rename to ',
  'Binary files ',
  '+++',
  '---',
]

/**
 * `@@ -a,b +c,d @@` hunk header. Captures the old/new hunk START line
 * numbers (the count parts are irrelevant to gutter numbering).
 */
const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

/**
 * Parse a unified-diff string into classified rows + add/remove counts.
 *
 * Classification order (first match wins):
 *   header  → diff/index/new-file/+++/---/... prefixes
 *   hunk    → starts with `@@`
 *   add     → starts with `+`
 *   remove  → starts with `-`
 *   context → anything else (including blank lines, preserved as rows)
 *
 * Line numbering (gutter): each `@@ -a,b +c,d @@` resets the old/new
 * counters to `a`/`c`. `context` prints + advances both; `remove` prints +
 * advances old only; `add` prints + advances new only. A side whose start is
 * 0 (create-file old side, delete-file new side) prints no numbers for that
 * side, and malformed hunk headers deactivate numbering — a blank gutter,
 * never a fabricated number.
 *
 * @param diffText - Raw unified diff (`unifiedDiff`/`patch` text).
 */
export function parseDiffLines(diffText: string): DiffStats {
  const lines: DiffLine[] = []
  let added = 0
  let removed = 0
  let oldCounter = 0
  let newCounter = 0

  for (const raw of diffText.split('\n')) {
    let kind: DiffLineKind
    if (HEADER_PREFIXES.some((prefix) => raw.startsWith(prefix))) {
      kind = 'header'
    } else if (raw.startsWith('@@')) {
      kind = 'hunk'
    } else if (raw.startsWith('+')) {
      kind = 'add'
      added += 1
    } else if (raw.startsWith('-')) {
      kind = 'remove'
      removed += 1
    } else {
      kind = 'context'
    }

    const line: DiffLine = { kind, text: raw }
    if (kind === 'hunk') {
      const match = HUNK_RE.exec(raw)
      oldCounter = match ? Number(match[1]) : 0
      newCounter = match ? Number(match[2]) : 0
    } else if (kind === 'context') {
      if (oldCounter > 0) {
        line.oldLine = oldCounter
        oldCounter += 1
      }
      if (newCounter > 0) {
        line.newLine = newCounter
        newCounter += 1
      }
    } else if (kind === 'remove') {
      if (oldCounter > 0) {
        line.oldLine = oldCounter
        oldCounter += 1
      }
    } else if (kind === 'add') {
      if (newCounter > 0) {
        line.newLine = newCounter
        newCounter += 1
      }
    }
    lines.push(line)
  }

  return { lines, added, removed }
}

/**
 * Extract the edited file path from a unified diff for the header strip.
 *
 * Prefers the `+++ b/…` side (git's new-file side); falls back to the
 * `diff --git … b/…` trailer. Empty string when neither is present — the
 * caller renders a bare counter header.
 */
export function getDiffHeaderPath(diffText: string): string {
  const plus = /^\+\+\+ b?\/(.+)$/m.exec(diffText)
  if (plus) return plus[1]
  const git = /^diff --git a\/.+? b\/(.+)$/m.exec(diffText)
  if (git) return git[1]
  return ''
}

function parseHex(color: string): { r: number; g: number; b: number } {
  let hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((ch) => ch + ch)
      .join('')
  }
  // Full-hex regex guard: parseInt would otherwise partially parse malformed
  // 6-char strings (e.g. '12345g' → 0x12345) and return a bogus color.
  if (!/^[0-9a-f]{6}$/i.test(hex)) {
    return { r: 0, g: 0, b: 0 }
  }
  const value = Number.parseInt(hex, 16)
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  }
}

/**
 * Mix two hex colors linearly: `t = 0` yields `a`, `t = 1` yields `b`.
 * `t = 0.5` is the "50% opacity" semantic for overlaying a neon color on the
 * theme background (see module docs). Malformed input degrades to black.
 */
export function blendHex(a: string, b: string, t: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  const clamp = Math.min(1, Math.max(0, t))
  const mix = (x: number, y: number) => Math.round(x + (y - x) * clamp)
  const toHex = (v: number) => v.toString(16).padStart(2, '0')
  return `#${toHex(mix(ca.r, cb.r))}${toHex(mix(ca.g, cb.g))}${toHex(
    mix(ca.b, cb.b),
  )}`
}

/**
 * WCAG 2.x relative luminance of a hex color (0 = black, 1 = white).
 * sRGB-linearized per the WCAG contrast spec. Malformed input degrades to
 * black (0), matching `parseHex`'s fallback.
 */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseHex(color)
  const linear = (v: number): number => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}
