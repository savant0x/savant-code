// FID-2026-0906-007 — the .env.local bootstrap leg for common/src/env.ts.
//
// env.ts parses the client env schema at module import and throws when the
// required NEXT_PUBLIC_* keys are absent. Its release-binary leg (env.json
// sibling) is handled inline there; this module adds the missing local-dev
// leg so every entrypoint that imports @savant-code/common — root scripts,
// the pre-push hook's evals:smoke, spawned sidecars — self-bootstraps
// instead of failing at import. `--cwd` disables Bun's dotenv auto-loader
// (documented in cli/src/pre-init/load-dev-env.ts:5-9), which is why the
// CLI carries this same parser in its pre-init; the semantics here mirror
// it exactly (Law 11): findUp, comments/export-prefix/quote handling,
// existing-env-wins (shell env is never clobbered).

import fs from 'fs'
import path from 'path'

const MAX_LEVELS = 20
const ENV_LOCAL = '.env.local'

/**
 * Walk upward from startDir looking for `.env.local`; return its absolute
 * path or null if not found before the filesystem root.
 */
export function findUpEnvLocal(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < MAX_LEVELS; i++) {
    const candidate = path.join(dir, ENV_LOCAL)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/**
 * Parse the nearest `.env.local` (walking up from startDir) and apply it
 * into `target`. Mirrors load-dev-env.ts's parser: skips blank lines and
 * comments, strips an `export ` prefix, trims matching quotes, and never
 * overwrites a key that already has a value (existing-env-wins — the
 * shell always outranks the file).
 */
export function applyEnvLocalInto(
  target: NodeJS.ProcessEnv,
  startDir: string,
): void {
  const envLocalPath = findUpEnvLocal(startDir)
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
      if (!key || target[key]) continue
      let value = normalized.slice(equalsIndex + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      target[key] = value
    }
  } catch {
    // A missing or unreadable .env.local is fine — real deployments set
    // these via the shell or a release env.json.
  }
}
