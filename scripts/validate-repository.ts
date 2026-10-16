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

import { collectAttributionIssues } from './attribution-guard'
import { auditBunfigTestTimeout } from './audit-bunfig-test-timeout.js'
import { auditEslintDisableRationale } from './audit-eslint-disable-rationale.js'
import { auditExitCodeMasking } from './audit-exit-codes.js'
import { auditGateEnvParity } from './audit-gate-env-parity.js'
import { collectMutatingMatcherIssues } from './audit-mutating-matchers.js'
import { auditRebrandCorruption } from './audit-rebrand-corruption.js'
import { collectTestBudgetIssues } from './audit-test-budget-injection.js'
import { auditVendoredTrees } from './audit-vendored-tree.js'
import { collectChangelogCoverageIssues } from './changelog-coverage.js'
import {
  validateArchivedFidClosures,
  validateFidVerificationGates,
} from './fid-gates.js'
import { validateActiveFidLedger } from './fid-ledger.js'
import { collectRecordCoverageIssues } from './fid-surface-coverage.js'
import { collectGateDeclarabilityIssues } from './gate-declarability.js'
import { collectHygieneIssues } from './hygiene.js'
import { collectInternalFollowupIssues } from './internal-followup-check.js'
import { validateLearningArtifacts } from './learnings-artifact-check.js'
import { collectFeaturePipelineIssues } from './lesson-feature-check.js'
import { collectQualityIssues, readQualityBaseline } from './quality-report.js'
import { collectTaskIdLedgerIssues } from './task-id-ledger'
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

import type { FidLedgerIssue } from './fid-ledger-types.js'
import type {
  CommandParityInput,
  MetadataValidationInput,
} from './validation-manifest.js'

type JsonObject = Record<string, unknown>

const root = path.resolve(import.meta.dir, '..')

function validateCurrentHygiene(): { code: string; message: string }[] {
  return collectHygieneIssues().map((issue) => ({
    code: `hygiene.${issue.code}`,
    message: `${issue.file}: ${issue.message}`,
  }))
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

/**
 * FID-2026-1013-012 W3-1: every tracked non-test `eslint-disable` directive
 * carries a `-- <rationale>` (the rationale-comment rule). A suppression with
 * no stated reason is an unauditable hole in ECHO Law 6, and review convention
 * alone did not hold the line — 15 production directives had none. The
 * standalone `scripts/audit-eslint-disable-rationale.ts` probe is the
 * declarable form (`- gate: probe scripts/audit-eslint-disable-rationale.ts`).
 */
const eslintDisableRationaleIssues = auditEslintDisableRationale(root).map(
  (issue) => ({
    code: 'lint.eslint-disable-rationale',
    message: `${issue.file}:${issue.line}: ${issue.message}`,
  }),
)

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
 * FID-2026-0919-025: fail on an active FID `SCOPE.md` never names, or a task cited
 * by an active FID or agenda without a `## Task NN`
 * heading or `TNN-X` item in the register. */
function validateRegisterCompleteness(): { code: string; message: string }[] {
  return collectRegisterCompletenessIssues(root).map((issue) => ({
    code: 'scope.unregistered-item',
    message: `${issue.file}:${issue.line}: ${issue.message}`,
  }))
}

/**
 * An archived FID whose id appears nowhere in CHANGELOG.md is invisible to
 * anyone reading release notes. The gate is notation-aware (ranges, `/NNN`
 * siblings, and `NNN/-004/-005` compounds all count) and ratcheted against
 * `dev/changelog-coverage-baseline.json`, so it fails on new gaps only.
 */
const changelogCoverageIssues = collectChangelogCoverageIssues(root).map(
  (issue) => ({ code: issue.code, message: issue.message }),
)
// FID-2026-0909-002: refuse the two release-gate env-parity defect classes (./audit-gate-env-parity).
const gateEnvParityIssues = auditGateEnvParity(root).map((issue) => ({
  code: 'audit.gate-env-parity',
  message: `${issue.file}:${issue.line}: ${issue.message}`,
}))
// FID-2026-0927-002: two controls that LOOK load-bearing and are not.
//   F1b — a top-level tree with no tracked files and no ignore rule sits inside
//         the release automation's `git add --all` blast radius, and the
//         never-committed disclosure (git-publish.ts:104-111) only warns.
//   F2  — `cli/bunfig.toml`'s `[test] timeout` is not read by bun 1.3.14, so a
//         budget added there looks like it hardens the suite and changes
//         nothing. Both mutation-proven before being trusted.
const vendoredTreeIssues = auditVendoredTrees(root)
const bunfigTimeoutIssues = auditBunfigTestTimeout(root)

const issues: FidLedgerIssue[] = [
  ...validateMetadata(collectMetadata()),
  ...validateCommandParity(collectParity()),
  ...validateGateContract(repositoryValidationGates(root), root),
  // Keep every enforced gate recordable by fid:verify (./gate-declarability).
  ...collectGateDeclarabilityIssues(root),
  ...validateActiveFidLedger(root),
  ...validateFidVerificationGates(root),
  ...validateArchivedFidClosures(root),
  ...validateLearningArtifacts(root).issues,
  ...collectFeaturePipelineIssues(root),
  ...collectInternalFollowupIssues(root),
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
  ...eslintDisableRationaleIssues,
  ...collectMutatingMatcherIssues(root),
  ...gateEnvParityIssues,
  ...validateCurrentHygiene(),
  ...auditRebrandCorruption(root),
  ...validateScopeDispositions(),
  ...collectRecordCoverageIssues(root), // FID-2026-1012-027: gate/surface coverage
  ...validateRegisterCompleteness(),
  ...collectTaskIdLedgerIssues(root),
  ...changelogCoverageIssues,
  ...vendoredTreeIssues,
  ...bunfigTimeoutIssues,
  // FID-2026-1006-004 pin-hardening: helpers inject budgets (./audit-test-budget-injection).
  ...collectTestBudgetIssues(root),
  ...collectAttributionIssues(), // FID-2026-1014-003: no agent attribution, ever
]

// FID-2026-0927-003 F3: `severity: 'warning'` findings are REPORTED but do
// not fail the gate. Only the FID receipt-staleness demotion produces them,
// and only when the C3 live re-run already proved every declared gate green —
// so this weakens a tripwire over a property that is independently enforced,
// not the enforcement itself. Every other issue still fails as before.
const warnings = issues.filter((issue) => issue.severity === 'warning')
const failures = issues.filter((issue) => issue.severity !== 'warning')
process.stdout.write(`${formatValidationIssues(failures)}\n`)
for (const warning of warnings) {
  process.stdout.write(`- [warning] ${warning.code} ${warning.message}\n`)
}
if (failures.length > 0) process.exitCode = 1
