// FID-2026-0905-007 — public-release decomposition: receipts.
//
// Receipt paths, atomic persistence (0600 + rename), resume validation with
// gate-evidence re-binding, and the not-found classifier shared by the npm/GitHub
// guards. Verbatim moves from scripts/public-release.ts.

import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'fs'
import os from 'os'
import path from 'path'

import { run } from './command-runner'
import { RELEASE_STAGES, fail } from './fail'
import { buildGateManifest } from './gates'
import { repositoryRoot } from './local-state'
import { redactReceipt } from './redaction'

import type { ReleaseReceipt } from './catalog'

export function receiptPath(version: string): string {
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

export function loadResumeReceipt(
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

export function writeReceipt(receipt: ReleaseReceipt): void {
  const temporaryPath = `${receipt.receiptPath}.${process.pid}.tmp`
  mkdirSync(path.dirname(receipt.receiptPath), { recursive: true })
  writeFileSync(temporaryPath, redactReceipt(receipt), {
    encoding: 'utf8',
    mode: 0o600,
  })
  renameSync(temporaryPath, receipt.receiptPath)
}

export function diagnosticReceiptPath(version: string): string {
  return path.join(
    os.tmpdir(),
    `savant-public-release-${version}-diagnostic.json`,
  )
}

export function finalizeSuccessfulReleaseReceipt(
  receipt: ReleaseReceipt,
): void {
  receipt.failedStage = undefined
}

export function isStageComplete(
  receipt: Pick<ReleaseReceipt, 'completedStages'> | undefined,
  stage: string,
): boolean {
  return receipt?.completedStages.includes(stage) ?? false
}

export function markStage(receipt: ReleaseReceipt, stage: string): void {
  if (!receipt.completedStages.includes(stage))
    receipt.completedStages.push(stage)
  writeReceipt(receipt)
}
