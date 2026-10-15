/**
 * Generates src/commands/graph-export/character.ts from:
 *  - ../../assets/logo.png            → CHARACTER_WATERMARK_DATA_URI
 *    (full character art, document-view watermark)
 *  - ../assets/character-logo.png     → CHARACTER_LOGO_DATA_URI
 *    (circular crop of the same art, header + ROOT planet emblem)
 *
 * The emitted constants are single long base64 data URIs (like the cytoscape
 * and sigma bundles); prettier cannot reformat template literals this wide,
 * so the generated file is prettier-ignored (see .prettierignore).
 *
 * Usage: bun cli/scripts/generate-character-watermark.ts
 */
import fs from 'fs'
import path from 'path'

const root = path.resolve(__dirname, '../..')
const out = path.resolve(__dirname, '../src/commands/graph-export/character.ts')

const watermarkSource = path.join(root, 'assets/logo.png')
const logoSource = path.join(root, 'cli/assets/character-logo.png')

if (!fs.existsSync(watermarkSource)) {
  console.error(`Watermark source not found: ${watermarkSource}`)
  process.exit(1)
}
if (!fs.existsSync(logoSource)) {
  console.error(`Logo source not found: ${logoSource}`)
  process.exit(1)
}

const watermark = fs.readFileSync(watermarkSource).toString('base64')
const logo = fs.readFileSync(logoSource).toString('base64')
const watermarkKb = Math.round((watermark.length * 3) / 4 / 1024)
const logoKb = Math.round((logo.length * 3) / 4 / 1024)

const content = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Savant character logo assets for the Code Universe export (FID-2026-0807-009).
 *
 * - CHARACTER_WATERMARK_DATA_URI — full character art (${watermarkKb} KB),
 *   the document-view background at 25% opacity. Source: assets/logo.png.
 * - CHARACTER_LOGO_DATA_URI — circular crop (${logoKb} KB), the header logo +
 *   ROOT planet emblem. Source: cli/assets/character-logo.png.
 *
 * Regenerate with: bun cli/scripts/generate-character-watermark.ts
 */
export const CHARACTER_WATERMARK_DATA_URI =
  \`data:image/png;base64,${watermark}\`
export const CHARACTER_LOGO_DATA_URI =
  \`data:image/png;base64,${logo}\`
`

fs.writeFileSync(out, content)
console.log(
  `Wrote ${out} (${Math.round(content.length / 1024)} KB source; watermark ${watermarkKb} KB, logo ${logoKb} KB)`,
)
