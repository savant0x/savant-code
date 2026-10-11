#!/usr/bin/env bun
// Icon-palette check (T176) — enforces the manifest's paletteSources
// claim: every SVG under art/icons/cyberpunk/ may use only the tokens
// declared in ICON_PALETTE (cli/src/utils/theme-system/icon-palette.ts),
// and the manifest's palette block must match the module exactly.
// Metadata is a claim; the files are ground truth.

import fs from 'node:fs'
import path from 'node:path'

import { ICON_PALETTE } from '../cli/src/utils/theme-system/icon-palette'

const repoRoot = path.resolve(import.meta.dir, '..')
const iconDir = path.join(repoRoot, 'art', 'icons', 'cyberpunk')
const manifestPath = path.join(iconDir, 'manifest.json')

function main(): number {
  const declared = new Set(
    Object.values(ICON_PALETTE).map((token) => token.toLowerCase()),
  )
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    palette: Record<string, string>
  }

  const problems: string[] = []

  // 1. The manifest palette block must be exactly the module's tokens.
  for (const [name, value] of Object.entries(manifest.palette)) {
    const moduleValue = ICON_PALETTE[name as keyof typeof ICON_PALETTE]
    if (moduleValue === undefined) {
      problems.push(
        `manifest palette token "${name}" (${value}) has no ICON_PALETTE entry`,
      )
    } else if (moduleValue.toLowerCase() !== value.toLowerCase()) {
      problems.push(
        `manifest palette token "${name}": manifest ${value} != module ${moduleValue}`,
      )
    }
  }
  for (const [name, value] of Object.entries(ICON_PALETTE)) {
    if (manifest.palette[name] === undefined) {
      problems.push(
        `ICON_PALETTE token "${name}" (${value}) missing from the manifest palette block`,
      )
    }
  }

  // 2. Every SVG color must be a declared token.
  const files = fs
    .readdirSync(iconDir)
    .filter((f) => f.endsWith('.svg'))
    .sort()
  const colorPattern = /(?:stroke|fill)="(#[0-9a-fA-F]{3,8})"/g
  for (const file of files) {
    const svg = fs.readFileSync(path.join(iconDir, file), 'utf8')
    for (const match of svg.matchAll(colorPattern)) {
      const token = match[1]
      if (token === undefined) continue
      if (!declared.has(token.toLowerCase())) {
        problems.push(`${file}: undeclared color ${token}`)
      }
    }
  }

  if (problems.length > 0) {
    console.error(
      `icon-palette: FAIL — ${problems.length} violation(s) across ${files.length} SVGs`,
    )
    for (const problem of problems) console.error(`  ${problem}`)
    return 1
  }
  console.log(
    `icon-palette: PASS — ${files.length} SVGs use only the ${declared.size} declared tokens; manifest palette matches ICON_PALETTE exactly`,
  )
  return 0
}

process.exitCode = main()
