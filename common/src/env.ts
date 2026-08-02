import fs from 'fs'
import path from 'path'

import { clientEnvSchema, clientEnvVars } from './env-schema'

/**
 * Load a sibling `env.json` from the directory containing the running binary.
 * Release builds ship this file next to the compiled executable so the binary
 * gets its runtime environment even when Bun's `--define` replacement misses
 * minified `process.env` references in pre-built workspace packages files.
 */
function loadBinaryEnvIfPresent(): void {
  const execPath = process.execPath
  if (!execPath) return

  const envJsonPath = path.join(path.dirname(execPath), 'env.json')
  try {
    if (!fs.existsSync(envJsonPath)) return
    const parsed = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8')) as unknown
    if (!parsed || typeof parsed !== 'object') return

    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (typeof value === 'string') {
        process.env[key] = value
      }
    }
  } catch {
    // Ignore a missing or corrupt env.json; normal dev/test runs rely on
    // .env.local or shell exports instead.
  }
}

loadBinaryEnvIfPresent()

// Build the env input after loading env.json so that release binaries see
// the canonical runtime values rather than whatever the shell provided.
const rawEnv: Record<string, string | undefined> = {}
for (const key of clientEnvVars) {
  rawEnv[key] = process.env[key]
}

const parsedEnv = clientEnvSchema.safeParse(rawEnv)
if (!parsedEnv.success) {
  // eslint-disable-next-line no-console -- environment validation failed before any logger is available
  console.error('Environment validation failed:', parsedEnv.error.issues)
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.message}`,
  )
}

export const env = parsedEnv.data

// Only log environment in non-production
if (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod') {
  // eslint-disable-next-line no-console -- deliberate env logging at startup
  console.log('Using environment:', env.NEXT_PUBLIC_CB_ENVIRONMENT)
}

// Derived environment constants for convenience
export const IS_DEV = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'dev'
export const IS_TEST = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'test'
export const IS_PROD = env.NEXT_PUBLIC_CB_ENVIRONMENT === 'prod'
export const IS_CI = process.env.SAVANT_CODE_GITHUB_ACTIONS === 'true'

// Debug flag for logging analytics events in dev mode
// Set to true when actively debugging analytics - affects both CLI and backend
export const DEBUG_ANALYTICS = false
