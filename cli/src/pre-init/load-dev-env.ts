// Loads the repo-root `.env.local` into process.env at dev boot.
//
// Why this exists: `bun dev` runs `bun run src/index.tsx --cwd ..`, and Bun's
// dotenv auto-loader is disabled once `--cwd` is passed. The environment
// validation gate in `common/src/env.ts` therefore sees no vars and throws.
// The application's existing env loader (used by tests) works around the
// same gap with a hand-rolled parser; we reuse that exact algorithm here
// so a fresh `bun dev` (no shell exports) picks up `.env.local`.
//
// This module MUST be imported before any `@savant-code/common` import that would
// trigger `common/src/env.ts` (which parses the schema at module load).
//
// Path resolution: under `--cwd ..` Bun can report a distorted `import.meta.dir`,
// so we walk UP from this file's directory until we find `.env.local` rather
// than assuming a fixed number of `..` segments.
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

const ENV_LOCAL_PATH = findUp(import.meta.dir, '.env.local')

/**
 * Parse a dotenv-style file and apply it to process.env.
 * Mirrors the e2e harness `loadEnvFile` parser so dev and test agree.
 * Existing process.env values win (don't clobber real shell exports).
 */
function applyEnvLocal(): void {
  if (!ENV_LOCAL_PATH) return
  try {
    const content = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8')
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

applyEnvLocal()
