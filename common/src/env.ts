import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { applyEnvLocalInto } from './env-bootstrap'
import { allowsDevelopmentDefaults } from './env-boundary'
import { clientEnvSchema, clientEnvVars } from './env-schema'

/**
 * Load a sibling `env.json` from the directory containing the running binary.
 * Release builds ship this file next to the compiled executable so the binary
 * gets its runtime environment even when Bun's `--define` replacement misses
 * minified `process.env` references in pre-built workspace packages files.
 */
function loadBinaryEnvIfPresent(): boolean {
  const execPath = process.execPath
  if (!execPath) return false

  const envJsonPath = path.join(path.dirname(execPath), 'env.json')
  try {
    if (!fs.existsSync(envJsonPath)) return false
    const parsed = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8')) as unknown
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
    // Ignore a missing or corrupt env.json; normal dev/test runs rely on
    // .env.local or shell exports instead.
    return false
  }
}

// Release binaries ship their own env.json; everything else loads the
// repo-root .env.local (FID-2026-0906-007 — the leg the CLI's pre-init
// used to own alone, leaving spawned processes and sub-package entrypoints
// starving). Shell exports always outrank both (existing-env-wins).
if (!loadBinaryEnvIfPresent()) {
  // Derive the module directory from import.meta.url — NOT import.meta.dir:
  // the Bun-only `dir` property breaks the SDK's dts-bundle-generator gate,
  // which recompiles this file under a plain-TS program without Bun types
  // (TS2339: Property 'dir' does not exist on type 'ImportMeta'). Both forms
  // are virtual $bunfs paths inside compiled executables that no findUp can
  // anchor, so the cwd fallback pass below covers that case either way.
  let moduleDir: string | undefined
  try {
    moduleDir = path.dirname(fileURLToPath(import.meta.url))
  } catch {
    // A virtual or unparseable module URL must not brick the importers of
    // this module at load time; the cwd fallback pass below still runs.
  }
  if (moduleDir) applyEnvLocalInto(process.env, moduleDir)
  // Compiled executables (e.g. the sidecar binary the desktop E2E spawns)
  // have a virtual import.meta.dir no findUp can anchor; the process cwd is
  // the only meaningful anchor there. Existing-env-wins makes this a pure
  // fallback pass: it fills only keys the first pass could not find.
  applyEnvLocalInto(process.env, process.cwd())
}

// FID-2026-0811-011: development defaults are a convenience only. They are
// disabled for CI, production, release automation, and any explicit unknown
// environment so a mode mistake cannot silently weaken validation.
const developmentDefaultsAllowed = allowsDevelopmentDefaults(
  process.env.NEXT_PUBLIC_CB_ENVIRONMENT,
)

const DEV_DEFAULTS: Record<string, string> = {
  NEXT_PUBLIC_SUPPORT_EMAIL: 'dev@example.com',
  NEXT_PUBLIC_POSTHOG_API_KEY: 'phc_dev_placeholder',
  NEXT_PUBLIC_POSTHOG_HOST_URL: 'http://localhost:4000',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_dev_placeholder',
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL: 'http://localhost:3000/portal',
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_ID: 'dev_placeholder',
}

// Build the env input after loading env.json so that release binaries see
// the canonical runtime values rather than whatever the shell provided.
const rawEnv: Record<string, string | undefined> = {}
for (const key of clientEnvVars) {
  rawEnv[key] =
    process.env[key] ??
    (developmentDefaultsAllowed ? DEV_DEFAULTS[key] : undefined)
}

const parsedEnv = clientEnvSchema.safeParse(rawEnv)
if (!parsedEnv.success) {
  // FID-2026-0810-001 Phase 2: actionable error message instead of raw zod dump.
  // eslint-disable-next-line no-console -- environment validation failed before any logger is available
  console.error('Missing required environment variables.')
  // eslint-disable-next-line no-console -- actionable remediation for the failing validation
  console.error(
    'Copy .env.example to .env.local and replace the dummy values with your own.',
  )
  // eslint-disable-next-line no-console -- validation details are the diagnostic payload
  console.error('Validation details:', parsedEnv.error.issues)
  throw new Error('Invalid environment configuration')
}

export const env = parsedEnv.data

// Only log environment in non-production — on stderr (the diagnostics
// channel): stdout is the headless answer channel (FID-2026-0907-007).
if (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
  // eslint-disable-next-line no-console -- deliberate env logging at startup
  console.error('Using environment:', env.NEXT_PUBLIC_CB_ENVIRONMENT)
}

// Derived environment constants for convenience
export const IS_DEV = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'dev'
export const IS_TEST = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'test'
export const IS_PROD = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod'
export const IS_CI = process.env.SAVANT_CODE_GITHUB_ACTIONS === 'true'

// Debug flag for logging analytics events in dev mode
// Set to true when actively debugging analytics - affects both CLI and backend
export const DEBUG_ANALYTICS = false
