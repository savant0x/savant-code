#!/usr/bin/env bun

import fs from 'node:fs'
import path from 'node:path'

import { collectScopeDispositionIssues } from '@savant-code/agent-runtime/echo/scope-disposition-guard'
import { collectRegisterCompletenessIssues } from '@savant-code/agent-runtime/echo/scope-register-completeness'
import {
  PROVIDER_EXCEPTION_MANIFEST,
  validateProviderAudit,
  validateProviderUrlOwnership,
} from '@savant-code/common/providers/audit'
import { PROVIDER_REGISTRY } from '@savant-code/common/providers/registry'

import { auditExitCodeMasking } from './audit-exit-codes.js'
import { auditGateEnvParity } from './audit-gate-env-parity.js'
import { validateFidVerificationGates } from './fid-gates.js'
import { validateActiveFidLedger } from './fid-ledger.js'
import { collectHygieneIssues } from './hygiene.js'
import {
  validateEmbeddedLearningSource,
  validateLearningFile,
} from './learnings-core.js'
import { collectQualityIssues, readQualityBaseline } from './quality-report.js'
import {
  formatValidationIssues,
  repositoryValidationGates,
  validateCommandParity,
  validateGateContract,
  validateMetadata,
  VALIDATION_WORKSPACE_POLICY,
} from './validation-manifest.js'
import {
  readConfiguredProjectVersion,
  readProductVersion,
  SYNCHRONIZED_PACKAGE_PATHS,
} from './version.js'

import type {
  CommandParityInput,
  MetadataValidationInput,
} from './validation-manifest.js'

type JsonObject = Record<string, unknown>

const root = path.resolve(import.meta.dir, '..')

function validateLearningsContent(): { code: string; message: string }[] {
  const result = validateLearningFile(root)
  const sourcePath = path.join(root, 'docs', 'embedded-learnings.md')
  const sourceIssues = fs.existsSync(sourcePath)
    ? validateEmbeddedLearningSource(
        'docs/embedded-learnings.md',
        fs.readFileSync(sourcePath, 'utf8'),
      )
    : [
        {
          code: 'learning.embedded.missing',
          message: 'docs/embedded-learnings.md is missing.',
        },
      ]
  return [...result.issues, ...sourceIssues].map((issue) => ({
    code: issue.code,
    message: issue.message,
  }))
}

function validateCurrentHygiene(): { code: string; message: string }[] {
  return collectHygieneIssues().map((issue) => ({
    code: `hygiene.${issue.code}`,
    message: `${issue.file}: ${issue.message}`,
  }))
}

// FID-2026-0813-023: fail-closed, absence-shaped scan for the un-expanded
// rebrand marker. The rebrand commit (da18963) left the literal identifier
// `savantCode$1` repo-wide; it compiles silently, so the only durable defense
// is a validation gate that fails when the marker reappears in source.
const REBRAND_CORRUPTION_MARKER = 'savantCode$1'
const REBRAND_SOURCE_DIRS = [
  'sdk/src',
  'cli/src',
  'common/src',
  'packages',
  'agents',
]

function collectRebrandHits(dir: string, hits: string[]): void {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectRebrandHits(full, hits)
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      if (fs.readFileSync(full, 'utf8').includes(REBRAND_CORRUPTION_MARKER)) {
        hits.push(path.relative(root, full))
      }
    }
  }
}

function validateRebrandCorruption(): { code: string; message: string }[] {
  const hits: string[] = []
  for (const dir of REBRAND_SOURCE_DIRS) {
    collectRebrandHits(path.join(root, dir), hits)
  }
  if (hits.length === 0) return []
  return [
    {
      code: 'rebrand.corruption',
      message: `Un-expanded rebrand marker \`${REBRAND_CORRUPTION_MARKER}\` found at ${hits.length} source location(s): ${hits.join(', ')}`,
    },
  ]
}

function readJson(relativePath: string): JsonObject {
  return JSON.parse(
    fs.readFileSync(path.join(root, relativePath), 'utf8'),
  ) as JsonObject
}

function readYamlScalar(
  relativePath: string,
  pattern: RegExp,
): string | undefined {
  const content = fs
    .readFileSync(path.join(root, relativePath), 'utf8')
    .replace(/\r\n/g, '\n')
  return content.match(pattern)?.[1]
}

function workspaceEntry(
  workspace: string,
): CommandParityInput['workspaces'][number] {
  const packageJson = readJson(`${workspace}/package.json`)
  const scripts = (packageJson.scripts ?? {}) as Record<string, unknown>
  const typecheckScript =
    typeof scripts.typecheck === 'string' ? scripts.typecheck : undefined
  const testScript =
    typeof scripts.test === 'string'
      ? scripts.test
      : typeof scripts['test:v2'] === 'string'
        ? scripts['test:v2']
        : undefined
  const token = `--cwd=${workspace}`
  return {
    workspace,
    typecheckScript,
    testScript,
    rootTypecheckToken: token,
    rootTestToken: token,
    protocolTypecheckToken: token,
    protocolTestToken: token,
    // E2E-only/private utility workspaces are governed by explicit policy;
    // only conventional typecheck/test (or evals' test:v2) participates in
    // deterministic root parity.
  }
}

function collectMetadata(): MetadataValidationInput {
  const rootPackage = readJson('package.json')
  const rootEngine = (
    rootPackage.engines as Record<string, unknown> | undefined
  )?.bun
  return {
    productVersion: readProductVersion(root),
    synchronizedPackageVersions: Object.fromEntries(
      SYNCHRONIZED_PACKAGE_PATHS.map((filePath) => [
        filePath,
        readJson(filePath).version as string | undefined,
      ]),
    ),
    configuredProjectVersion: readConfiguredProjectVersion(root),
    harnessProtocolVersion: readYamlScalar(
      'protocol.config.yaml',
      /^protocol:\n\s+version:\s*["']?([^"'\s]+)["']?/m,
    ),
    singleAgentProtocolVersion: readYamlScalar(
      'protocol.config.yaml',
      /^single_agent:\n\s+protocol:\n\s+version:\s*["']?([^"'\s]+)["']?/m,
    ),
    bunFileVersion: fs.readFileSync(path.join(root, '.bun-version'), 'utf8'),
    packageManagerBunVersion:
      typeof rootPackage.packageManager === 'string'
        ? rootPackage.packageManager.replace(/^bun@/, '')
        : undefined,
    engineBunVersion: typeof rootEngine === 'string' ? rootEngine : undefined,
  }
}

function collectParity(): CommandParityInput {
  const rootPackage = readJson('package.json')
  const protocolTypecheckCommand = readYamlScalar(
    'protocol.config.yaml',
    /^  type_check:\s*["']([^"']+)["']/m,
  )
  const protocolTestCommand = readYamlScalar(
    'protocol.config.yaml',
    /^  test:\s*["']([^"']+)["']/m,
  )
  const workspaces = (rootPackage.workspaces as string[]).map(workspaceEntry)
  return {
    rootTypecheckCommand: (rootPackage.scripts as Record<string, unknown>)
      .typecheck as string | undefined,
    rootTestCommand: (rootPackage.scripts as Record<string, unknown>).test as
      string | undefined,
    protocolTypecheckCommand,
    protocolTestCommand,
    workspaces,
    workspacePolicy: VALIDATION_WORKSPACE_POLICY,
  }
}
const providerAuditIssues = [
  ...validateProviderAudit(PROVIDER_REGISTRY, PROVIDER_EXCEPTION_MANIFEST, {
    evidenceExists: (relativePath) =>
      fs.existsSync(path.join(root, relativePath)),
  }),
  ...validateProviderUrlOwnership(PROVIDER_REGISTRY),
].map((message) => ({
  code: 'provider.audit',
  message,
}))

// FID-2026-0907-002: refuse the exit-code-masking pattern (pipe into
// tail/head/tee then `echo $?`) in tracked scripts, git hooks, and
// workflow YAML — the v0.0.22 crashed-eslint-shipped-green incident class.
const exitCodeMaskingIssues = auditExitCodeMasking(root).map((issue) => ({
  code: 'audit.exit-code-masking',
  message: `${issue.file}:${issue.line}: ${issue.message}`,
}))

// FID-2026-0909-002: refuse the two mechanically-expressible release-gate
// environment-parity defect classes (bare runtime-name spawns; Bun-only
// import.meta properties in common/src production) — the v0.0.30 incident
// class that shipped green through every local gate.
/**
 * FID-2026-0919-024: no agent-side scope trimming. Fails the repository gate on
 * any prohibited disposition token (`[OUT-OF-SCOPE]`, `[OPEN-OUT-OF-SCOPE]`,
 * `[DEFERRED]`, or an unapproved `deferred::`/`skipped::`/`dropped::` marker) in
 * a scope surface — the live register, an active FID, the agenda, a session
 * summary or a current-release CHANGELOG entry.
 */
function validateScopeDispositions(): { code: string; message: string }[] {
  return collectScopeDispositionIssues(root).map((issue) => ({
    code: 'scope.prohibited-disposition',
    message: `${issue.file}:${issue.line}: ${issue.message}`,
  }))
}

/**
 * FID-2026-0919-025: a register line for every tracked item. Fails the
 * repository gate on an active FID `SCOPE.md` never names, or on a task cited
 * by an active FID or a current session summary that has no `## Task NN`
 * heading or `TNN-X` item in the register — the quiet half of the scope trim.
 */
function validateRegisterCompleteness(): { code: string; message: string }[] {
  return collectRegisterCompletenessIssues(root).map((issue) => ({
    code: 'scope.unregistered-item',
    message: `${issue.file}:${issue.line}: ${issue.message}`,
  }))
}

const gateEnvParityIssues = auditGateEnvParity(root).map((issue) => ({
  code: 'audit.gate-env-parity',
  message: `${issue.file}:${issue.line}: ${issue.message}`,
}))

const issues = [
  ...validateMetadata(collectMetadata()),
  ...validateCommandParity(collectParity()),
  ...validateGateContract(repositoryValidationGates(root), root),
  ...validateActiveFidLedger(root),
  ...validateFidVerificationGates(root),
  ...validateLearningsContent(),
  // SAVANT_CODE_SKIP_QUALITY_RATCHET: temporarily exempt ratchet for releases
  // (operator-paused FID-2026-0819-005)
  ...(process.env.SAVANT_CODE_SKIP_QUALITY_RATCHET === '1'
    ? []
    : collectQualityIssues(readQualityBaseline()).map((issue) => ({
        code: 'quality.ratchet',
        message: `${issue.file}: ${issue.message}`,
      }))),
  ...providerAuditIssues,
  ...exitCodeMaskingIssues,
  ...gateEnvParityIssues,
  ...validateCurrentHygiene(),
  ...validateRebrandCorruption(),
  ...validateScopeDispositions(),
  ...validateRegisterCompleteness(),
]

process.stdout.write(`${formatValidationIssues(issues)}\n`)
if (issues.length > 0) process.exitCode = 1
