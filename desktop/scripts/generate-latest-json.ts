#!/usr/bin/env bun
// FID-2026-0820-011 Step 4/6: generate the Tauri updater manifest
// (`latest.json`) for a desktop release. FAIL-CLOSED by contract (missed-Q4):
// the output file is written ONLY after every expected platform artifact and
// its minisign `.sig` sidecar exist and validate. A missing or malformed
// input for ANY platform aborts with exit 1 and writes nothing — the
// all-platforms-valid rule means one broken platform must never break
// updates for everyone.
//
// The `signature` field carries the `.sig` FILE CONTENTS (Tauri updater
// contract), and download URLs point at the GitHub Release asset hosting
// chosen per missed-Q3/Q4. This script NEVER signs anything: signatures are
// produced by the bundler via TAURI_SIGNING_PRIVATE_KEY at build time.

import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

/** Updater platform entries for the v1 scope (Windows + Linux; macOS deferred). */
const PLATFORM_ARTIFACTS = {
  'windows-x86_64': (version: string): string =>
    `Savant Code_${version}_x64-setup.exe`,
  'linux-x86_64': (version: string): string =>
    `Savant Code_${version}_amd64.AppImage`,
} as const

export type UpdaterPlatform = keyof typeof PLATFORM_ARTIFACTS

export const UPDATER_PLATFORM_KEYS = Object.keys(
  PLATFORM_ARTIFACTS,
) as readonly UpdaterPlatform[]

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/

const platformEntrySchema = z.object({
  signature: z.string().min(1),
  url: z.string().url(),
})

export const latestJsonSchema = z.object({
  version: z.string().regex(VERSION_PATTERN),
  pub_date: z.string(),
  platforms: z.record(z.string(), platformEntrySchema),
})

export type LatestJson = z.infer<typeof latestJsonSchema>

export interface GeneratorInputs {
  readonly version: string
  readonly artifactsDir: string
  readonly baseDownloadUrl: string
  readonly outPath: string
}

export type GenerateOutcome =
  | { readonly ok: true; readonly json: LatestJson }
  | { readonly ok: false; readonly errors: readonly string[] }

function readFlagValue(
  argv: readonly string[],
  index: number,
  flag: string,
): string {
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`)
  }
  return value
}

export function parseArgs(argv: readonly string[]): GeneratorInputs {
  let version: string | null = null
  let artifactsDir: string | null = null
  let baseDownloadUrl: string | null = null
  let outPath: string | null = null

  for (let index = 0; index < argv.length; index += 1) {
    switch (argv[index]) {
      case '--version': {
        version = readFlagValue(argv, index, '--version')
        index += 1
        break
      }
      case '--artifacts-dir': {
        artifactsDir = readFlagValue(argv, index, '--artifacts-dir')
        index += 1
        break
      }
      case '--base-download-url': {
        baseDownloadUrl = readFlagValue(argv, index, '--base-download-url')
        index += 1
        break
      }
      case '--out': {
        outPath = readFlagValue(argv, index, '--out')
        index += 1
        break
      }
      default: {
        throw new Error(`Unexpected argument: ${String(argv[index])}`)
      }
    }
  }

  if (version === null || !VERSION_PATTERN.test(version)) {
    throw new Error('--version is required (semantic X.Y.Z)')
  }
  if (artifactsDir === null) {
    throw new Error('--artifacts-dir is required')
  }
  if (baseDownloadUrl === null || !/^https:\/\//.test(baseDownloadUrl)) {
    throw new Error('--base-download-url is required and must be https://')
  }
  if (outPath === null) {
    throw new Error('--out is required')
  }

  return { version, artifactsDir, baseDownloadUrl, outPath }
}

/**
 * Pure core: validates every expected platform against the artifacts
 * directory. Returns ALL failures (never just the first) so a release
 * engineer fixes everything in one pass.
 */
export function buildLatestJson(inputs: GeneratorInputs): GenerateOutcome {
  const errors: string[] = []
  if (!VERSION_PATTERN.test(inputs.version)) {
    errors.push(`invalid --version "${inputs.version}" (expected X.Y.Z)`)
  }
  if (!fs.existsSync(inputs.artifactsDir)) {
    errors.push(`artifacts directory not found: ${inputs.artifactsDir}`)
    return { ok: false, errors }
  }

  const platforms: LatestJson['platforms'] = {}
  for (const key of UPDATER_PLATFORM_KEYS) {
    const artifactName = PLATFORM_ARTIFACTS[key](inputs.version)
    const artifactPath = path.join(inputs.artifactsDir, artifactName)
    const signaturePath = `${artifactPath}.sig`

    if (!fs.existsSync(artifactPath)) {
      errors.push(`[${key}] missing artifact: ${artifactName}`)
    } else if (!fs.statSync(artifactPath).isFile()) {
      errors.push(`[${key}] artifact is not a regular file: ${artifactName}`)
    }
    if (!fs.existsSync(signaturePath)) {
      errors.push(`[${key}] missing signature sidecar: ${artifactName}.sig`)
    } else {
      const signature = fs.readFileSync(signaturePath, 'utf8').trim()
      if (signature.length === 0) {
        errors.push(`[${key}] signature file is empty: ${artifactName}.sig`)
      } else {
        platforms[key] = {
          signature,
          url: `${inputs.baseDownloadUrl}/${encodeURIComponent(artifactName)}`,
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  // Exact key set: an extra or missing platform breaks the
  // all-platforms-valid rule, so only the declared v1 scope may appear.
  const emittedKeys = Object.keys(platforms).sort()
  const expectedKeys = [...UPDATER_PLATFORM_KEYS].sort()
  if (emittedKeys.join('|') !== expectedKeys.join('|')) {
    return {
      ok: false,
      errors: [
        `platform key set mismatch: got [${emittedKeys.join(', ')}], expected [${expectedKeys.join(', ')}]`,
      ],
    }
  }

  const json: LatestJson = {
    version: inputs.version,
    pub_date: new Date().toISOString(),
    platforms,
  }

  const parsed = latestJsonSchema.safeParse(json)
  if (!parsed.success) {
    return { ok: false, errors: [`schema violation: ${parsed.error.message}`] }
  }
  return { ok: true, json: parsed.data }
}

export function runGenerateLatestJson(argv: readonly string[]): number {
  let inputs: GeneratorInputs
  try {
    inputs = parseArgs(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  const outcome = buildLatestJson(inputs)
  if (!outcome.ok) {
    console.error(
      'generate-latest-json: FAIL-CLOSED — refusing to emit output.',
    )
    for (const failure of outcome.errors) {
      console.error(`  - ${failure}`)
    }
    return 1
  }

  fs.mkdirSync(path.dirname(inputs.outPath), { recursive: true })
  fs.writeFileSync(inputs.outPath, `${JSON.stringify(outcome.json, null, 2)}\n`)
  console.log(
    `generate-latest-json: wrote ${inputs.outPath} (${Object.keys(outcome.json.platforms).length} platforms, v${outcome.json.version})`,
  )
  return 0
}

if (import.meta.main) {
  process.exitCode = runGenerateLatestJson(process.argv.slice(2))
}
