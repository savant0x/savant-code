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
  svgEntries.push(`  /** ${icon.name} (${icon.category}): ${icon.subject.replace(/`/g, "'")} */\n  ${constName}: \`${escaped}\`,`)

  // Build-time rasterization (Phase 0 ruling: @resvg/resvg-js, devDependency).
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: RASTER_SIZE },
    background: 'rgba(0,0,0,0)',
  })
  const pngBuffer = resvg.render().asPng()
  const dataUri = `data:image/png;base64,${pngBuffer.toString('base64')}`
  const dataUriEscaped = dataUri.replace(/`/g, '\\`')
  pngEntries.push(`  /** ${icon.name} — 256px PNG raster for TUI inline-image surfaces */\n  ${constName}: \`${dataUriEscaped}\`,`)
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
