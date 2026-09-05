// FID-2026-0905-007 — public-release decomposition: gates.
//
// Gate-manifest construction, sanitized gate environment, redacted transcript
// persistence, gate execution, and the read-only diagnostic gate run.
// Verbatim moves from scripts/public-release.ts.

import { createHash } from 'crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

import { repositoryValidationGates } from '../validation-manifest.js'
import { configuredReleasePackages } from './catalog'
import { classifyCommandResult, run } from './command-runner'
import { fail, PROFILE_ENV, readJsonObject } from './fail'
import { validateToolVersions } from './pinned-bun'
import { canonicalize, redactSecretText, sha256Text } from './redaction'

import type { GateAttempt, GateSpec } from './catalog'

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

export function transcriptDirectory(version: string): string {
  const directory = path.join(
    os.tmpdir(),
    `savant-public-release-${version}-evidence`,
  )
  mkdirSync(directory, { recursive: true })
  return directory
}

export function writeRedactedTranscript(
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

export function boundedSummary(output: string): string {
  const normalized = redactSecretText(output).trim()
  if (normalized.length <= 2_000) return normalized
  return `${normalized.slice(0, 900)}\\n…[output elided; transcript contains complete evidence]…\\n${normalized.slice(-900)}`
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

export function executeGate(
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

// Keep readJsonObject referenced via the fail module surface (it re-exports
// the shared primitive); direct use lives in local-state.
void readJsonObject
