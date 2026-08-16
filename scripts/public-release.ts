#!/usr/bin/env bun

import { spawnSync } from 'child_process'
import { createHash, randomUUID } from 'crypto'
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'
import { createInterface } from 'readline/promises'

import { repositoryValidationGates } from './validation-manifest.js'
import {
  CANONICAL_NEXT_PUBLIC_DEFAULTS,
  CANONICAL_RELEASE_RUNTIME_DEFAULTS,
} from '../cli/scripts/build-binary.js'

export type PackageTarget = {
  name: string
  directory: string
  stage: 'NPM_PUBLISH_SDK' | 'NPM_PUBLISH_CLI'
  /** Included in the default publish set. Catalog-only targets (e.g. the SDK,
   * whose npm scope does not exist) must opt in via SAVANT_CODE_RELEASE_PACKAGES. */
  defaultPublish: boolean
}

type ReleaseOptions = {
  preview: boolean
  resume: boolean
  automation: boolean
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

const PROFILE_ENV = {
  ...CANONICAL_RELEASE_RUNTIME_DEFAULTS,
  ...CANONICAL_NEXT_PUBLIC_DEFAULTS,
} as const

const PROFILE_ENV_KEYS = Object.keys(PROFILE_ENV)
const REQUIRED_BUN_VERSION = '1.3.14'
const REQUIRED_NPM_MAJOR = 10
const RELEASE_STAGES = new Set([
  'PREFLIGHT',
  'AUTHENTICATION',
  'AUTOMATION_COMMIT_ALL',
  'AUTOMATION_APPROVAL',
  'CONFIRMATION',
  'PUBLIC_PROFILE',
  'GATES_AND_PACKAGE_DRY_RUNS',
  'TAG',
  'GIT_PUSH',
  'GITHUB_RELEASE',
  'NPM_PUBLISH_SDK',
  'NPM_PUBLISH_CLI',
  'POST_RELEASE_VERIFY',
])

function fail(message: string): never {
  throw new Error(message)
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {}
  const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`Expected a JSON object: ${filePath}`)
  }
  return parsed as Record<string, unknown>
}

/** Extract exactly one current-version section from CHANGELOG.md. */
export function extractChangelogSection(
  changelog: string,
  version: string,
): string {
  const headingPattern = /^##\s+(?:\[)?v?(\d+\.\d+\.\d+)(?:\]|\s|$)(.*)$/gm
  const headings: Array<{
    version: string
    start: number
    date?: string
  }> = []
  for (const match of changelog.matchAll(headingPattern)) {
    const headingVersion = match[1]
    if (!headingVersion) continue
    const headingDate = match[2]?.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1]
    headings.push({
      version: headingVersion,
      start: match.index ?? 0,
      date: headingDate,
    })
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1]
    const currentHeading = headings[index]
    const isOutOfOrder =
      previous.date && currentHeading.date
        ? previous.date < currentHeading.date
        : compareVersions(previous.version, currentHeading.version) < 0
    if (isOutOfOrder) {
      fail('CHANGELOG.md headings must be reverse-chronological.')
    }
  }

  const matches = headings.filter((heading) => heading.version === version)
  if (matches.length !== 1) {
    fail(
      `CHANGELOG.md must contain exactly one heading for v${version}; found ${matches.length}.`,
    )
  }

  const current = matches[0]
  const nextHeading = headings.find((heading) => heading.start > current.start)
  const section = changelog
    .slice(current.start, nextHeading?.start ?? changelog.length)
    .trim()
  if (!section) fail(`CHANGELOG.md section for v${version} is empty.`)
  return section
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return (leftParts[index] ?? 0) - (rightParts[index] ?? 0)
    }
  }
  return 0
}

export function validateReleaseVersions(
  version: string,
  files: Record<string, string>,
): void {
  for (const [filePath, content] of Object.entries(files)) {
    const parsed = JSON.parse(content) as { version?: unknown }
    if (parsed.version !== version) {
      fail(`${filePath} is ${String(parsed.version)}; expected ${version}.`)
    }
  }
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
    `Create the GitHub REST release for v${version} with the current CHANGELOG section`,
    ...packages.map((target) => `npm publish ${target.name}`),
    'Verify public versions and restore local state',
  ]
}

export function redactSecretText(value: string): string {
  const redacted = value
    .replace(
      /((?:OPENROUTER_API_KEY|OR_MASTER_KEY|INFERENCE_API_KEY|GITHUB_TOKEN|GH_TOKEN|NPM_TOKEN|SAVANT_CODE_API_KEY|AWS_SECRET_ACCESS_KEY|API_KEY|TOKEN|PASSWORD|SECRET)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,}]+)/gi,
      '$1[REDACTED]',
    )
    .replace(
      /(authorization\s*[:=]\s*(?:bearer|basic)\s+)[A-Za-z0-9+/=._~-]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(AUTHORIZATION:\s*basic\s+)[A-Za-z0-9+/=._~-]+/gi, '$1[REDACTED]')
  if (
    /\b(?:bearer|basic)\s+[A-Za-z0-9+/=._~-]{16,}/i.test(redacted) ||
    // Residual unredacted credential shapes. The value must look high-entropy
    // (≥16 chars containing a digit; digits are immune to the /i flag) so
    // legitimate prose like "credential: certificate-holder-name" is never
    // discarded while real credentials (ghs_…, npm_…, mixed-case tokens) are.
    /\b(?:api[_-]?key|token|secret|password|authorization|credential|private[_-]?key|access[_-]?key)\s*[:=]\s*(?!\[REDACTED\])(?=[^\s,}]{15,}[0-9])(?=[A-Za-z0-9+/=._~-]{16,})[^\s,}]{16,}/i.test(
      redacted,
    )
  ) {
    fail(
      'Unclassified credential-shaped output; raw command output was discarded.',
    )
  }
  return redacted
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    )
  }
  return value
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function validateToolVersions(
  bunVersion: string,
  npmVersion: string,
): void {
  if (bunVersion !== REQUIRED_BUN_VERSION) {
    fail(`Release requires Bun ${REQUIRED_BUN_VERSION}; found ${bunVersion}.`)
  }
  const npmMajor = Number.parseInt(npmVersion.split('.')[0] ?? '', 10)
  if (npmMajor !== REQUIRED_NPM_MAJOR) {
    fail(`Release requires npm ${REQUIRED_NPM_MAJOR}.x; found ${npmVersion}.`)
  }
}

/**
 * Candidate locations for the pinned Bun install, most specific first. The
 * first candidate is the out-of-band version-pinned install used when the
 * globally installed Bun predates `.bun-version`; the second is the standard
 * Bun installer location. Each candidate is version-verified before use.
 */
export function pinnedBunCandidates(home = os.homedir()): string[] {
  const executable = process.platform === 'win32' ? 'bun.exe' : 'bun'
  return [
    path.join(home, `.bun-${REQUIRED_BUN_VERSION}`, 'bin', executable),
    path.join(home, '.bun', 'bin', executable),
  ]
}

/**
 * Returns the first candidate that exists and reports exactly the required
 * Bun version, or undefined when no pinned install is present. A candidate
 * that exists but reports a different version is skipped so a stale install
 * never passes the version gate.
 */
export function resolvePinnedBun(
  root: string,
  home = os.homedir(),
): string | undefined {
  for (const candidate of pinnedBunCandidates(home)) {
    if (!existsSync(candidate)) continue
    const probe = run(candidate, ['--version'], root, true)
    if (probe.status === 0 && probe.stdout.trim() === REQUIRED_BUN_VERSION) {
      return candidate
    }
  }
  return undefined
}

/**
 * Makes the pinned Bun the effective runtime for this process. If the `bun`
 * on PATH already satisfies `.bun-version` this is a no-op; otherwise the
 * pinned install's bin directory is prepended to `process.env.PATH` so every
 * subsequent `bun`/`bunx` spawn (gate specs, version checks) resolves to the
 * required version. Fails closed with install guidance when no pinned install
 * can be found, so daily pushes never depend on a hand-tuned shell PATH.
 */
export function ensurePinnedBunOnPath(root: string, home = os.homedir()): void {
  const current = run('bun', ['--version'], root, true)
  if (current.status === 0 && current.stdout.trim() === REQUIRED_BUN_VERSION) {
    return
  }
  const pinned = resolvePinnedBun(root, home)
  if (!pinned) {
    const found = current.status === 0 ? current.stdout.trim() : 'unavailable'
    fail(
      `Release requires Bun ${REQUIRED_BUN_VERSION} but 'bun' resolves to ${found} and no pinned install was found at ${pinnedBunCandidates(home).join(' or ')}. Install Bun ${REQUIRED_BUN_VERSION} or add it to PATH.`,
    )
  }
  const pinnedDir = path.dirname(pinned)
  const existing = process.env.PATH ?? ''
  process.env.PATH = existing
    ? `${pinnedDir}${path.delimiter}${existing}`
    : pinnedDir
}

export function buildGateManifest(
  root: string,
  version: string,
  bunVersion: string,
  npmVersion: string,
  headSha = '',
): { specs: GateSpec[]; hash: string } {
  const specs: GateSpec[] = [
    ...repositoryValidationGates(root),
    ...configuredReleasePackages().map((target) => ({
      label: `npm-pack:${target.name}`,
      command: 'npm',
      args: ['pack', '--dry-run'],
      cwd: path.join(root, target.directory),
    })),
  ]
  const identity = canonicalize({
    version,
    specs,
    bunVersion,
    npmVersion,
    headSha,
    profile: PROFILE_ENV,
    mode: 'public-release-gates',
  })
  const serialized = JSON.stringify(identity)
  return { specs, hash: sha256Text(serialized) }
}

function transcriptDirectory(version: string): string {
  const directory = path.join(
    os.tmpdir(),
    `savant-public-release-${version}-evidence`,
  )
  mkdirSync(directory, { recursive: true })
  return directory
}

function writeRedactedTranscript(
  version: string,
  label: string,
  attempt: number,
  content: string,
): { path: string; hash: string } {
  const safeLabel = label.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
  const directory = transcriptDirectory(version)
  const finalPath = path.join(directory, `${safeLabel}-${attempt}.log`)
  const temporaryPath = `${finalPath}.${process.pid}.tmp`
  let redacted: string
  try {
    redacted = redactSecretText(content)
  } catch {
    rmSync(temporaryPath, { force: true })
    fail('Transcript redaction failed; raw command output was discarded.')
  }
  try {
    writeFileSync(temporaryPath, redacted, { encoding: 'utf8', mode: 0o600 })
    const bytes = readFileSync(temporaryPath)
    const hash = createHash('sha256').update(bytes).digest('hex')
    renameSync(temporaryPath, finalPath)
    return { path: finalPath, hash }
  } catch {
    rmSync(temporaryPath, { force: true })
    fail('Transcript persistence failed; release evidence is not resumable.')
  }
}

function boundedSummary(output: string): string {
  const normalized = redactSecretText(output).trim()
  if (normalized.length <= 2_000) return normalized
  return `${normalized.slice(0, 900)}\\n…[output elided; transcript contains complete evidence]…\\n${normalized.slice(-900)}`
}

export function classifyCommandResult(result: {
  status: number | null
  signal?: NodeJS.Signals | null
  error?: Error & { code?: string }
  timedOut?: boolean
}): CommandFailureClass {
  if (result.timedOut || result.error?.code === 'ETIMEDOUT') return 'timeout'
  if (result.error) return 'spawn-error'
  if (result.status === 0) return 'success'
  if (result.signal) return 'signal'
  if (typeof result.status === 'number') return 'exit'
  return 'malformed'
}

export function finalizeSuccessfulReleaseReceipt(
  receipt: ReleaseReceipt,
): void {
  receipt.failedStage = undefined
}

export function redactReceipt(receipt: ReleaseReceipt): string {
  let failedStage = receipt.failedStage
  try {
    failedStage = failedStage ? redactSecretText(failedStage) : failedStage
  } catch {
    failedStage = 'redaction-failed; sensitive failure details discarded'
  }
  return JSON.stringify(
    {
      ...receipt,
      schemaVersion: 'release-receipt/v2',
      failedStage,
    },
    null,
    2,
  )
}

export function isStageComplete(
  receipt: Pick<ReleaseReceipt, 'completedStages'> | undefined,
  stage: string,
): boolean {
  return receipt?.completedStages.includes(stage) ?? false
}

function repositoryRoot(): string {
  return path.resolve(import.meta.dir, '..')
}

function settingsPath(): string {
  const override = process.env.SAVANT_CODE_CONFIG_DIR
  if (override) return path.join(override, 'settings.json')

  const candidates = [
    path.join(os.homedir(), '.savant-code-dev', 'settings.json'),
    path.join(os.homedir(), '.savant-code', 'settings.json'),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function receiptPath(version: string): string {
  return path.join(os.tmpdir(), `savant-public-release-${version}.json`)
}

export function isNotFoundResult(result: {
  stdout: string
  stderr: string
}): boolean {
  const output = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return /npm (?:err!|error)\s+(?:code\s+e404|404)|http 404|release does not exist|release not found|no matching version|no match found for version|is not in this registry/.test(
    output,
  )
}

export function validateResumeReceipt(
  version: string,
  parsed: ReleaseReceipt,
  filePath: string,
  expectedMode?: ReleaseReceipt['mode'],
  root?: string,
): ReleaseReceipt {
  if (
    parsed.schemaVersion !== 'release-receipt/v2' ||
    parsed.version !== version ||
    !['publish', 'automation'].includes(parsed.mode) ||
    (expectedMode && parsed.mode !== expectedMode) ||
    !Array.isArray(parsed.completedStages)
  ) {
    fail(`Resume receipt is incompatible with v${version}: ${filePath}`)
  }
  if (!parsed.restored) {
    fail(
      `Resume is refused because the prior run did not confirm local-state restoration: ${filePath}`,
    )
  }
  if (!parsed.headSha) {
    fail(`Resume receipt has no commit binding: ${filePath}`)
  }
  if (!/^[0-9a-f]{40}$/i.test(String(parsed.headSha))) {
    fail(`Resume receipt has an invalid commit binding: ${filePath}`)
  }
  if (
    new Set(parsed.completedStages).size !== parsed.completedStages.length ||
    parsed.completedStages.some((stage) => !RELEASE_STAGES.has(stage))
  ) {
    fail(`Resume receipt contains invalid or duplicate stages: ${filePath}`)
  }
  if (parsed.evidenceHeadSha && parsed.evidenceHeadSha !== parsed.headSha) {
    fail(
      `Resume receipt gate evidence is bound to a different HEAD: ${filePath}`,
    )
  }
  if (root && parsed.gateManifestHash && parsed.headSha) {
    const currentHead = run('git', ['rev-parse', 'HEAD'], root, true)
    const bun = run('bun', ['--version'], root, true)
    const npm = run('npm', ['--version'], root, true)
    if (
      currentHead.status !== 0 ||
      bun.status !== 0 ||
      npm.status !== 0 ||
      currentHead.stdout.trim() !== parsed.headSha
    ) {
      fail(
        `Resume gate evidence is not bound to the current release environment: ${filePath}`,
      )
    }
    const currentManifest = buildGateManifest(
      root,
      version,
      bun.stdout.trim(),
      npm.stdout.trim(),
      currentHead.stdout.trim(),
    )
    if (currentManifest.hash !== parsed.gateManifestHash) {
      fail(
        `Resume gate manifest differs from the recorded evidence: ${filePath}`,
      )
    }
  }
  if (parsed.gateAttempts) {
    for (const attempt of parsed.gateAttempts) {
      if (
        !attempt.transcriptFinalized ||
        !attempt.transcriptPath ||
        !attempt.transcriptSha256
      ) {
        fail(`Resume receipt has incomplete transcript evidence: ${filePath}`)
      }
      if (!existsSync(attempt.transcriptPath)) {
        fail(`Resume transcript is missing: ${attempt.transcriptPath}`)
      }
      const actualHash = createHash('sha256')
        .update(readFileSync(attempt.transcriptPath))
        .digest('hex')
      if (actualHash !== attempt.transcriptSha256) {
        fail(`Resume transcript hash mismatch: ${attempt.transcriptPath}`)
      }
    }
  }
  if (
    parsed.completedStages.includes('GATES_AND_PACKAGE_DRY_RUNS') &&
    (!parsed.gateManifestHash ||
      !parsed.evidenceHeadSha ||
      parsed.evidenceHeadSha !== parsed.headSha ||
      !parsed.gateAttempts?.length ||
      parsed.evidenceFinalized !== true ||
      parsed.gateAttempts.some((attempt) => !attempt.transcriptFinalized))
  ) {
    fail(`Resume receipt has incomplete gate evidence: ${filePath}`)
  }
  return { ...parsed, receiptPath: filePath }
}

function loadResumeReceipt(
  version: string,
  expectedMode: ReleaseReceipt['mode'],
): ReleaseReceipt | undefined {
  const filePath = receiptPath(version)
  if (!existsSync(filePath)) return undefined
  const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as ReleaseReceipt
  return validateResumeReceipt(
    version,
    parsed,
    filePath,
    expectedMode,
    repositoryRoot(),
  )
}

export function snapshotLocalState(): LocalSnapshot {
  const currentSettingsPath = settingsPath()
  const snapshot: LocalSnapshot = {
    env: Object.fromEntries(
      PROFILE_ENV_KEYS.map((key) => [key, process.env[key]]),
    ),
    settingsPath: currentSettingsPath,
    settingsExisted: existsSync(currentSettingsPath),
  }
  if (snapshot.settingsExisted) {
    snapshot.settingsContent = readFileSync(snapshot.settingsPath, 'utf8')
  }
  return snapshot
}

/** True when the persisted settings already carry the public release profile. */
export function settingsAlreadyPublic(
  settingsContent: string | undefined,
): boolean {
  if (!settingsContent) return false
  return (
    settingsContent.includes('openrouter/free') &&
    /"directProvider"\s*:\s*"openrouter"/.test(settingsContent)
  )
}

/**
 * Locates the most recently written non-diagnostic release receipt in the
 * given directory (defaults to the OS temp directory). Diagnostic receipts are
 * excluded because they never apply or restore the public profile.
 */
export function mostRecentReleaseReceipt(
  directory = os.tmpdir(),
  repositoryKey?: string,
): string | undefined {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return undefined
  }
  let latestPath: string | undefined
  let latestMtime = 0
  // An unreadable receipt could be torn crash evidence; if it is the newest
  // candidate we return it so the caller fails closed with a clear message
  // instead of silently treating the crash as if it never happened.
  let newestUnreadablePath: string | undefined
  let newestUnreadableMtime = 0
  for (const entry of entries) {
    if (
      !entry.startsWith('savant-public-release-') ||
      !entry.endsWith('.json') ||
      entry.includes('-diagnostic.json')
    ) {
      continue
    }
    const fullPath = path.join(directory, entry)
    let mtimeMs: number
    try {
      mtimeMs = lstatSync(fullPath).mtimeMs
    } catch {
      continue
    }
    if (repositoryKey) {
      let receiptKey: unknown
      try {
        receiptKey = (
          JSON.parse(readFileSync(fullPath, 'utf8')) as {
            repositoryKey?: unknown
          }
        ).repositoryKey
      } catch {
        if (mtimeMs > newestUnreadableMtime) {
          newestUnreadableMtime = mtimeMs
          newestUnreadablePath = fullPath
        }
        continue
      }
      // Receipts written before repo-keying carried no identity; treat them
      // as belonging to this repository so legacy crash evidence still counts.
      if (receiptKey !== undefined && receiptKey !== repositoryKey) continue
    }
    if (mtimeMs > latestMtime) {
      latestMtime = mtimeMs
      latestPath = fullPath
    }
  }
  return (
    latestPath ??
    // Only fail closed on the unreadable candidate when it is newer than any
    // readable receipt we found.
    (newestUnreadableMtime > latestMtime ? newestUnreadablePath : undefined)
  )
}

/**
 * Fails closed when persisted settings already carry the public release
 * profile and the most recent prior release receipt did not confirm local
 * state restoration. Scanning every version closes the cross-version gap: a
 * crash during v0.0.21 leaves the profile baked, and a fresh v0.0.22 run must
 * still refuse to re-bake it even though no v0.0.22 receipt exists.
 */
export function assertNoUnrestoredPriorRelease(
  settingsContent: string | undefined,
  directory = os.tmpdir(),
  repositoryKey?: string,
): void {
  if (!settingsAlreadyPublic(settingsContent)) return
  const priorReceiptPath = mostRecentReleaseReceipt(directory, repositoryKey)
  if (!priorReceiptPath) return
  let diskRestored: unknown
  try {
    diskRestored = (
      JSON.parse(readFileSync(priorReceiptPath, 'utf8')) as {
        restored?: unknown
      }
    ).restored
  } catch {
    fail(`Existing release receipt is unreadable: ${priorReceiptPath}`)
  }
  if (diskRestored !== true) {
    fail(
      `Local settings already contain the public release profile and the most recent release receipt (${priorReceiptPath}) did not confirm restoration; refusing to re-bake the profile. If you have already verified your settings are correct, delete that receipt and re-run; otherwise run --resume or restore settings manually.`,
    )
  }
}

export function applyPublicProfile(snapshot: LocalSnapshot): void {
  for (const [key, value] of Object.entries(PROFILE_ENV)) {
    process.env[key] = value
  }

  const settings = readJsonObject(snapshot.settingsPath)
  settings.savantCodeModelPreference = 'openrouter/free'
  settings.savantCodeModelProviderPreference = 'openrouter'
  settings.directProvider = 'openrouter'
  settings.directProviderBaseUrl = 'https://openrouter.ai/api/v1'
  mkdirSync(path.dirname(snapshot.settingsPath), { recursive: true })
  writeFileSync(snapshot.settingsPath, JSON.stringify(settings, null, 2))
}

export function restoreLocalState(snapshot: LocalSnapshot): void {
  for (const [key, value] of Object.entries(snapshot.env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  if (snapshot.settingsExisted) {
    writeFileSync(snapshot.settingsPath, snapshot.settingsContent ?? '')
  } else {
    rmSync(snapshot.settingsPath, { force: true })
  }
}

type ProcessResult = {
  pid?: number
  status: number | null
  signal: NodeJS.Signals | null
  error?: Error & { code?: string }
  timedOut?: boolean
  cleanupFailure?: string
  stdout: string
  stderr: string
}

const COMMAND_TIMEOUT_MS = 30 * 60 * 1_000
const ALLOWED_RELEASE_COMMANDS = new Set([
  'bun',
  'npm',
  'git',
  'gh',
  'powershell.exe',
  'taskkill',
])

export function validateReleaseCommand(command: string): void {
  const executable = path.basename(command).toLowerCase()
  if (!ALLOWED_RELEASE_COMMANDS.has(executable)) {
    throw new Error(`Release command is not allowlisted: ${command}`)
  }
}

function processTableRows(): Array<[number, number]> | undefined {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = $_.ProcessId; ppid = $_.ParentProcessId } } | ConvertTo-Json -Compress',
    ],
    {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
      timeout: 20_000,
      killSignal: 'SIGTERM',
      shell: false,
    },
  )
  if (result.status !== 0 || !result.stdout.trim()) return undefined
  try {
    const parsed: unknown = JSON.parse(result.stdout)
    const rows = Array.isArray(parsed) ? parsed : [parsed]
    return rows
      .filter(
        (row): row is { pid?: unknown; ppid?: unknown } =>
          typeof row === 'object' &&
          row !== null &&
          'pid' in row &&
          'ppid' in row,
      )
      .map((row) => [Number(row.pid), Number(row.ppid)] as [number, number])
      .filter(
        (entry): entry is [number, number] =>
          Number.isInteger(entry[0]) && Number.isInteger(entry[1]),
      )
  } catch {
    return undefined
  }
}

/** Enumerate the full owned descendant tree of `pid` via parent-chain walk. */
export function enumerateProcessTree(pid: number): number[] {
  const children = new Map<number, number[]>()
  const rows = processTableRows()
  if (rows === undefined) return []
  for (const [childPid, parentPid] of rows) {
    const siblings = children.get(parentPid) ?? []
    siblings.push(childPid)
    children.set(parentPid, siblings)
  }
  const owned = new Set<number>([pid])
  const queue = [pid]
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) break
    for (const child of children.get(current) ?? []) {
      if (!owned.has(child)) {
        owned.add(child)
        queue.push(child)
      }
    }
  }
  return [...owned].sort((left, right) => left - right)
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function terminateOwnedProcessTree(
  pid: number | undefined,
): string | undefined {
  if (!pid) return 'timed-out process did not expose an owned PID'
  if (process.platform !== 'win32') {
    return 'process-tree verification is only supported on Windows'
  }
  const owned = enumerateProcessTree(pid)
  if (owned.length === 0) {
    return 'owned process tree could not be enumerated for verification'
  }
  const terminated = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
    shell: false,
  })
  if (terminated.status !== 0) {
    return 'timed-out process tree could not be terminated safely'
  }
  let survivors = owned.filter((entry) => isProcessAlive(entry))
  if (survivors.length > 0) {
    // Kill stragglers only when a fresh process-table read confirms the PID is
    // still parented inside the owned tree; a PID reused by an unrelated
    // process (parent outside the owned set) is never terminated.
    for (const survivor of killableOwnedSurvivors(pid, owned)) {
      spawnSync('taskkill', ['/PID', String(survivor), '/T', '/F'], {
        encoding: 'utf8',
        stdio: 'pipe',
        windowsHide: true,
        shell: false,
      })
    }
    survivors = owned.filter((entry) => isProcessAlive(entry))
  }
  if (survivors.length > 0) {
    const bounded = survivors.slice(0, 20).join(', ')
    const suffix = survivors.length > 20 ? ', …' : ''
    return `owned timed-out processes remained after tree termination (${bounded}${suffix})`
  }
  return undefined
}

function killableOwnedSurvivors(
  rootPid: number,
  owned: readonly number[],
): number[] {
  const rows = processTableRows()
  if (rows === undefined) return []
  const alive = new Set(rows.map(([childPid]) => childPid))
  const parentOf = new Map(
    rows.map(([childPid, parentPid]) => [childPid, parentPid]),
  )
  const ownedSet = new Set(owned)
  const killable: number[] = []
  for (const entry of owned) {
    if (!alive.has(entry)) continue
    if (entry === rootPid) {
      killable.push(entry)
      continue
    }
    const parent = parentOf.get(entry)
    if (parent !== undefined && ownedSet.has(parent)) killable.push(entry)
  }
  return killable
}

export function readCapturedOutput(filePath: string | undefined): string {
  if (!filePath) return ''
  const bytes = readFileSync(filePath)
  // Lenient decode: a stray non-UTF8 byte must never mask the command's real
  // exit status or destroy the transcript evidence (FID-2026-0808-003 audit).
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function run(
  command: string,
  args: string[],
  cwd: string,
  capture = false,
  extraEnv?: Record<string, string>,
  replaceEnv = false,
): ProcessResult {
  validateReleaseCommand(command)
  let temporaryDirectory: string | undefined
  let stdoutPath: string | undefined
  let stderrPath: string | undefined
  let stdoutFd: number | undefined
  let stderrFd: number | undefined
  try {
    let stdio: 'inherit' | ['ignore', number, number] = 'inherit'
    if (capture) {
      temporaryDirectory = mkdtempSync(
        path.join(os.tmpdir(), 'savant-release-run-'),
      )
      stdoutPath = path.join(temporaryDirectory, 'stdout.log')
      stderrPath = path.join(temporaryDirectory, 'stderr.log')
      stdoutFd = openSync(stdoutPath, 'w')
      stderrFd = openSync(stderrPath, 'w')
      stdio = ['ignore', stdoutFd, stderrFd]
    }
    const result = spawnSync(command, args, {
      cwd,
      encoding: 'utf8',
      stdio,
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGTERM',
      shell: false,
      env: extraEnv
        ? replaceEnv
          ? { ...extraEnv }
          : { ...process.env, ...extraEnv }
        : process.env,
    })
    if (stdoutFd !== undefined) closeSync(stdoutFd)
    if (stderrFd !== undefined) closeSync(stderrFd)
    stdoutFd = undefined
    stderrFd = undefined
    const resultError = result.error as (Error & { code?: string }) | undefined
    const timedOut = resultError?.code === 'ETIMEDOUT'
    const cleanupFailure = timedOut
      ? terminateOwnedProcessTree(result.pid)
      : undefined
    return {
      pid: result.pid,
      status: result.status,
      signal: result.signal,
      error: result.error,
      timedOut,
      cleanupFailure,
      stdout: readCapturedOutput(stdoutPath),
      stderr: readCapturedOutput(stderrPath),
    }
  } catch (error) {
    if (stdoutFd !== undefined) closeSync(stdoutFd)
    if (stderrFd !== undefined) closeSync(stderrFd)
    return {
      status: null,
      signal: null,
      error: error instanceof Error ? error : new Error(String(error)),
      timedOut:
        error instanceof Error && 'code' in error && error.code === 'ETIMEDOUT',
      stdout: '',
      stderr: '',
    }
  } finally {
    if (temporaryDirectory)
      rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

function requireCommand(
  command: string,
  mutationMode: boolean,
): string | undefined {
  const result = run(command, ['--version'], repositoryRoot(), true)
  if (result.status === 0) return undefined
  const message = `Required command unavailable: ${command}`
  if (mutationMode) fail(message)
  return message
}

function runRequired(
  command: string,
  args: string[],
  cwd: string,
  extraEnv?: Record<string, string>,
): void {
  const result = run(command, args, cwd, false, extraEnv)
  if (classifyCommandResult(result) !== 'success') {
    const details = result.signal
      ? ` signal=${result.signal}`
      : result.error
        ? ` error=${result.error.name}`
        : ''
    fail(`Stage command failed: ${command} ${args.join(' ')}${details}`)
  }
}

const SECRET_ENV_KEYS = new Set([
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'INFERENCE_API_KEY',
  'NPM_TOKEN',
  'OPENROUTER_API_KEY',
  'OR_MASTER_KEY',
  'SAVANT_CODE_API_KEY',
])

/**
 * Full replacement environment for gate commands with known secret variables
 * removed, so gate output can never carry them into transcripts even before
 * redaction (FID-2026-0808-003 audit finding F-H).
 */
export function sanitizedGateEnv(): Record<string, string> | undefined {
  let removed = 0
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (SECRET_ENV_KEYS.has(key)) {
      removed += 1
      continue
    }
    if (value !== undefined) env[key] = value
  }
  return removed > 0 ? env : undefined
}

function executeGate(
  spec: GateSpec,
  version: string,
  attempt: number,
): GateAttempt {
  const startedAt = new Date().toISOString()
  const started = Date.now()
  const result = run(
    spec.command,
    spec.args,
    spec.cwd,
    true,
    sanitizedGateEnv(),
    true,
  )
  const finishedAt = new Date().toISOString()
  let failureClass = classifyCommandResult(result)
  let transcript: { path: string; hash: string } | undefined
  let transcriptFinalized = true
  let transcriptFailure = ''
  try {
    transcript = writeRedactedTranscript(
      version,
      spec.label,
      attempt,
      `${result.stdout}${result.stderr ? `\\n[stderr]\\n${result.stderr}` : ''}`,
    )
  } catch {
    transcriptFinalized = false
    failureClass = 'evidence-error'
    transcriptFailure = 'transcript-redaction-or-persistence-failed'
  }
  return {
    label: spec.label,
    command: spec.command,
    args: spec.args,
    cwd: spec.cwd,
    attempt,
    failureClass,
    status: result.status ?? -1,
    signal: result.signal,
    startedAt,
    finishedAt,
    durationMs: Date.now() - started,
    transcriptPath: transcript?.path,
    transcriptSha256: transcript?.hash,
    transcriptFinalized,
    cleanupFailure: result.cleanupFailure,
    summary: transcriptFinalized
      ? boundedSummary(
          `${result.stdout}${result.stderr ? `\\n${result.stderr}` : ''}${result.cleanupFailure ? `\\n[cleanup] ${result.cleanupFailure}` : ''}`,
        )
      : transcriptFailure,
  }
}

export function runReadOnlyGateManifest(
  root: string,
  version: string,
): {
  manifestHash: string
  attempts: GateAttempt[]
  passed: boolean
  headSha: string
} {
  const bun = run('bun', ['--version'], root, true)
  const npm = run('npm', ['--version'], root, true)
  if (
    classifyCommandResult(bun) !== 'success' ||
    classifyCommandResult(npm) !== 'success'
  ) {
    fail('Unable to resolve Bun/npm versions for the gate manifest.')
  }
  validateToolVersions(bun.stdout.trim(), npm.stdout.trim())
  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  if (head.status !== 0 || !/^[0-9a-f]{40}$/i.test(head.stdout.trim())) {
    fail('Unable to bind diagnostic evidence to the current HEAD.')
  }
  const manifest = buildGateManifest(
    root,
    version,
    bun.stdout.trim(),
    npm.stdout.trim(),
    head.stdout.trim(),
  )
  const attempts: GateAttempt[] = []
  let passed = true
  for (const spec of manifest.specs) {
    const attempt = executeGate(spec, version, 1)
    attempts.push(attempt)
    if (attempt.failureClass !== 'success' || !attempt.transcriptFinalized) {
      passed = false
      break
    }
  }
  const afterHead = run('git', ['rev-parse', 'HEAD'], root, true)
  if (
    afterHead.status !== 0 ||
    afterHead.stdout.trim() !== head.stdout.trim()
  ) {
    fail('Diagnostic gates changed HEAD; evidence was discarded.')
  }
  return {
    manifestHash: manifest.hash,
    attempts,
    passed,
    headSha: head.stdout.trim(),
  }
}

function currentVersion(root: string): string {
  const version = readFileSync(path.join(root, 'VERSION'), 'utf8').trim()
  if (!/^\d+\.\d+\.\d+$/.test(version))
    fail(`Invalid VERSION value: ${version}`)
  return version
}

function verifyPreflight(
  root: string,
  version: string,
  mutationMode: boolean,
  allowExistingTag: boolean,
  automation = false,
): { notes: string; warnings: string[]; headSha: string } {
  const warnings: string[] = []
  const remote = run('git', ['remote', 'get-url', 'origin'], root, true)
  const pushRemote = run(
    'git',
    ['remote', 'get-url', '--push', 'origin'],
    root,
    true,
  )
  if (remote.status !== 0 || remote.stdout.trim() !== PUBLIC_REPOSITORY) {
    const message = `origin must be ${PUBLIC_REPOSITORY}; found ${remote.stdout.trim()}`
    if (mutationMode) fail(message)
    warnings.push(message)
  }
  if (
    pushRemote.status !== 0 ||
    pushRemote.stdout.trim() !== PUBLIC_REPOSITORY
  ) {
    const message = `origin push URL must be ${PUBLIC_REPOSITORY}; found ${pushRemote.stdout.trim()}`
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  const changelog = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
  const notes = extractChangelogSection(changelog, version)
  validateReleaseVersions(version, {
    'package.json': readFileSync(path.join(root, 'package.json'), 'utf8'),
    'sdk/package.json': readFileSync(
      path.join(root, 'sdk/package.json'),
      'utf8',
    ),
    'cli/package.json': readFileSync(
      path.join(root, 'cli/package.json'),
      'utf8',
    ),
    'cli/release/package.json': readFileSync(
      path.join(root, 'cli/release/package.json'),
      'utf8',
    ),
  })

  const repositoryValidation = run(
    'bun',
    ['run', 'validate:repository'],
    root,
    true,
  )
  if (repositoryValidation.status !== 0) {
    const message =
      `Repository metadata/command parity validation failed:\\n${repositoryValidation.stdout}${repositoryValidation.stderr}`.trim()
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  if (mutationMode) {
    const branch = run('git', ['branch', '--show-current'], root, true)
    if (branch.status !== 0 || branch.stdout.trim() !== 'main') {
      fail(
        `Mutation mode requires the main branch; found ${branch.stdout.trim()}`,
      )
    }
  }

  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0) fail('Unable to inspect the Git worktree.')
  if (status.stdout.trim()) {
    const message = automation
      ? 'Automation mode will commit all current worktree changes.'
      : 'Mutation mode requires a clean worktree.'
    if (mutationMode && !automation) fail(`${message}\n${status.stdout.trim()}`)
    warnings.push(`${message}\n${status.stdout.trim()}`)
  }

  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  if (head.status !== 0 || !/^[0-9a-f]{40}$/i.test(head.stdout.trim())) {
    fail('Unable to resolve the release HEAD commit.')
  }
  const headSha = head.stdout.trim()
  const tagResult = run(
    'git',
    ['rev-parse', '--verify', `refs/tags/v${version}`],
    root,
    true,
  )
  const tagExists = tagResult.status === 0
  if (tagExists && allowExistingTag) {
    const tagCommit = run(
      'git',
      ['rev-parse', `refs/tags/v${version}^{}`],
      root,
      true,
    )
    if (tagCommit.status !== 0 || tagCommit.stdout.trim() !== headSha) {
      fail(
        `Existing tag v${version} does not point at release HEAD ${headSha}.`,
      )
    }
  }
  if (tagExists && !allowExistingTag) {
    const message = `Tag v${version} already exists; use --resume with its receipt.`
    if (mutationMode) fail(message)
    warnings.push(message)
  }

  return { notes, warnings, headSha }
}

type GitHubApiOptions = {
  token: string
  fetchImpl?: typeof fetch
}

export async function githubApiRequest<T>(
  endpoint: string,
  options: GitHubApiOptions & {
    method?: string
    body?: Record<string, unknown>
    expectedStatuses?: number[]
  },
): Promise<{ status: number; body: T | undefined }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await (options.fetchImpl ?? fetch)(
      `https://api.github.com${endpoint}`,
      {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${options.token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      },
    )
    const text = await response.text()
    const expected = options.expectedStatuses ?? [200]
    if (!expected.includes(response.status)) {
      if (response.status === 404 && expected.includes(404)) {
        return { status: response.status, body: undefined }
      }
      fail(`GitHub API request failed with HTTP ${response.status}.`)
    }

    let body: T | undefined
    if (text) {
      try {
        body = JSON.parse(text) as T
      } catch {
        fail(`GitHub API returned invalid JSON (${response.status}).`)
      }
    }
    return { status: response.status, body }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('GitHub API'))
      throw error
    fail('GitHub API request failed without exposing response details.')
  } finally {
    clearTimeout(timeout)
  }
}

async function assertGitHubToken(token: string): Promise<void> {
  await githubApiRequest<{ login?: string }>('/user', {
    token,
    expectedStatuses: [200],
  })
}

async function verifyGitHubTagHeadApi(
  version: string,
  expectedHead: string,
  token: string,
): Promise<void> {
  const reference = await githubApiRequest<{
    object?: { type?: string; sha?: string }
  }>(`/repos/${PUBLIC_REPOSITORY_SLUG}/git/ref/tags/v${version}`, {
    token,
    expectedStatuses: [200],
  })
  const object = reference.body?.object
  if (object?.type === 'commit' && object.sha === expectedHead) return
  if (object?.type !== 'tag' || !object.sha) {
    fail(`GitHub tag v${version} is not bound to release HEAD.`)
  }
  const annotated = await githubApiRequest<{ object?: { sha?: string } }>(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/git/tags/${object.sha}`,
    { token, expectedStatuses: [200] },
  )
  if (annotated.body?.object?.sha !== expectedHead) {
    fail(`GitHub annotated tag v${version} is not bound to release HEAD.`)
  }
}

async function assertNoExistingReleaseApi(
  version: string,
  token: string,
): Promise<void> {
  const result = await githubApiRequest(
    `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
    {
      token,
      expectedStatuses: [200, 404],
    },
  )
  if (result.status !== 404) {
    fail(`GitHub release v${version} already exists; use --resume.`)
  }
}

async function createGitHubReleaseApi(
  version: string,
  notes: string,
  token: string,
): Promise<void> {
  await githubApiRequest(`/repos/${PUBLIC_REPOSITORY_SLUG}/releases`, {
    token,
    method: 'POST',
    expectedStatuses: [201],
    body: {
      tag_name: `v${version}`,
      target_commitish: 'main',
      name: `v${version}`,
      body: notes,
      draft: false,
      prerelease: false,
    },
  })
}

export function recoverAutomationCommit(
  root: string,
  previousHead: string,
  version: string,
): { headSha: string; files: string[] } | undefined {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0 || status.stdout.trim()) return undefined

  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  const parent = run('git', ['rev-parse', 'HEAD^'], root, true)
  const subject = run('git', ['log', '-1', '--format=%s'], root, true)
  if (
    head.status !== 0 ||
    parent.status !== 0 ||
    subject.status !== 0 ||
    parent.stdout.trim() !== previousHead ||
    subject.stdout.trim() !== `chore(release): prepare v${version}`
  ) {
    return undefined
  }

  const changed = run(
    'git',
    ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD'],
    root,
    true,
  )
  if (changed.status !== 0) return undefined
  return {
    headSha: head.stdout.trim(),
    files: changed.stdout.split('\0').filter(Boolean),
  }
}

const CREDENTIAL_FILE_PATTERNS = [
  /(?:^|\/)\.env(?:$|\.(?!example(?:\.[^.]+)?$))/i,
  /(?:^|\/)\.npmrc$/i,
  /(?:^|\/)id_rsa(?:\.pub)?$/i,
  /\.(?:pem|p12|pfx|key)$/i,
  /(?:^|\/)(?:credentials|secrets)(?:\.|\/|$)/i,
]

// Shannon entropy floor (bits/char) applied to captured token bodies, plus a
// minimum character-class count. This is the gitleaks-style discriminator:
// repeated characters (`AAAA…`) fail entropy, and sequential alphabets
// (`abcdefghijklmnopqrstuvwxyz0123456789`) fail the class count (lowercase +
// digits only) even though their entropy looks high. Real random tokens pass
// both, so fixtures and doc examples never block an automation commit while
// genuine credentials still do.
const TOKEN_ENTROPY_FLOOR = 3.5

const CREDENTIAL_CONTENT_PATTERNS = [
  // Complete PEM blocks only (≥64 base64 chars between BEGIN/END) so test
  // fixtures and docs that merely mention the header are never flagged.
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----[A-Za-z0-9+/=\s]{64,}-----END (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY(?: BLOCK)?-----/,
  /\bAUTHORIZATION:\s*(?:bearer|basic)\s+[A-Za-z0-9+/=._~-]{16,}\b/i,
]

// Token-shaped patterns: the captured token body must clear the entropy floor
// and span at least the required character classes (uppercase, lowercase,
// digits, symbols). AWS access-key IDs are uppercase+digits by format, so they
// require fewer classes than base62 bearer tokens.
const CREDENTIAL_TOKEN_PATTERNS: Array<{
  pattern: RegExp
  minEntropy: number
  minClasses: number
}> = [
  {
    pattern: /\b(?:ghp|gho|ghu|ghs)_([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  {
    pattern: /\bgithub_pat_([A-Za-z0-9_]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  {
    pattern: /\bnpm_([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 3,
  },
  // Slack xox tokens are predominantly digits + hyphens (2 classes); a
  // 3-class floor would let every genuine token through.
  {
    pattern: /\bxox[baprs]-([A-Za-z0-9-]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // AWS access-key IDs are uppercase + digits by format (2 classes). 4.0 is
  // the theoretical entropy ceiling for 16 chars, so real keys (typically
  // ~13 distinct chars → ≈3.5–3.9) must not sit above their own ceiling.
  {
    pattern: /\bAKIA([0-9A-Z]{16})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // Legacy OpenAI keys are frequently lowercase + digits only; a 3-class
  // floor would miss them.
  {
    pattern: /\bsk-([A-Za-z0-9]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
  // Modern OpenAI keys use the `sk-proj-` prefix; the legacy pattern cannot
  // match them (the `proj` segment is only 4 chars before the hyphen).
  {
    pattern: /\bsk-proj-([A-Za-z0-9_-]{20,})\b/,
    minEntropy: TOKEN_ENTROPY_FLOOR,
    minClasses: 2,
  },
]

function shannonEntropy(value: string): number {
  if (value.length === 0) return 0
  const frequencies = new Map<string, number>()
  for (const char of value) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1)
  }
  let entropy = 0
  for (const count of frequencies.values()) {
    const probability = count / value.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy
}

function characterClasses(value: string): number {
  let classes = 0
  if (/[a-z]/.test(value)) classes += 1
  if (/[A-Z]/.test(value)) classes += 1
  if (/[0-9]/.test(value)) classes += 1
  if (/[^A-Za-z0-9]/.test(value)) classes += 1
  return classes
}

/**
 * Fail-closed scan of the staged file list + contents for credential shapes
 * before an automation-mode release commit is created and pushed to the
 * public repository. Protects the daily-push flow from publishing an
 * untracked secret (FID-2026-0808-003 audit finding F-A).
 */
export function scanStagedCredentials(
  files: readonly string[],
  root: string,
): string[] {
  const flagged: string[] = []
  for (const file of files) {
    if (CREDENTIAL_FILE_PATTERNS.some((pattern) => pattern.test(file))) {
      flagged.push(`${file} (filename matches a credential pattern)`)
      continue
    }
    const absolute = path.join(root, file)
    if (!existsSync(absolute)) {
      const stagedDeletion = run(
        'git',
        [
          'diff',
          '--cached',
          '--diff-filter=D',
          '--name-only',
          '-z',
          '--',
          file,
        ],
        root,
        true,
      )
      if (stagedDeletion.status === 0 && stagedDeletion.stdout.includes('\0'))
        continue
      throw new Error(
        `credential scan could not confirm missing path ${file} as a staged deletion`,
      )
    }
    const scanBuffer = Buffer.allocUnsafe(2 * 1024 * 1024 + 1)
    let bytesRead = 0
    let fd: number | undefined
    try {
      const byteSize = lstatSync(absolute).size
      if (byteSize > 2 * 1024 * 1024) {
        flagged.push(
          `${file} (content exceeds the 2MB credential-scan cap; refusing to scan)`,
        )
        continue
      }
      fd = openSync(absolute, 'r')
      while (bytesRead < scanBuffer.length) {
        const read = readSync(
          fd,
          scanBuffer,
          bytesRead,
          scanBuffer.length - bytesRead,
          bytesRead,
        )
        if (read === 0) break
        bytesRead += read
      }
    } catch (error) {
      throw new Error(
        `credential scan could not read ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      if (fd !== undefined) closeSync(fd)
    }
    if (bytesRead > 2 * 1024 * 1024) {
      flagged.push(
        `${file} (content exceeds the 2MB credential-scan cap; refusing to scan)`,
      )
      continue
    }
    const content = scanBuffer.subarray(0, bytesRead).toString('utf8')
    if (CREDENTIAL_CONTENT_PATTERNS.some((pattern) => pattern.test(content))) {
      flagged.push(`${file} (content matches a credential pattern)`)
      continue
    }
    for (const {
      pattern,
      minEntropy,
      minClasses,
    } of CREDENTIAL_TOKEN_PATTERNS) {
      const match = content.match(pattern)
      if (
        match &&
        shannonEntropy(match[1] ?? '') >= minEntropy &&
        characterClasses(match[1] ?? '') >= minClasses
      ) {
        flagged.push(`${file} (content matches ${pattern})`)
        break
      }
    }
  }
  return flagged
}

export function commitAllAutomationChanges(
  root: string,
  version: string,
): { headSha: string; files: string[] } {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0)
    fail('Unable to inspect files for automated release commit.')
  if (!status.stdout.trim()) fail('Automation mode found no changes to commit.')
  runRequired('git', ['add', '--all'], root)
  const staged = run(
    'git',
    ['diff', '--cached', '--name-only', '-z'],
    root,
    true,
  )
  if (staged.status !== 0)
    fail('Unable to list files for automated release commit.')
  const files = staged.stdout.split('\0').filter(Boolean)
  if (files.length === 0) fail('Automation mode found no changes to commit.')
  const flagged = scanStagedCredentials(files, root)
  if (flagged.length > 0) {
    const bounded = flagged.slice(0, 20).join('\n  - ')
    const suffix =
      flagged.length > 20 ? `\n  - (+${flagged.length - 20} more)` : ''
    fail(
      `Automation release commit refused: credential-shaped staged file(s):\n  - ${bounded}${suffix}`,
    )
  }
  console.log(`Automation release commit will include ${files.length} file(s):`)
  for (const file of files) console.log(`  - ${file}`)
  runRequired(
    'git',
    ['commit', '-m', `chore(release): prepare v${version}`],
    root,
  )
  const head = run('git', ['rev-parse', 'HEAD'], root, true)
  if (head.status !== 0) fail('Unable to resolve automated release commit.')
  return { headSha: head.stdout.trim(), files }
}

function verifyGitHubTagHead(
  root: string,
  version: string,
  expectedHead: string,
): void {
  const reference = run(
    'gh',
    [
      'api',
      `repos/${PUBLIC_REPOSITORY_SLUG}/git/ref/tags/v${version}`,
      '--jq',
      '.object.type + " " + .object.sha',
    ],
    root,
    true,
  )
  if (reference.status !== 0) {
    fail(`Unable to resolve GitHub tag v${version}.`)
  }
  const [objectType, objectSha] = reference.stdout.trim().split(/\s+/)
  if (objectType === 'commit' && objectSha === expectedHead) return
  if (objectType !== 'tag' || !objectSha) {
    fail(`GitHub tag v${version} is not bound to release HEAD.`)
  }
  const annotated = run(
    'gh',
    [
      'api',
      `repos/${PUBLIC_REPOSITORY_SLUG}/git/tags/${objectSha}`,
      '--jq',
      '.object.sha',
    ],
    root,
    true,
  )
  if (annotated.status !== 0 || annotated.stdout.trim() !== expectedHead) {
    fail(`GitHub annotated tag v${version} is not bound to release HEAD.`)
  }
}

function assertNoExistingRelease(root: string, version: string): void {
  const result = run(
    'gh',
    ['release', 'view', `v${version}`, '--repo', PUBLIC_REPOSITORY_SLUG],
    root,
    true,
  )
  if (result.status === 0) {
    fail(`GitHub release v${version} already exists; use --resume.`)
  }
  if (!isNotFoundResult(result)) {
    fail(`Unable to verify that GitHub release v${version} is absent.`)
  }
}

function assertNpmAccess(root: string, identity: string): void {
  if (!identity) fail('npm whoami returned no authenticated identity.')
  for (const target of configuredReleasePackages()) {
    const cwd = path.join(root, target.directory)
    const packageInfo = run('npm', ['view', target.name, 'name'], cwd, true)
    if (packageInfo.status !== 0 && isNotFoundResult(packageInfo)) {
      continue
    }
    if (packageInfo.status !== 0) {
      fail(`Unable to verify npm package access for ${target.name}.`)
    }

    const access = run(
      'npm',
      ['access', 'get', 'status', target.name],
      cwd,
      true,
    )
    const owners = run('npm', ['owner', 'ls', target.name], cwd, true)
    if (
      access.status !== 0 ||
      owners.status !== 0 ||
      !owners.stdout.trim() ||
      !owners.stdout.includes(identity)
    ) {
      fail(`npm publish access verification failed for ${target.name}.`)
    }
  }
}

function assertPackagesNotPublished(root: string, version: string): void {
  for (const target of configuredReleasePackages()) {
    const result = run(
      'npm',
      ['view', `${target.name}@${version}`, 'version'],
      path.join(root, target.directory),
      true,
    )
    if (result.status === 0 && result.stdout.trim() === version) {
      fail(`${target.name}@${version} already exists on npm; use --resume.`)
    }
    if (result.status !== 0 && !isNotFoundResult(result)) {
      fail(
        `Unable to verify that ${target.name}@${version} is absent from npm.`,
      )
    }
  }
}

function packageIsPublished(
  root: string,
  target: PackageTarget,
  version: string,
): boolean {
  const result = run(
    'npm',
    ['view', `${target.name}@${version}`, 'version'],
    path.join(root, target.directory),
    true,
  )
  if (result.status === 0) return result.stdout.trim() === version
  if (isNotFoundResult(result)) return false
  fail(`Unable to query npm for ${target.name}@${version}.`)
}

async function confirm(
  plan: readonly string[],
  version: string,
  resume: boolean,
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail(
      'Public release requires interactive confirmation; use --preview in CI.',
    )
  }
  console.log('\nExact public mutation targets:')
  console.log(`  repository: ${PUBLIC_REPOSITORY}`)
  console.log(`  branch: origin/main`)
  console.log(`  tag: v${version} (annotated)`)
  console.log(
    `  GitHub release: ${PUBLIC_REPOSITORY_SLUG}/releases/tag/v${version}`,
  )
  console.log(
    `  npm packages: ${configuredReleasePackages()
      .map((target) => target.name)
      .join(', ')}`,
  )
  console.log(
    `  mode: ${resume ? 'resume completed stages where safe' : 'new release'}`,
  )
  console.log('\nRelease plan:')
  for (const step of plan) console.log(`  - ${step}`)

  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await prompt.question(
      `\nPublish exactly these targets for v${version}? Type RELEASE to continue: `,
    )
    if (answer.trim() !== 'RELEASE') fail('Release cancelled.')
  } finally {
    prompt.close()
  }
}

function writeReceipt(receipt: ReleaseReceipt): void {
  const temporaryPath = `${receipt.receiptPath}.${process.pid}.tmp`
  mkdirSync(path.dirname(receipt.receiptPath), { recursive: true })
  writeFileSync(temporaryPath, redactReceipt(receipt), {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporaryPath, receipt.receiptPath)
}

function diagnosticReceiptPath(version: string): string {
  return path.join(
    os.tmpdir(),
    `savant-public-release-${version}-diagnostic.json`,
  )
}

/**
 * Repo-scoped, version-keyed lock path. Lives inside the repository's `.git`
 * directory when present (survives OS temp cleaners and cannot collide with
 * other repos); falls back to the OS temp directory otherwise.
 */
export function releaseLockPath(version: string): string {
  const repoKey = sha256Text(repositoryRoot()).slice(0, 8)
  const gitDir = path.join(repositoryRoot(), '.git')
  const base =
    existsSync(gitDir) && lstatSync(gitDir).isDirectory() ? gitDir : os.tmpdir()
  return path.join(base, `savant-release-${repoKey}-${version}.lock`)
}

export function acquireReleaseLock(version: string, mode: string): () => void {
  const lockPath = releaseLockPath(version)
  try {
    mkdirSync(lockPath)
  } catch {
    const ownerPath = path.join(lockPath, 'owner.json')
    if (!existsSync(ownerPath)) {
      fail(`Release lock is present but owner evidence is missing: ${lockPath}`)
    }
    let owner: {
      pid?: number
      host?: string
      ownerToken?: string
      startedAt?: string
      version?: string
      mode?: string
    }
    try {
      owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as typeof owner
    } catch {
      fail(`Release lock owner evidence is invalid: ${lockPath}`)
    }
    if (
      !owner.pid ||
      owner.host !== os.hostname() ||
      owner.version !== version ||
      !owner.mode ||
      !owner.ownerToken ||
      !/^\d{4}-\d{2}-\d{2}T/.test(owner.startedAt ?? '') ||
      Number.isNaN(Date.parse(owner.startedAt ?? ''))
    ) {
      fail(`Release lock owner cannot be safely classified: ${lockPath}`)
    }
    let alive = true
    try {
      process.kill(owner.pid, 0)
    } catch {
      alive = false
    }
    if (alive)
      fail(`Another ${mode} process owns the release lock: ${lockPath}`)
    const currentOwner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      ownerToken?: string
    }
    if (currentOwner.ownerToken !== owner.ownerToken) {
      fail(`Release lock owner changed during stale recovery: ${lockPath}`)
    }
    rmSync(lockPath, { recursive: true, force: true })
    try {
      mkdirSync(lockPath)
    } catch {
      fail(`Release lock recovery raced with another process: ${lockPath}`)
    }
  }
  const ownerToken = randomUUID()
  const ownerPath = path.join(lockPath, 'owner.json')
  try {
    writeFileSync(
      ownerPath,
      JSON.stringify(
        {
          pid: process.pid,
          host: os.hostname(),
          startedAt: new Date().toISOString(),
          ownerToken,
          version,
          mode,
          receiptPath: receiptPath(version),
          transcriptDirectory: transcriptDirectory(version),
        },
        null,
        2,
      ),
      { encoding: 'utf8', mode: 0o600 },
    )
    const persisted = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      ownerToken?: string
    }
    if (persisted.ownerToken !== ownerToken) {
      fail(
        `Release lock ownership was replaced during acquisition: ${lockPath}`,
      )
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('ownership was replaced')
    )
      throw error
    rmSync(lockPath, { recursive: true, force: true })
    fail(`Unable to persist release ownership lock: ${lockPath}`)
  }
  return () => {
    try {
      const owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
        ownerToken?: string
      }
      if (owner.ownerToken === ownerToken)
        rmSync(lockPath, { recursive: true, force: true })
    } catch {
      // Never remove an unreadable or replaced lock during cleanup.
    }
  }
}

const DEFAULT_ASSET_RETRY_MS = 45 * 60 * 1_000
const DEFAULT_ASSET_POLL_INTERVAL_MS = 30 * 1_000

function positiveEnvMs(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

/**
 * Bounded retry window for binary assets to appear on the release after it is
 * published. Binary builds run after publishing (workflow trigger
 * `on: release: types: [published]`), so a post-publish asset check may
 * legitimately race the build. Configurable via
 * `SAVANT_RELEASE_ASSET_TIMEOUT_MS` (milliseconds); defaults to 45 minutes.
 * No real matrix build timing exists to anchor a tighter default (the v0.0.21
 * run died in 18s at the install step).
 */
export function assetRetryTimeoutMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_ASSET_TIMEOUT_MS',
    DEFAULT_ASSET_RETRY_MS,
  )
}

/**
 * Poll interval between asset checks. Configurable via
 * `SAVANT_RELEASE_ASSET_POLL_MS` so tests can shrink the wait.
 */
export function assetPollIntervalMs(): number {
  return positiveEnvMs(
    'SAVANT_RELEASE_ASSET_POLL_MS',
    DEFAULT_ASSET_POLL_INTERVAL_MS,
  )
}

/**
 * Reads the GitHub release asset names for v{version}. Automation mode uses
 * the REST API (token); manual mode uses `gh release view --json assets`.
 * `fetchImpl` is injectable for tests (same pattern as githubApiRequest).
 */
async function fetchReleaseAssetNames(
  version: string,
  token: string | undefined,
  root: string,
  fetchImpl?: typeof fetch,
): Promise<string[]> {
  if (token) {
    const result = await githubApiRequest<{
      assets?: Array<{ name?: string }>
    }>(`/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`, {
      token,
      fetchImpl,
      expectedStatuses: [200],
    })
    return (result.body?.assets ?? [])
      .map((asset) => asset.name ?? '')
      .filter(Boolean)
  }
  const result = run(
    'gh',
    [
      'release',
      'view',
      `v${version}`,
      '--repo',
      PUBLIC_REPOSITORY_SLUG,
      '--json',
      'assets',
      '--jq',
      '.assets[].name',
    ],
    root,
    true,
  )
  if (result.status !== 0) {
    fail(`Unable to verify GitHub release assets for v${version}.`)
  }
  return result.stdout
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)
}

/**
 * Asserts the GitHub release for v{version} carries all 5 workflow-matrix
 * binary tarballs. Polls with a bounded retry window (assetRetryTimeoutMs)
 * because the binary build runs after publish; fails closed with the exact
 * remediation commands when the window expires. Prevents a repeat of v0.0.21,
 * where the pipeline reported PASS while the release had zero assets
 * (FID-2026-0809-002 Fix B).
 */
export async function verifyReleaseAssets(
  version: string,
  token: string | undefined,
  root: string,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const deadline = Date.now() + assetRetryTimeoutMs()
  let missing: string[] = [...RELEASE_BINARY_TARBALLS]
  while (Date.now() < deadline) {
    const names = await fetchReleaseAssetNames(version, token, root, fetchImpl)
    missing = RELEASE_BINARY_TARBALLS.filter(
      (tarball) => !names.includes(tarball),
    )
    if (missing.length === 0) return
    await new Promise((resolve) => setTimeout(resolve, assetPollIntervalMs()))
  }
  fail(
    `GitHub release v${version} is missing binary assets: ${missing.join(', ')} — check the Actions run for v${version}; dispatch build-release-binaries.yml with release_tag: v${version} and source_ref: <fixed commit>, then run 'bun run release:public:resume'.`,
  )
}

function verifyPublishedPackage(
  root: string,
  target: PackageTarget,
  version: string,
): void {
  if (!packageIsPublished(root, target, version)) {
    fail(`Post-release verification failed for ${target.name}@${version}.`)
  }
  const inspectionDir = path.join(
    os.tmpdir(),
    `savant-public-release-inspect-${target.name.replaceAll('/', '-')}-${version}`,
  )
  mkdirSync(inspectionDir, { recursive: true })
  try {
    const packed = run(
      'npm',
      ['pack', `${target.name}@${version}`, '--json'],
      inspectionDir,
      true,
    )
    if (packed.status !== 0) {
      fail(`Post-release package inspection failed for ${target.name}.`)
    }
    let entries: unknown
    try {
      entries = JSON.parse(packed.stdout)
    } catch {
      fail(
        `Post-release package inspection returned invalid JSON for ${target.name}.`,
      )
    }
    const artifact = Array.isArray(entries) ? entries[0] : undefined
    const files =
      artifact && typeof artifact === 'object' && 'files' in artifact
        ? artifact.files
        : undefined
    const packageVersion =
      artifact && typeof artifact === 'object' && 'version' in artifact
        ? artifact.version
        : undefined
    if (
      packageVersion !== version ||
      !Array.isArray(files) ||
      files.length === 0
    ) {
      fail(
        `Published artifact metadata/content is invalid for ${target.name}@${version}.`,
      )
    }
    const fileNames = files
      .map((file) =>
        file && typeof file === 'object' && 'path' in file ? file.path : '',
      )
      .filter((file): file is string => typeof file === 'string')
    const requiredFiles =
      target.name === '@savant-code/sdk'
        ? ['README.md', 'dist/']
        : ['README.md', 'index.js']
    for (const requiredFile of requiredFiles) {
      if (
        !fileNames.some(
          (file) => file === requiredFile || file.startsWith(requiredFile),
        )
      ) {
        fail(
          `Published artifact is missing ${requiredFile} for ${target.name}.`,
        )
      }
    }
  } finally {
    rmSync(inspectionDir, { recursive: true, force: true })
  }
}

function markStage(receipt: ReleaseReceipt, stage: string): void {
  if (!receipt.completedStages.includes(stage))
    receipt.completedStages.push(stage)
  writeReceipt(receipt)
}

export async function withLocalStateRestoration<T>(
  snapshot: LocalSnapshot,
  operation: () => T | Promise<T>,
  onRestored?: () => void,
): Promise<T> {
  try {
    return await operation()
  } finally {
    restoreLocalState(snapshot)
    onRestored?.()
  }
}

async function runReleaseTransaction(): Promise<void> {
  const args = process.argv.slice(2)
  const options: ReleaseOptions = {
    preview: args.includes('--preview'),
    resume: args.includes('--resume'),
    automation: isReleaseAutomationEnabled(),
  }
  const root = repositoryRoot()
  const version = currentVersion(root)
  const plan = buildPublicReleasePlan(version)
  const receiptMode: ReleaseReceipt['mode'] = options.automation
    ? 'automation'
    : 'publish'
  const priorReceipt = options.resume
    ? loadResumeReceipt(version, receiptMode)
    : undefined
  if (options.resume && !priorReceipt) {
    fail(`No resumable release receipt found for v${version}.`)
  }

  const receipt: ReleaseReceipt = priorReceipt ?? {
    schemaVersion: 'release-receipt/v2',
    version,
    mode: options.preview
      ? 'preview'
      : options.automation
        ? 'automation'
        : 'publish',
    completedStages: [],
    restored: false,
    receiptPath: receiptPath(version),
    repositoryKey: sha256Text(repositoryRoot()).slice(0, 8),
    gateAttempts: [],
    evidenceFinalized: false,
  }
  receipt.schemaVersion = 'release-receipt/v2'
  receipt.gateAttempts ??= []
  receipt.restored = false

  console.log(`Savant public release v${version}`)
  console.log(
    options.preview
      ? 'Preview mode: no mutation will occur.'
      : options.automation
        ? 'Automation mode: token-native, noninteractive release.'
        : options.resume
          ? 'Resume mode: only incomplete stages may run.'
          : 'Preflight mode.',
  )

  const commandWarnings = [
    options.automation || options.preview
      ? undefined
      : requireCommand('gh', true),
    requireCommand('npm', !options.preview),
  ].filter((warning): warning is string => Boolean(warning))
  const githubToken =
    options.automation && !options.preview ? getGitHubToken() : ''
  if (options.automation && !options.preview) {
    await assertGitHubToken(githubToken)
  }
  let preflight = verifyPreflight(
    root,
    version,
    !options.preview,
    options.resume ||
      isStageComplete(receipt, 'TAG') ||
      isStageComplete(receipt, 'GIT_PUSH'),
    options.automation,
  )
  if (receipt.headSha && receipt.headSha !== preflight.headSha) {
    if (
      options.automation &&
      !isStageComplete(receipt, 'AUTOMATION_COMMIT_ALL')
    ) {
      const recovered = recoverAutomationCommit(root, receipt.headSha, version)
      if (recovered) {
        receipt.committedHead = recovered.headSha
        receipt.committedFiles = recovered.files
        preflight = verifyPreflight(root, version, true, true, true)
        receipt.headSha = preflight.headSha
        markStage(receipt, 'AUTOMATION_COMMIT_ALL')
      } else {
        fail(
          `Release HEAD changed from ${receipt.headSha} to ${preflight.headSha}; refusing to resume.`,
        )
      }
    } else {
      fail(
        `Release HEAD changed from ${receipt.headSha} to ${preflight.headSha}; refusing to resume.`,
      )
    }
  }
  receipt.headSha = preflight.headSha
  const warnings = [...commandWarnings, ...preflight.warnings]

  if (options.preview) {
    if (warnings.length) {
      console.log('\nPreview warnings:')
      for (const warning of warnings) console.log(`  - ${warning}`)
    }
    console.log('\nPreview plan:')
    for (const step of plan) console.log(`  - ${step}`)
    console.log(`\nChangelog section ready: ${preflight.notes.split('\n')[0]}`)
    console.log(
      `\nBinary assets to verify post-publish: ${RELEASE_BINARY_TARBALLS.join(', ')}`,
    )
    return
  }

  const ghAuth = options.automation
    ? undefined
    : run('gh', ['auth', 'status'], root, true)
  if (!options.automation && ghAuth?.status !== 0) {
    fail('gh auth status failed.')
  }
  const npmAuth = run('npm', ['whoami'], root, true)
  if (npmAuth.status !== 0) fail('npm whoami failed.')
  markStage(receipt, 'AUTHENTICATION')

  const snapshot = snapshotLocalState()

  if (!options.resume) {
    if (options.automation)
      await assertNoExistingReleaseApi(version, githubToken)
    else assertNoExistingRelease(root, version)
    assertPackagesNotPublished(root, version)
  }
  assertNpmAccess(root, npmAuth.stdout.trim())

  try {
    await withLocalStateRestoration(
      snapshot,
      async () => {
        if (
          options.automation &&
          !isStageComplete(receipt, 'AUTOMATION_COMMIT_ALL')
        ) {
          const committed = commitAllAutomationChanges(root, version)
          receipt.committedHead = committed.headSha
          receipt.committedFiles = committed.files
          preflight = verifyPreflight(root, version, true, true, true)
          receipt.headSha = preflight.headSha
          markStage(receipt, 'AUTOMATION_COMMIT_ALL')
        }
        markStage(receipt, 'PREFLIGHT')

        if (options.automation) {
          markStage(receipt, 'AUTOMATION_APPROVAL')
        } else if (!isStageComplete(receipt, 'CONFIRMATION')) {
          await confirm(plan, version, options.resume)
          markStage(receipt, 'CONFIRMATION')
        }

        if (!options.resume) {
          assertNoUnrestoredPriorRelease(
            snapshot.settingsContent,
            os.tmpdir(),
            sha256Text(repositoryRoot()).slice(0, 8),
          )
        }
        applyPublicProfile(snapshot)
        markStage(receipt, 'PUBLIC_PROFILE')

        if (!isStageComplete(receipt, 'GATES_AND_PACKAGE_DRY_RUNS')) {
          const beforeFingerprint = fingerprintWorktree(root)
          const beforeIgnored = ignoredPathList(root)
          const bunVersion = run('bun', ['--version'], root, true)
          const npmVersion = run('npm', ['--version'], root, true)
          if (
            classifyCommandResult(bunVersion) !== 'success' ||
            classifyCommandResult(npmVersion) !== 'success'
          ) {
            fail('Unable to resolve Bun/npm versions for release gates.')
          }
          validateToolVersions(
            bunVersion.stdout.trim(),
            npmVersion.stdout.trim(),
          )
          const manifest = buildGateManifest(
            root,
            version,
            bunVersion.stdout.trim(),
            npmVersion.stdout.trim(),
            receipt.headSha,
          )
          receipt.gateManifestHash = manifest.hash
          receipt.evidenceHeadSha = receipt.headSha
          receipt.evidenceFinalized = false
          receipt.gateAttempts = receipt.gateAttempts ?? []
          for (const spec of manifest.specs) {
            const attempt = executeGate(
              spec,
              version,
              receipt.gateAttempts.filter((entry) => entry.label === spec.label)
                .length + 1,
            )
            receipt.gateAttempts.push(attempt)
            writeReceipt(receipt)
            if (
              attempt.failureClass !== 'success' ||
              !attempt.transcriptFinalized
            ) {
              receipt.failedStage = `Gate ${spec.label} failed (${attempt.failureClass}); transcript: ${attempt.transcriptPath ?? 'unavailable'}`
              writeReceipt(receipt)
              fail(receipt.failedStage)
            }
          }
          const afterFingerprint = fingerprintWorktree(root)
          receipt.ignoredChanges = ignoredPathDelta(
            beforeIgnored,
            ignoredPathList(root),
          )
          if (beforeFingerprint.hash !== afterFingerprint.hash) {
            const changed = changedWorktreePaths(
              beforeFingerprint,
              afterFingerprint,
            )
            const bounded = changed.slice(0, 50)
            const suffix =
              changed.length > bounded.length
                ? ` (+${changed.length - bounded.length} more)`
                : ''
            fail(
              `Release gates changed the tracked worktree (${changed.length} path(s): ${bounded.join(', ')}${suffix}); refusing to continue.`,
            )
          }
          receipt.evidenceFinalized = true
          markStage(receipt, 'GATES_AND_PACKAGE_DRY_RUNS')
        }

        if (!isStageComplete(receipt, 'GIT_PUSH')) {
          if (!isStageComplete(receipt, 'TAG')) {
            runRequired(
              'git',
              ['tag', '-a', `v${version}`, '-m', `Release v${version}`],
              root,
            )
            markStage(receipt, 'TAG')
          }
          runRequired(
            'git',
            ['push', 'origin', 'main', `v${version}`],
            root,
            options.automation
              ? buildTokenSafeGitPushEnv(githubToken)
              : undefined,
          )
          markStage(receipt, 'GIT_PUSH')
        }

        if (!isStageComplete(receipt, 'GITHUB_RELEASE')) {
          if (options.automation) {
            const existingRelease = await githubApiRequest(
              `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
              { token: githubToken, expectedStatuses: [200, 404] },
            )
            if (existingRelease.status === 200) {
              await verifyGitHubTagHeadApi(
                version,
                preflight.headSha,
                githubToken,
              )
            } else {
              await createGitHubReleaseApi(
                version,
                preflight.notes,
                githubToken,
              )
            }
            markStage(receipt, 'GITHUB_RELEASE')
          } else {
            const existingRelease = run(
              'gh',
              [
                'release',
                'view',
                `v${version}`,
                '--repo',
                PUBLIC_REPOSITORY_SLUG,
              ],
              root,
              true,
            )
            if (existingRelease.status === 0) {
              verifyGitHubTagHead(root, version, preflight.headSha)
              markStage(receipt, 'GITHUB_RELEASE')
            } else {
              if (!isNotFoundResult(existingRelease)) {
                fail(
                  `Unable to verify that GitHub release v${version} is absent.`,
                )
              }
              const notesPath = path.join(
                os.tmpdir(),
                `savant-release-notes-${version}.md`,
              )
              writeFileSync(notesPath, preflight.notes)
              try {
                runRequired(
                  'gh',
                  [
                    'release',
                    'create',
                    `v${version}`,
                    '--repo',
                    PUBLIC_REPOSITORY_SLUG,
                    '--title',
                    `v${version}`,
                    '--notes-file',
                    notesPath,
                  ],
                  root,
                )
              } finally {
                rmSync(notesPath, { force: true })
              }
              markStage(receipt, 'GITHUB_RELEASE')
            }
          }
        }

        for (const target of configuredReleasePackages()) {
          if (isStageComplete(receipt, target.stage)) continue
          if (options.resume && packageIsPublished(root, target, version)) {
            markStage(receipt, target.stage)
            continue
          }
          runRequired(
            'npm',
            ['publish', '--access', 'public'],
            path.join(root, target.directory),
          )
          markStage(receipt, target.stage)
        }

        if (options.automation) {
          const verifiedRelease = await githubApiRequest(
            `/repos/${PUBLIC_REPOSITORY_SLUG}/releases/tags/v${version}`,
            { token: githubToken, expectedStatuses: [200] },
          )
          if (verifiedRelease.status !== 200) {
            fail(
              `Post-release verification failed for GitHub release v${version}.`,
            )
          }
          await verifyGitHubTagHeadApi(version, preflight.headSha, githubToken)
        } else {
          const verifiedRelease = run(
            'gh',
            [
              'release',
              'view',
              `v${version}`,
              '--repo',
              PUBLIC_REPOSITORY_SLUG,
            ],
            root,
            true,
          )
          if (verifiedRelease.status !== 0) {
            fail(
              `Post-release verification failed for GitHub release v${version}.`,
            )
          }
          verifyGitHubTagHead(root, version, preflight.headSha)
        }
        const taggedHead = run(
          'git',
          ['rev-list', '-1', `v${version}`],
          root,
          true,
        )
        if (
          taggedHead.status !== 0 ||
          taggedHead.stdout.trim() !== preflight.headSha
        ) {
          fail(`Post-release tag v${version} does not point at release HEAD.`)
        }
        // A release is only real when its downloadable binaries exist. Verify
        // the workflow-matrix tarballs are on the GitHub release (fail-closed
        // with retry; v0.0.21 shipped zero assets and the old pipeline still
        // reported PASS — FID-2026-0809-002 Fix B).
        await verifyReleaseAssets(
          version,
          options.automation ? githubToken : undefined,
          root,
        )
        for (const target of configuredReleasePackages()) {
          verifyPublishedPackage(root, target, version)
        }
        // A resumed release may carry a historical failedStage from an earlier
        // attempt (for example, transient npm registry propagation). Clear it
        // before markStage writes the terminal receipt so a crash between those
        // operations cannot leave contradictory success/failure evidence.
        finalizeSuccessfulReleaseReceipt(receipt)
        markStage(receipt, 'POST_RELEASE_VERIFY')
      },
      () => {
        receipt.restored = true
      },
    )
  } catch (error) {
    receipt.failedStage = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    writeReceipt(receipt)
  }
}

export type WorktreeFingerprint = {
  hash: string
  trackedDetails: Record<string, string>
  status: string
}

export function fingerprintWorktree(root: string): WorktreeFingerprint {
  const status = run(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0)
    fail('Unable to fingerprint the diagnostic worktree.')
  const tracked = run('git', ['ls-files', '-z'], root, true)
  if (tracked.status !== 0)
    fail('Unable to enumerate tracked diagnostic files.')
  const trackedDetails: Record<string, string> = {}
  for (const file of tracked.stdout.split('\0').filter(Boolean).sort()) {
    const absolute = path.join(root, file)
    if (!existsSync(absolute)) {
      trackedDetails[file] = 'missing'
      continue
    }
    const stat = lstatSync(absolute)
    if (stat.isSymbolicLink()) {
      trackedDetails[file] = `symlink:${readlinkSync(absolute)}`
      continue
    }
    trackedDetails[file] = createHash('sha256')
      .update(readFileSync(absolute))
      .digest('hex')
  }
  return {
    hash: sha256Text(
      JSON.stringify({ status: status.stdout, tracked: trackedDetails }),
    ),
    trackedDetails,
    status: status.stdout,
  }
}

export function changedWorktreePaths(
  before: WorktreeFingerprint,
  after: WorktreeFingerprint,
): string[] {
  const paths = new Set<string>([
    ...Object.keys(before.trackedDetails),
    ...Object.keys(after.trackedDetails),
  ])
  const changedTracked = [...paths].filter(
    (file) => before.trackedDetails[file] !== after.trackedDetails[file],
  )
  const beforeStatus = new Set(before.status.split('\n').filter(Boolean))
  const afterStatus = new Set(after.status.split('\n').filter(Boolean))
  const changedStatus = [...afterStatus]
    .filter((line) => !beforeStatus.has(line))
    .concat([...beforeStatus].filter((line) => !afterStatus.has(line)))
    .map((line) => line.slice(3))
  return [...new Set([...changedTracked, ...changedStatus])].sort()
}

export function ignoredPathDelta(
  before: string,
  after: string,
): { added: string[]; removed: string[] } {
  const beforeSet = new Set(before.split('\n').filter(Boolean))
  const afterSet = new Set(after.split('\n').filter(Boolean))
  return {
    added: [...afterSet].filter((path) => !beforeSet.has(path)).sort(),
    removed: [...beforeSet].filter((path) => !afterSet.has(path)).sort(),
  }
}

function ignoredPathList(root: string): string {
  const status = run(
    'git',
    ['status', '--porcelain', '--ignored=matching', '--untracked-files=all'],
    root,
    true,
  )
  if (status.status !== 0) fail('Unable to enumerate ignored diagnostic paths.')
  return status.stdout
    .split('\n')
    .filter((line) => line.startsWith('!!'))
    .sort()
    .join('\n')
}

export function buildDiagnosticReceipt(
  version: string,
  evidence: ReturnType<typeof runReadOnlyGateManifest> | undefined,
  failure: string | undefined,
  ignoredChanges: { added: string[]; removed: string[] } | undefined,
): ReleaseReceipt {
  return {
    schemaVersion: 'release-receipt/v2',
    version,
    mode: 'preview',
    completedStages:
      !failure && evidence?.passed ? ['GATES_AND_PACKAGE_DRY_RUNS'] : [],
    failedStage:
      failure ??
      (evidence?.passed
        ? undefined
        : `Gate ${evidence?.attempts.at(-1)?.label ?? 'unknown stage'} failed`),
    restored: true,
    receiptPath: diagnosticReceiptPath(version),
    repositoryKey: sha256Text(repositoryRoot()).slice(0, 8),
    evidenceHeadSha: evidence?.headSha,
    gateManifestHash: evidence?.manifestHash,
    gateAttempts: evidence?.attempts ?? [],
    ignoredChanges,
    evidenceFinalized:
      !failure &&
      Boolean(
        evidence?.attempts.length &&
        evidence.attempts.every((attempt) => attempt.transcriptFinalized),
      ),
  }
}

async function runDiagnostic(): Promise<void> {
  const root = repositoryRoot()
  ensurePinnedBunOnPath(root)
  const version = currentVersion(root)
  const releaseLock = acquireReleaseLock(version, 'diagnostic')
  let evidence: ReturnType<typeof runReadOnlyGateManifest> | undefined
  let failure: string | undefined
  let ignoredChanges: { added: string[]; removed: string[] } | undefined
  try {
    const beforeHead = run('git', ['rev-parse', 'HEAD'], root, true)
    const beforeFingerprint = fingerprintWorktree(root)
    const beforeIgnored = ignoredPathList(root)
    evidence = runReadOnlyGateManifest(root, version)
    const afterHead = run('git', ['rev-parse', 'HEAD'], root, true)
    const afterFingerprint = fingerprintWorktree(root)
    ignoredChanges = ignoredPathDelta(beforeIgnored, ignoredPathList(root))
    if (
      beforeHead.status !== 0 ||
      afterHead.status !== 0 ||
      beforeHead.stdout.trim() !== afterHead.stdout.trim()
    ) {
      fail('Diagnostic gates changed HEAD; no release evidence was accepted.')
    }
    if (beforeFingerprint.hash !== afterFingerprint.hash) {
      const changed = changedWorktreePaths(beforeFingerprint, afterFingerprint)
      const bounded = changed.slice(0, 50)
      const suffix =
        changed.length > bounded.length
          ? ` (+${changed.length - bounded.length} more)`
          : ''
      fail(
        `Diagnostic gates changed the tracked worktree (${changed.length} path(s): ${bounded.join(', ')}${suffix}); no release evidence was accepted.`,
      )
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : 'diagnostic-failed'
  } finally {
    releaseLock()
  }
  const receipt = buildDiagnosticReceipt(
    version,
    evidence,
    failure,
    ignoredChanges,
  )
  try {
    writeReceipt(receipt)
  } catch {
    console.error(
      'Diagnostic evidence persistence failed; no resumable evidence was written.',
    )
    process.exitCode = 1
    return
  }
  if (failure || !evidence?.passed) {
    console.error(`Diagnostic gates failed. Evidence: ${receipt.receiptPath}`)
    process.exitCode = 1
    return
  }
  console.log(`Diagnostic gates passed. Evidence: ${receipt.receiptPath}`)
}

async function main(): Promise<void> {
  const root = repositoryRoot()
  ensurePinnedBunOnPath(root)
  const version = currentVersion(root)
  const mode = process.argv.includes('--resume') ? 'resume' : 'release'
  const releaseLock = acquireReleaseLock(version, mode)
  try {
    await runReleaseTransaction()
  } finally {
    releaseLock()
  }
}

if (import.meta.main) {
  const isDiagnostic = process.argv.includes('--diagnose')
  ;(isDiagnostic ? runDiagnostic() : main()).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
