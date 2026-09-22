import fs from 'node:fs'
import path from 'node:path'

import { collectDocVersionDrift } from './version-docs.js'

/**
 * Canonical version identity — the single source of truth shared by the
 * validator (scripts/validate-repository.ts) and the bump writer
 * (scripts/bump-version.ts) so the two can never drift
 * (FID-2026-0813-021).
 */
export const PRODUCT_VERSION_PATH = 'VERSION'

/** Manifests whose top-level `version` field must equal the product version. */
export const SYNCHRONIZED_PACKAGE_PATHS: readonly string[] = [
  'package.json',
  'agents/package.json',
  'cli/package.json',
  'common/package.json',
  'evals/package.json',
  'savant-free/package.json',
  'packages/agent-runtime/package.json',
  'packages/design-systems/package.json',
  'packages/code-map/package.json',
  'packages/database/package.json',
  'packages/knowledge-graph/package.json',
  'packages/llm-providers/package.json',
  'scripts/tmux/package.json',
  'sdk/package.json',
  'cli/release/package.json',
  'savant-free/cli/release/package.json',
]

const PROJECT_VERSION_PATTERN =
  /^project:\n(?:.*\n)*?  version:\s*["']?([^"'\s]+)["']?/m

const MANIFEST_VERSION_PATTERN = /^(\s*"version"\s*:\s*)"[^"]*"(,?)\s*$/m

/**
 * Desktop surfaces that carry a copy of the product version. The three
 * manifests are synced by `desktop/scripts/sync-version.ts`; the Cargo.lock
 * workspace-member entry is patched by `cargo update -p savant-desktop` (or
 * the desktop sync). Enforced by the drift check since 2026-09-07 — these
 * surfaces sat outside `SYNCHRONIZED_PACKAGE_PATHS` and drifted at the
 * v0.0.29 bump, caught only by hand (LEARNINGS review, same day).
 */
export const DESKTOP_VERSION_SURFACES = [
  'desktop/package.json',
  'desktop/src-tauri/tauri.conf.json',
  'desktop/src-tauri/Cargo.toml',
  'desktop/src-tauri/Cargo.lock',
] as const

/** Cargo.lock only records the workspace member's own version once. */
const CARGO_LOCK_MEMBER_PATTERN =
  /(name = "savant-desktop"\r?\nversion = ")([^"]+)(")/

const CARGO_TOML_MEMBER_PATTERN = /(^version\s*=\s*")([^"]+)(")/m

/** Drift-check remedy per desktop surface — the check must teach the fix. */
const DESKTOP_DRIFT_HINTS: Record<
  (typeof DESKTOP_VERSION_SURFACES)[number],
  string
> = {
  'desktop/package.json': 'run `bun run sync:version` in desktop/',
  'desktop/src-tauri/tauri.conf.json': 'run `bun run sync:version` in desktop/',
  'desktop/src-tauri/Cargo.toml': 'run `bun run sync:version` in desktop/',
  'desktop/src-tauri/Cargo.lock':
    'run `cargo update -p savant-desktop` in desktop/src-tauri',
}

function readDesktopSurfaceVersion(
  root: string,
  surface: (typeof DESKTOP_VERSION_SURFACES)[number],
): string | undefined {
  const filePath = path.join(root, surface)
  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    // A missing desktop surface is itself drift (reported as `missing`).
    return undefined
  }
  switch (surface) {
    case 'desktop/package.json':
    case 'desktop/src-tauri/tauri.conf.json':
      return readManifestVersion(root, surface)
    case 'desktop/src-tauri/Cargo.toml':
      return content.match(CARGO_TOML_MEMBER_PATTERN)?.[2]
    case 'desktop/src-tauri/Cargo.lock':
      return content.match(CARGO_LOCK_MEMBER_PATTERN)?.[2]
  }
}

export function readProductVersion(root: string): string {
  return fs.readFileSync(path.join(root, PRODUCT_VERSION_PATH), 'utf8').trim()
}

export function readManifestVersion(
  root: string,
  relativePath: string,
): string | undefined {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8')
  return content.match(/^\s*"version"\s*:\s*"([^"]+)"/m)?.[1]
}

export function readManifestVersions(
  root: string,
): Record<string, string | undefined> {
  return Object.fromEntries(
    SYNCHRONIZED_PACKAGE_PATHS.map((relativePath) => [
      relativePath,
      readManifestVersion(root, relativePath),
    ]),
  )
}

export function readConfiguredProjectVersion(root: string): string | undefined {
  return readConfig(root).match(PROJECT_VERSION_PATTERN)?.[1]
}

export function writeProductVersion(root: string, version: string): void {
  fs.writeFileSync(path.join(root, PRODUCT_VERSION_PATH), `${version}\n`)
}

export function writeManifestVersion(
  root: string,
  relativePath: string,
  version: string,
): void {
  const filePath = path.join(root, relativePath)
  const content = fs.readFileSync(filePath, 'utf8')
  if (!MANIFEST_VERSION_PATTERN.test(content)) {
    throw new Error(`No top-level "version" field found in ${relativePath}`)
  }
  fs.writeFileSync(
    filePath,
    content.replace(
      MANIFEST_VERSION_PATTERN,
      (_match, prefix: string, comma: string) =>
        `${prefix}"${version}"${comma}`,
    ),
  )
}

/**
 * Write the `project.version` scalar only. The writer must never touch the
 * independent `protocol.version` or `single_agent.protocol.version` scalars.
 */
export function writeConfiguredProjectVersion(
  root: string,
  version: string,
): void {
  const filePath = path.join(root, 'protocol.config.yaml')
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
  const pattern = /^(project:\n(?:.*\n)*?  version:\s*)[^\n]+/m
  if (!pattern.test(content)) {
    throw new Error('Could not locate project.version in protocol.config.yaml')
  }
  fs.writeFileSync(
    filePath,
    content.replace(
      pattern,
      (_match, prefix: string) => `${prefix}'${version}'`,
    ),
  )
}

/**
 * Patch the workspace `version` metadata fields in bun.lock. Bun records these
 * as informational metadata and does not rewrite them on `bun install`, so the
 * bump writer owns them. Only `"name": "@savant-code/..."` entries are touched;
 * the root workspace (no version) and the resolved `packages` section are
 * deliberately left alone. Returns the number of entries whose value changed.
 */
export function patchLockfileWorkspaceVersions(
  root: string,
  newVersion: string,
): number {
  const lockPath = path.join(root, 'bun.lock')
  const content = fs.readFileSync(lockPath, 'utf8')
  const pattern =
    /("name":\s*"@savant-code\/[^"]+",\n\s*"version":\s*)"([^"]*)"/g
  let count = 0
  const updated = content.replace(
    pattern,
    (match, prefix: string, oldValue: string) => {
      if (oldValue === newVersion) return match
      count++
      return `${prefix}"${newVersion}"`
    },
  )
  if (count === 0) return 0
  fs.writeFileSync(lockPath, updated)
  return count
}

export type VersionDrift = {
  file: string
  version: string | undefined
  /** Remedy for the surface (desktop family, doc surfaces) — surfaced by version:check. */
  hint?: string
}

/** Enforced surfaces that differ from the product version. */
export function collectVersionDrift(root: string): VersionDrift[] {
  const product = readProductVersion(root)
  const drift: VersionDrift[] = []
  for (const [file, version] of Object.entries(readManifestVersions(root))) {
    if (version !== product) drift.push({ file, version })
  }
  const configured = readConfiguredProjectVersion(root)
  if (configured !== product) {
    drift.push({
      file: 'protocol.config.yaml project.version',
      version: configured,
    })
  }
  for (const surface of DESKTOP_VERSION_SURFACES) {
    const version = readDesktopSurfaceVersion(root, surface)
    if (version !== product) {
      drift.push({ file: surface, version, hint: DESKTOP_DRIFT_HINTS[surface] })
    }
  }
  // FID-2026-0919-023: documented version surfaces (README badges + release
  // blurbs, docs version notes, ARCHITECTURE current-state note). A surface the
  // bump tool fails to update is reported here instead of shipping silently —
  // the localized README blurb shipped a release behind before this check.
  drift.push(...collectDocVersionDrift(root, product))
  return drift
}

function readConfig(root: string): string {
  return fs
    .readFileSync(path.join(root, 'protocol.config.yaml'), 'utf8')
    .replace(/\r\n/g, '\n')
}
