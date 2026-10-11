/**
 * Savant iconset codegen (FID-2026-1009-004 Phase 0).
 *
 * Reads the canonical family in `art/icons/cyberpunk/` (manifest v3.0.0) and
 * emits `cli/src/constants/savant-icons.ts`: per-icon inline-SVG strings, a
 * stable name union, and base64-PNG data URIs rasterized at build time via
 * `@resvg/resvg-js` for the TUI's base64-PNG image surfaces
 * (`cli/src/utils/terminal-images.ts`).
 *
 * Single source of truth stays the SVG family + manifest — the emitted module
 * is generated, never hand-edited (same discipline as fontawesome.ts).
 *
 * Usage: bun cli/scripts/generate-savant-icons.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, basename } from 'node:path'

import { Resvg } from '@resvg/resvg-js'

const ROOT = join(import.meta.dir, '..', '..')
const FAMILY_DIR = join(ROOT, 'art', 'icons', 'cyberpunk')
const OUT_PATH = join(ROOT, 'cli', 'src', 'constants', 'savant-icons.ts')

interface ManifestIcon {
  file: string
  name: string
  category: string
  subject: string
}

interface Manifest {
  set: string
  version: string
  viewBox: string
  palette: Record<string, string>
  icons: ManifestIcon[]
}

function toPascalCase(stem: string): string {
  return stem
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

const manifest: Manifest = JSON.parse(
  readFileSync(join(FAMILY_DIR, 'manifest.json'), 'utf8'),
)

const svgFiles = readdirSync(FAMILY_DIR).filter((f) => f.endsWith('.svg'))
if (svgFiles.length !== manifest.icons.length) {
  throw new Error(
    `manifest/family drift: ${svgFiles.length} SVG files vs ${manifest.icons.length} manifest entries`,
  )
}

// Raster target: 256px square, transparent background — sized for the TUI's
// inline-image aspect handling while staying crisp on retina cells.
const RASTER_SIZE = 256

const parts: string[] = []
parts.push(`/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: art/icons/cyberpunk/ (manifest v${manifest.version}).
 * Regenerate: bun cli/scripts/generate-savant-icons.ts
 *
 * Carries the cyberdeck icon family for CLI/product surfaces (FID-2026-1009-004):
 *  - SAVANT_ICON_SVG: inline-SVG strings keyed by stable names (HTML/desktop)
 *  - SAVANT_ICON_PNG_DATA_URI: build-time-rasterized PNG data URIs (TUI
 *    inline-image protocols via cli/src/utils/terminal-images.ts)
 * Values are plain strings — no runtime file reads, packaging-proof.
 */
`)

const names: string[] = []
const svgEntries: string[] = []
const pngEntries: string[] = []

for (const icon of manifest.icons) {
  const stem = basename(icon.file, '.svg')
  const constName = `ICON_${toPascalCase(stem)}`
  names.push(constName)

  const svg = readFileSync(join(FAMILY_DIR, icon.file), 'utf8').trim()
  const escaped = svg.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
  svgEntries.push(
    `  /** ${icon.name} (${icon.category}): ${icon.subject.replace(/`/g, "'")} */\n  ${constName}: \`${escaped}\`,`,
  )

  // Build-time rasterization (Phase 0 ruling: @resvg/resvg-js, devDependency).
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: RASTER_SIZE },
    background: 'rgba(0,0,0,0)',
  })
  const pngBuffer = resvg.render().asPng()
  const dataUri = `data:image/png;base64,${pngBuffer.toString('base64')}`
  const dataUriEscaped = dataUri.replace(/`/g, '\\`')
  pngEntries.push(
    `  /** ${icon.name} — 256px PNG raster for TUI inline-image surfaces */\n  ${constName}: \`${dataUriEscaped}\`,`,
  )
}

parts.push(`/** Stable icon names (1:1 with the family files; never renamed casually). */
export type SavantIconName =
${names.map((n) => `  | '${n}'`).join('\n')}
`)

parts.push(`/** Inline SVG strings keyed by stable name. */
export const SAVANT_ICON_SVG = {
${svgEntries.join('\n')}
} as const
`)

/**
 * Export-report icon mapping (FID-2026-1009-004 Phase 1, Q1 full replacement).
 * One truth table: semantic slot → family icon name. Every FA call site in
 * cli/src/commands/export-conversation/ renders through one of these slots;
 * each pair cites the manifest category it draws from. Verified against the
 * 21-site census (render-blocks 10, render-message 5, template 6, drive-report
 * 2, render-text 1, template-css-part2a sizing rule).
 */
const EXPORT_ICON_SLOTS: Array<[string, string, string]> = [
  ['toolBadge', 'ICON_ObjTerminal', 'dev-object-mark'],
  ['inputSummary', 'ICON_NavForward', 'nav-glyph'],
  ['outputSummary', 'ICON_NavDown', 'nav-glyph'],
  ['agentHeader', 'ICON_Orchestrator', 'echo-agent'],
  ['planHeader', 'ICON_Scope', 'protocol-mark'],
  ['imageNotice', 'ICON_ObjFile', 'dev-object-mark'],
  ['agentListNotice', 'ICON_CmdAgents', 'command-mark'],
  ['attachmentNotice', 'ICON_ObjTag', 'dev-object-mark'],
  ['userMarker', 'ICON_OrchestratorSolid', 'variation-mark'],
  ['warningMarker', 'ICON_AlertWarning', 'alert-glyph'],
  [
    'copyButton',
    'ICON_ObjFile',
    'dev-object-mark — document = the copied content (no clipboard mark in the family)',
  ],
  ['copySuccess', 'ICON_AlertSuccess', 'alert-glyph'],
  ['copyFailure', 'ICON_AlertError', 'alert-glyph'],
  ['expandAll', 'ICON_NavDown', 'nav-glyph'],
  ['collapseAll', 'ICON_NavUp', 'nav-glyph'],
  ['thinkingIcon', 'ICON_ActivityThinking', 'activity-indicator'],
  ['autoDriveHeader', 'ICON_RunActive', 'run-mark'],
  ['runLogHeader', 'ICON_Loop', 'protocol-mark'],
]

const slotEntries = EXPORT_ICON_SLOTS.map(
  ([slot, icon, category]) =>
    `  /** ${slot} ← ${category} */\n  ${slot}: '${icon}',`,
)

parts.push(`/** Export-report slot → family icon name (Phase 1 one-truth mapping). */
export const SAVANT_EXPORT_ICON_MAP = {
${slotEntries.join('\n')}
} as const

/** Mnemonic aliases the export renderers read (Law 13: one truth). */
export type SavantExportIconSlot = keyof typeof SAVANT_EXPORT_ICON_MAP

/**
 * Inline SVG for an export slot, with the family's neon palette preserved.
 * Marks are used as-authored — theme-relative sizing/contrast stays CSS-side
 * ('svg-ico' rules) per GREEN. Unknown slots render empty, never throw.
 */
export function savantExportIconSvg(slot: SavantExportIconSlot): string {
  const icon = SAVANT_EXPORT_ICON_MAP[slot]
  const svg = SAVANT_ICON_SVG[icon]
  return svg
}
`)

parts.push(`/** Build-time-rasterized 256px PNG data URIs keyed by stable name. */
export const SAVANT_ICON_PNG_DATA_URI = {
${pngEntries.join('\n')}
} as const
`)

parts.push(`/** Manifest identity block for drift checks. */
export const SAVANT_ICONSET = {
  set: '${manifest.set}',
  version: '${manifest.version}',
  count: ${manifest.icons.length},
  rasterSize: ${RASTER_SIZE},
} as const
`)

writeFileSync(OUT_PATH, parts.join('\n'), 'utf8')
console.log(
  `savant-icons: wrote ${names.length} icons (SVG + ${RASTER_SIZE}px PNG) → cli/src/constants/savant-icons.ts`,
)

/**
 * Desktop emission (FID-2026-1009-004 Phase 3): the same sources emit a
 * desktop module — inline SVG strings + the manifest six-token palette —
 * so the Tauri renderer consumes the family with zero asset copying and
 * the palette contract can never drift between workspaces (one codegen).
 * SVG-only: the desktop renderer is DOM-native and needs no PNG rasters.
 */
const DESKTOP_OUT_PATH = join(ROOT, 'desktop', 'src', 'icons.generated.ts')

const desktopSvgEntries: string[] = []
for (const icon of manifest.icons) {
  const stem = basename(icon.file, '.svg')
  const constName = `ICON_${toPascalCase(stem)}`
  const svg = readFileSync(join(FAMILY_DIR, icon.file), 'utf8').trim()
  const escaped = svg.replace(/\\/g, '\\\\').replace(/`/g, '\\`')
  desktopSvgEntries.push(
    `  /** ${icon.name} (${icon.category}): ${icon.subject.replace(/`/g, "'")} */\n  ${constName}: \`${escaped}\`,`,
  )
}

const desktopPaletteEntries = Object.entries(manifest.palette)
  .map(([k, v]) => `  ${k}: '${v}',`)
  .join('\n')

const desktopParts: string[] = []
desktopParts.push(`/**
 * GENERATED FILE — do not edit by hand.
 *
 * Source of truth: art/icons/cyberpunk/ (manifest v${manifest.version}).
 * Regenerate from the repo root: bun cli/scripts/generate-savant-icons.ts
 *
 * FID-2026-1009-004 Phase 3: inline-SVG strings + the manifest palette for
 * the Tauri (DOM-native) renderer. SVG only — no PNG rasters, no runtime
 * asset reads.
 */

export const SAVANT_ICON_SVG = {
${desktopSvgEntries.join('\n')}
} as const

export type SavantIconName = keyof typeof SAVANT_ICON_SVG

/** Manifest six-token palette (verbatim, single-truth emission). */
export const ICON_PALETTE = {
${desktopPaletteEntries}
} as const

/**
 * Render an inline family SVG sized by the host CSS (default 1em square).
 * Unknown names render empty — a cosmetic lookup never throws (Law 14).
 */
export function savantIconSvg(name: SavantIconName): string {
  const svg = SAVANT_ICON_SVG[name]
  if (typeof svg !== 'string' || !svg.startsWith('<svg')) return ''
  return svg
}
`)

writeFileSync(DESKTOP_OUT_PATH, desktopParts.join('\n'), 'utf8')
console.log(
  `savant-icons: wrote ${names.length} icons (SVG) → desktop/src/icons.generated.ts`,
)
