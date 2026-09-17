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
 * Walk upward from startDir collecting every relName match, innermost first.
 * Returns [] when none exist before the filesystem root.
 */
function findAllUp(startDir: string, relName: string): string[] {
  const found: string[] = []
  let dir = startDir
  // Guard against infinite loop at filesystem root.
  for (let i = 0; i < 20; i++) {
    const candidate = path.join(dir, relName)
    if (fs.existsSync(candidate)) found.push(candidate)
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return found
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

    applyBinaryEnvValues(parsed as Record<string, unknown>)
    return true
  } catch {
    // A missing or corrupt env.json is fine; fall through to .env.local logic.
    return false
  }
}

/**
 * Apply a release env.json object with the documented precedence rules.
 * Exported for unit tests so release behavior is verified without building a
 * compiled binary.
 */
export function applyBinaryEnvValues(
  parsed: Record<string, unknown>,
  targetEnv: NodeJS.ProcessEnv = process.env,
): void {
  const hasExplicitDirectRouting = Boolean(
    targetEnv.DIRECT_PROVIDER?.trim() || targetEnv.INFERENCE_BASE_URL?.trim(),
  )

  for (const [key, value] of Object.entries(parsed)) {
    // Treat provider and endpoint as an atomic pair. If either routing value
    // is explicitly supplied by the shell, preserve the entire pair instead
    // of mixing a custom provider with the release OpenRouter endpoint.
    const isDirectRoutingKey =
      key === 'DIRECT_PROVIDER' || key === 'INFERENCE_BASE_URL'
    if (isDirectRoutingKey && hasExplicitDirectRouting) continue

    // Release env.json remains authoritative for production/client values;
    // otherwise a developer shell could reintroduce localhost URLs or dev
    // analytics into a production binary. Only direct routing is an explicit
    // runtime override because it is intentionally user-selectable.
    if (typeof value === 'string') {
      targetEnv[key] = value
    }
  }
}

/**
 * Parse one dotenv-style file and apply it to process.env.
 * Mirrors the e2e harness `loadEnvFile` parser so dev and test agree.
 * Existing process.env values win (don't clobber real shell exports).
 */
function applyOneEnvLocal(envLocalPath: string): void {
  let content = ''
  try {
    content = fs.readFileSync(envLocalPath, 'utf8')
  } catch {
    // A missing/unreadable file is fine — skip it; other files still apply.
    return
  }
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
}

/**
 * Apply every `.env.local` from the repo root down to the CLI's own
 * directory — not just the first match walking upward.
 *
 * The previous first-match `findUp` started at `cli/src/pre-init` and stopped
 * at `cli/.env.local`, so the repo-root `.env.local` was silently skipped in
 * dev mode. A key set only at the root (e.g. `OPENROUTER_API_KEY`) never
 * reached the process, the resolver then fell back to `OR_MASTER_KEY` from
 * `cli/.env.local`, and the run 401'd at chat-completions with a vendor error
 * that named neither file. (FID-2026-0917-001.)
 *
 * Outermost (repo root) is applied first as the base; inner files layer on
 * top. Existing process.env always wins, so on a collision the outer value
 * takes precedence and a real shell export beats both.
 */
function applyEnvLocal(): void {
  // findAllUp returns innermost-first; reverse so the repo root is the base.
  for (const envLocalPath of findAllUp(
    import.meta.dir,
    '.env.local',
  ).reverse()) {
    applyOneEnvLocal(envLocalPath)
  }
}

// Release binaries ship their own env.json; everything else loads .env.local.
if (!loadBinaryEnvIfPresent()) {
  applyEnvLocal()
}
