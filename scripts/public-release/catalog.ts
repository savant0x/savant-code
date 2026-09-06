// FID-2026-0905-007 — public-release decomposition: package catalog.
//
// Public types, the publishable-package catalog, the public repository
// identity, and the release plan. Verbatim moves from scripts/public-release.ts.

import { fail } from './fail'

export type PackageTarget = {
  name: string
  directory: string
  stage: 'NPM_PUBLISH_SDK' | 'NPM_PUBLISH_CLI'
  /** Included in the default publish set. Catalog-only targets (e.g. the SDK,
   * whose npm scope does not exist) must opt in via SAVANT_CODE_RELEASE_PACKAGES. */
  defaultPublish: boolean
}

export type LocalSnapshot = {
  env: Record<string, string | undefined>
  settingsPath: string
  settingsExisted: boolean
  settingsContent?: string
}

export type CommandFailureClass =
  | 'success'
  | 'exit'
  | 'signal'
  | 'spawn-error'
  | 'timeout'
  | 'evidence-error'
  | 'malformed'

export type GateAttempt = {
  label: string
  command: string
  args: string[]
  cwd: string
  attempt: number
  failureClass: CommandFailureClass
  status: number
  signal?: string | null
  startedAt: string
  finishedAt: string
  durationMs: number
  transcriptPath?: string
  transcriptSha256?: string
  transcriptFinalized: boolean
  cleanupFailure?: string
  summary: string
}

export type ReleaseReceipt = {
  schemaVersion?: 'release-receipt/v2'
  version: string
  headSha?: string
  mode: 'preview' | 'publish' | 'automation'
  completedStages: string[]
  failedStage?: string
  restored: boolean
  receiptPath: string
  committedHead?: string
  committedFiles?: string[]
  gateManifestHash?: string
  gateAttempts?: GateAttempt[]
  evidenceFinalized?: boolean
  evidenceHeadSha?: string
  ignoredChanges?: { added: string[]; removed: string[] }
  /** Repo identity (first 8 hex of the canonical root hash) so receipt scans
   *  never mistake another clone's crash evidence for this repository's. */
  repositoryKey?: string
}

export type GateSpec = {
  label: string
  command: string
  args: string[]
  cwd: string
}

export const PUBLIC_REPOSITORY = 'https://github.com/savant0x/savant-code.git'
export const PUBLIC_REPOSITORY_SLUG = 'savant0x/savant-code'

// Publishable package catalog. The CLI is the default publish set: the
// @savant-code npm scope does not exist and the SDK is never published in a
// normal release (operator-confirmed 2026-08-16), so it stays catalog-only and
// must be opted into explicitly via SAVANT_CODE_RELEASE_PACKAGES. The SDK stays
// first in the catalog so a future explicit publish keeps its npm-pack dry run
// ahead of the CLI's (the CLI artifact depends on the SDK build).
export const PUBLIC_PACKAGES: readonly PackageTarget[] = [
  {
    name: '@savant-code/sdk',
    directory: 'sdk',
    stage: 'NPM_PUBLISH_SDK',
    defaultPublish: false,
  },
  {
    name: 'savant-code',
    directory: 'cli/release',
    stage: 'NPM_PUBLISH_CLI',
    defaultPublish: true,
  },
]

/**
 * The binary tarballs the release workflow matrix builds and uploads to the
 * GitHub release (build-release-binaries.yml `matrix.target` entries). This is
 * deliberately the 5 non-baseline targets — NOT every key of
 * `PLATFORM_TARGETS` in cli/release-core/launcher.js (7 keys, including
 * linux-x64-baseline and win32-x64-baseline, which the workflow does not
 * build). Asserting the full map would fail forever (FID-2026-0809-002 Fix B).
 */
export const RELEASE_BINARY_TARBALLS = [
  'savant-code-linux-x64.tar.gz',
  'savant-code-linux-arm64.tar.gz',
  'savant-code-darwin-x64.tar.gz',
  'savant-code-darwin-arm64.tar.gz',
  'savant-code-win32-x64.tar.gz',
] as const

/**
 * Returns the package targets for this release run. Defaults to the default
 * publish set (currently the CLI only — the SDK is catalog-only and never
 * published in a normal release). Set SAVANT_CODE_RELEASE_PACKAGES to a
 * comma-separated subset of public package names (e.g. `savant-code` or
 * `@savant-code/sdk,savant-code`) to scope npm publish/verification and the
 * npm-pack dry-run gates to those packages. Any name that matches no public
 * package aborts the run fail-closed so a typo can never silently publish
 * less than intended.
 */
export function configuredReleasePackages(): readonly PackageTarget[] {
  const raw = process.env.SAVANT_CODE_RELEASE_PACKAGES
  if (!raw || !raw.trim()) {
    return PUBLIC_PACKAGES.filter((target) => target.defaultPublish !== false)
  }
  const names = raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 0) return PUBLIC_PACKAGES
  const unknown = names.filter(
    (name) => !PUBLIC_PACKAGES.some((target) => target.name === name),
  )
  if (unknown.length > 0) {
    fail(
      `SAVANT_CODE_RELEASE_PACKAGES matched no public packages: ${unknown.join(', ')}. ` +
        `Valid names: ${PUBLIC_PACKAGES.map((target) => target.name).join(', ')}.`,
    )
  }
  return PUBLIC_PACKAGES.filter((target) => names.includes(target.name))
}

export type ReleaseOptions = {
  preview: boolean
  resume: boolean
  automation: boolean
}

/**
 * Shared mutable state for one release transaction (FID-2026-0905-007).
 * `preflight` is deliberately reached through the context object (never
 * destructured) because the stages re-verify and reassign it after the
 * automation commit. `beforeFingerprint`/`beforeIgnored` are captured by the
 * automation-commit stage and reused by the gates stage (`??=` semantics
 * preserved from the monolith).
 */
export type TransactionContext = {
  root: string
  version: string
  plan: readonly string[]
  options: ReleaseOptions
  receipt: ReleaseReceipt
  githubToken: string
  snapshot: LocalSnapshot
  preflight: { notes: string; warnings: string[]; headSha: string }
  beforeFingerprint?: WorktreeFingerprint
  beforeIgnored?: string
}

export type WorktreeFingerprint = {
  hash: string
  trackedDetails: Record<string, string>
  status: string
}

export function buildPublicReleasePlan(
  version: string,
  packages: readonly PackageTarget[] = configuredReleasePackages(),
): readonly string[] {
  return [
    `Validate ${PUBLIC_REPOSITORY}@v${version}`,
    'Snapshot local routing/settings state',
    'Apply the non-secret OpenRouter/free public profile',
    'Run public SDK/CLI build, typecheck, test, lint, format, and package gates',
    `Create annotated tag v${version}`,
    `git push origin main and v${version}`,
    'Write the verified incremental backup bundle (OneDrive-synced)',
    `Create the GitHub REST release for v${version} with the current CHANGELOG section`,
    ...packages.map((target) => `npm publish ${target.name}`),
    'Verify public versions and restore local state',
  ]
}

export function isReleaseAutomationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.SAVANT_CODE_RELEASE_AUTOMATION === '1'
}

export function getGitHubToken(
  env: Record<string, string | undefined> = process.env,
): string {
  const token = env.GITHUB_TOKEN ?? env.GH_TOKEN
  if (!token)
    fail('GITHUB_TOKEN or GH_TOKEN is required for automated release.')
  return token
}

export function buildTokenSafeGitPushEnv(
  token: string,
): Record<string, string> {
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    GIT_TERMINAL_PROMPT: '0',
  }
}
