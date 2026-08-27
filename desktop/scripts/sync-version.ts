/**
 * Propagate the root VERSION file into every desktop manifest that carries a
 * copy of it (FID-2026-0824-032 audit condition: version was hardcoded in
 * multiple places and drifted at release bumps).
 *
 * Single source of truth: /VERSION at the repo root.
 * Consumers kept in sync:
 *   - desktop/package.json               ("version")
 *   - desktop/src-tauri/tauri.conf.json  ("version"; the native window title
 *     composes "Savant Code v{version}" at runtime from this field)
 *   - desktop/src-tauri/Cargo.toml       ([package] version)
 *
 * Idempotent: files already matching VERSION are left untouched on disk.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)) // desktop/scripts
const desktopDir = dirname(here) // desktop
const repoRoot = dirname(desktopDir) // repo root

const version = readFileSync(join(repoRoot, 'VERSION'), 'utf8').trim()
if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) {
  throw new Error(`VERSION file is not a valid semver: "${version}"`)
}

/** First-match version declarations keyed by manifest path relative to
 * desktop/. Exported for fixture-pinned regression tests. */
export const VERSION_DECLARATIONS = {
  'package.json': /("version":\s*")[^"]+(")/,
  'src-tauri/tauri.conf.json': /("version":\s*")[^"]+(")/,
  // Line-start anchor so [dependencies] version pins are never touched.
  'src-tauri/Cargo.toml': /(^version\s*=\s*")[^"]+(")/m,
} as const

/** Pure single-manifest transform: injects newVersion, THROWING when the
 * declaration pattern matches nothing — a silently-dead sync would let a
 * drifted manifest ship unversioned forever (Verifier C1, FID-2026-0824-032). */
export function applyDeclaration(
  content: string,
  key: keyof typeof VERSION_DECLARATIONS,
  newVersion: string,
): string {
  const pattern = VERSION_DECLARATIONS[key]
  if (!pattern.test(content)) {
    throw new Error(
      '[sync-version] version declaration not found — pattern drift',
    )
  }
  return content.replace(
    pattern,
    (_match, opening: string, closing: string) =>
      `${opening}${newVersion}${closing}`,
  )
}

let touched = 0

// Only execute when invoked directly — tests import the pure pieces.
if (import.meta.main) {
  const keys = Object.keys(VERSION_DECLARATIONS) as Array<
    keyof typeof VERSION_DECLARATIONS
  >
  for (const key of keys) {
    const file = join(desktopDir, key)
    const current = readFileSync(file, 'utf8')
    const next = applyDeclaration(current, key, version)
    if (next !== current) {
      writeFileSync(file, next)
      console.log(`[sync-version] ${file} -> ${version}`)
      touched += 1
    }
  }
  console.log(
    touched === 0
      ? `[sync-version] all manifests already at ${version}`
      : `[sync-version] ${touched} manifest(s) synced to ${version}`,
  )
}
