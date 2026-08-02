// Loads environment values before `common/src/env.ts` parses the schema.
//
// Two modes:
// 1. Release binary: a sibling `env.json` (written next to the compiled
//    binary at build time) provides the canonical env values. This is
//    required because Bun's `--define` replacement is unreliable for env
//    vars once workspace packages are pre-built to dist and minified.
// 2. Local dev: `bun dev` runs with `--cwd ..`, which disables Bun's
//    dotenv auto-loader, so we manually load the repo-root `.env.local`.
//
// This module MUST be imported before any `@savant-code/common` import that
// would trigger `common/src/env.ts` (which parses the schema at module load).
import fs from 'fs'
import path from 'path'

/**
 * Walk upward from startDir looking for relName; return its absolute path
 * or null if not found before the filesystem root.
 */
function findUp(startDir: string, relName: string): string | null {
  let dir = startDir
  // Guard against infinite loop at filesystem root.
  for (let i = 0; i < 20; i++) {
    const candidate = path.join(dir, relName)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Load a sibling `env.json` from the directory containing the running binary.
 * Returns true if the file was found and applied.
 */
function loadBinaryEnvIfPresent(): boolean {
  const execPath = process.execPath
  if (!execPath) return false

  const envJsonPath = path.join(path.dirname(execPath), 'env.json')
  try {
    if (!fs.existsSync(envJsonPath)) return false
    const parsed = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8'))
    if (!parsed || typeof parsed !== 'object') return false

    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === 'string') {
        process.env[key] = value
      }
    }
    return true
  } catch {
    // A missing or corrupt env.json is fine; fall through to .env.local logic.
    return false
  }
}

/**
 * Parse a dotenv-style file and apply it to process.env.
 * Mirrors the e2e harness `loadEnvFile` parser so dev and test agree.
 * Existing process.env values win (don't clobber real shell exports).
 */
function applyEnvLocal(): void {
  const envLocalPath = findUp(import.meta.dir, '.env.local')
  if (!envLocalPath) return
  try {
    const content = fs.readFileSync(envLocalPath, 'utf-8')
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const normalized = line.startsWith('export ')
        ? line.slice('export '.length)
        : line
      const equalsIndex = normalized.indexOf('=')
      if (equalsIndex <= 0) continue
      const key = normalized.slice(0, equalsIndex).trim()
      if (!key || process.env[key]) continue
      let value = normalized.slice(equalsIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      process.env[key] = value
    }
  } catch {
    // Missing .env.local is fine — real deployments set these via the shell.
  }
}

// Release binaries ship their own env.json; everything else loads .env.local.
if (!loadBinaryEnvIfPresent()) {
  applyEnvLocal()
}
