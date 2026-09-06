// FID-2026-0905-007 — public-release decomposition: failure + constants.
//
// The failure primitive and the module-level constants shared by the whole
// pipeline. Verbatim moves from scripts/public-release.ts.

import { existsSync, readFileSync } from 'fs'

import {
  CANONICAL_NEXT_PUBLIC_DEFAULTS,
  CANONICAL_RELEASE_RUNTIME_DEFAULTS,
} from '../../cli/scripts/build-binary.js'

export function fail(message: string): never {
  throw new Error(message)
}

export function readJsonObject(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {}
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`Expected a JSON object: ${filePath}`)
  }
  return parsed as Record<string, unknown>
}

export const PROFILE_ENV = {
  ...CANONICAL_RELEASE_RUNTIME_DEFAULTS,
  ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
} as const

export const PROFILE_ENV_KEYS = Object.keys(PROFILE_ENV)
export const REQUIRED_BUN_VERSION = '1.3.14'
export const REQUIRED_NPM_MAJOR = 10

export const RELEASE_STAGES = new Set([
  'PREFLIGHT',
  'AUTHENTICATION',
  'AUTOMATION_COMMIT_ALL',
  'AUTOMATION_APPROVAL',
  'CONFIRMATION',
  'PUBLIC_PROFILE',
  'GATES_AND_PACKAGE_DRY_RUNS',
  'TAG',
  'GIT_PUSH',
  'BACKUP_BUNDLE',
  'GITHUB_RELEASE',
  'NPM_PUBLISH_SDK',
  'NPM_PUBLISH_CLI',
  'POST_RELEASE_VERIFY',
])
