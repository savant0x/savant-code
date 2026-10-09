// FID-2026-1007-014 — pre-audit check family B: G2 closed-FID commit hashes
// and G5 bundle state. The pre-audit family asserted a clean worktree and a
// sane push range but never the two release-path laws, so a cut could proceed
// with hash-less closed FIDs and no verified recovery bundle.
//
// Both checks return CheckResult (audit-types) and join the runPreAudit
// result list. Fail-closed throughout: an unverifiable claim blocks, never
// passes. Staleness/deep-history readings intentionally left open by the FID
// stay open here (warn, never silent): the G2 window default and the G5
// staleness constant are operator decisions recorded in the FID, not picked.

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { parseFidStatus } from '@savant-code/agent-runtime/echo/fid-verification-enforcement'

import {
  BACKUP_MARKER_TAG,
  SAVANT_BUNDLE_DIR_DEFAULT,
  latestIncrementalFile,
} from '../git-bundle-backup.js'

import type { AuditFinding, CheckResult } from './audit-types'

/** Injected git runner; the default shells out, tests inject fakes. */
export type GitRun = (root: string, args: string[]) => {
  status: number
  stdout: string
  stderr: string
}

function defaultRun(root: string, args: string[]): {
  status: number
  stdout: string
  stderr: string
} {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: false,
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

const FID_FILE = /^FID-.*\.md$/
const STATUS_LINE = /^\*\*Status:\*\*.*$/m
const STATUS_COMMIT = /\bcommit ([0-9a-f]{7,40})\b/
const CLOSED_DATE = /^-\s*\*\*Closed Date:\*\*\s*(\d{4}-\d{2}-\d{2})/m
const COMMIT_STATE =
  /^-\s*\*\*Commit\/State:\*\*\s*(.+?)\s*$/m
const COMMIT_STATE_PLACEHOLDER = 'Git SHA or state description'
// Pre-gate history grandfathered by filename (FID-2026-1007-014 Loop 4):
// only NEW gaps fail, mirroring changelog-coverage-baseline.json. Shrink
// this file as hashes are backfilled; staleness fails (see below).
const BASELINE_PATH = 'dev/preaudit-g2-commit-baseline.json'

function block(check: string, message: string): CheckResult {
  return { findings: [{ check, severity: 'block', message }], fixes: [] }
}

/**
 * Newest `v*` tag date (ISO day), or null when the repo has no release tag
 * (every closure is then in-window). Throws nothing; git failure is reported
 * by the caller as a block finding, never mistaken for "no tags".
 */
export function lastReleaseTagDate(
  root: string,
  run: GitRun = defaultRun,
): { ok: true; date: string | null } | { ok: false; message: string } {
  const tags = run(root, ['tag', '--list', 'v*', '--sort=-v:refname'])
  if (tags.status !== 0) {
    return { ok: false, message: 'unable to list release tags (git tag failed)' }
  }
  const first = tags.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0]
  if (first === undefined) return { ok: true, date: null }
  const at = run(root, ['log', '-1', '--format=%cs', first])
  if (at.status !== 0) {
    return { ok: false, message: `unable to date release tag ${first}` }
  }
  const date = at.stdout.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, message: `release tag ${first} has no ISO date` }
  }
  return { ok: true, date }
}

/**
 * G2: every CLOSED archived FID whose closure postdates the last release tag
 * carries its closing hash in a MACHINE-READABLE surface: the Commit/State
 * field (template contract) or a `commit <sha>` token on the status line
 * (October-batch closure convention). Resolution prose is deliberately NOT
 * mined — phrasings vary and prose mining false-positives on dependency
 * commits (live proof: `f099ded8`). Records with Resolution-only hashes are
 * pre-gate history: baselined, with their known hashes noted in the FID for
 * a future backfill pass.
 */
export function checkG2CommitHashes(
  root: string,
  run: GitRun = defaultRun,
): CheckResult {
  const directory = path.join(root, 'dev', 'fids', 'archive')
  if (!fs.existsSync(directory)) return { findings: [], fixes: [] }
  const tag = lastReleaseTagDate(root, run)
  if (!tag.ok) return block('g2-commit-hashes', tag.message)
  const gaps: { file: string; message: string }[] = []
  for (const name of fs.readdirSync(directory)) {
    if (!FID_FILE.test(name)) continue
    const content = fs.readFileSync(path.join(directory, name), 'utf8')
    const status = parseFidStatus(content)
    if (status === undefined || status.split(/\s/)[0] !== 'closed') continue
    const closedDate = content.match(CLOSED_DATE)?.[1]
    // Window membership: a machine-readable Closed Date past the tag is
    // in-window. Records without one fall back to the filename date:
    // pre-template history (bulk-closed, no per-record metadata) predates
    // the Commit/State contract, and checking it red-gates every release on
    // unactionable history (live run: 152 blocks). This mirrors the
    // FID-2026-0928-013 cutoff precedent. A record with neither date is
    // treated as in-window (safe direction: more checking, not less).
    const fileDate = name.match(/^FID-(\d{4})-(\d{4})-(\d{3})/)
    const proxyDate =
      fileDate?.[1] !== undefined && fileDate?.[2] !== undefined
        ? `${fileDate[1]}-${fileDate[2].slice(0, 2)}-${fileDate[2].slice(2)}`
        : undefined
    const effectiveDate = closedDate ?? proxyDate
    if (
      tag.date !== null &&
      effectiveDate !== undefined &&
      effectiveDate <= tag.date
    ) {
      continue
    }
    const fieldValue = content.match(COMMIT_STATE)?.[1]?.trim() ?? ''
    const fieldOk =
      fieldValue !== '' && !fieldValue.includes(COMMIT_STATE_PLACEHOLDER)
    const statusLine = content.match(STATUS_LINE)?.[0] ?? ''
    const statusOk = STATUS_COMMIT.test(statusLine)
    if (!fieldOk && !statusOk) {
      gaps.push({
        file: name,
        message:
          `closed FID ${name} carries no Commit/State value ` +
          `(in release window${closedDate === undefined ? '; no parseable Closed Date' : ''}) — ` +
          `record the closing commit hash`,
      })
    }
  }
  const baseline = readBaseline(root)
  if (baseline === null) {
    return block(
      'g2-commit-hashes',
      `${BASELINE_PATH} is malformed — the grandfather list must parse as a string array`,
    )
  }
  const gapFiles = new Set(gaps.map((gap) => gap.file))
  const baselineSet = new Set(baseline)
  const findings: AuditFinding[] = []
  for (const entry of baseline) {
    if (!gapFiles.has(entry)) {
      findings.push({
        check: 'g2-commit-hashes',
        severity: 'block',
        message:
          `G2 baseline stale: ${entry} no longer gaps (hash recorded or record gone) — ` +
          `shrink ${BASELINE_PATH}`,
      })
    }
  }
  for (const gap of gaps) {
    if (!baselineSet.has(gap.file)) {
      findings.push({
        check: 'g2-commit-hashes',
        severity: 'block',
        message: gap.message,
      })
    }
  }
  return { findings, fixes: [] }
}

function readBaseline(root: string): string[] | null {
  let raw: string
  try {
    raw = fs.readFileSync(path.join(root, BASELINE_PATH), 'utf8')
  } catch {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.every((entry) => typeof entry === 'string')
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * G5: a `last-backup` marker exists, its bundle files exist on disk, and
 * `git bundle verify` passes on them. A marker behind HEAD warns (commits
 * since the last verified backup are unbacked); the staleness constant that
 * would turn that warn into a block is an open operator decision in the FID.
 */
export function checkG5BundleState(
  root: string,
  run: GitRun = defaultRun,
  opts?: { bundleDir?: string },
): CheckResult {
  const bundleDir =
    opts?.bundleDir ?? process.env.SAVANT_BUNDLE_DIR ?? SAVANT_BUNDLE_DIR_DEFAULT
  const marker = run(root, ['rev-parse', '--verify', BACKUP_MARKER_TAG])
  if (marker.status !== 0) {
    return block(
      'g5-bundle-state',
      `no ${BACKUP_MARKER_TAG} marker tag — no recovery point of record; run git-bundle-backup --baseline first`,
    )
  }
  const sha = marker.stdout.trim()
  if (!fs.existsSync(bundleDir)) {
    return block(
      'g5-bundle-state',
      `bundle directory ${bundleDir} absent — marker ${sha.slice(0, 12)} has no archive on disk`,
    )
  }
  const targets: string[] = []
  const baseline = path.join(bundleDir, 'baseline.bundle')
  if (fs.existsSync(baseline)) targets.push(baseline)
  const incremental = latestIncrementalFile(bundleDir)
  if (incremental !== undefined) targets.push(path.join(bundleDir, incremental))
  if (targets.length === 0) {
    return block(
      'g5-bundle-state',
      `no bundle files in ${bundleDir} — marker ${sha.slice(0, 12)} points at nothing verifiable`,
    )
  }
  const findings: AuditFinding[] = []
  for (const target of targets) {
    const verify = run(root, ['bundle', 'verify', target])
    if (verify.status !== 0) {
      findings.push({
        check: 'g5-bundle-state',
        severity: 'block',
        message:
          `git bundle verify failed for ${path.basename(target)}: ` +
          `${verify.stderr.trim().slice(0, 200)}`,
      })
    }
  }
  const head = run(root, ['rev-parse', 'HEAD'])
  if (head.status === 0 && head.stdout.trim() !== sha && head.stdout.trim() !== '') {
    findings.push({
      check: 'g5-bundle-state',
      severity: 'warn',
      message:
        `marker ${sha.slice(0, 12)} is behind HEAD ${head.stdout.trim().slice(0, 12)} — ` +
        `commits since the last verified backup are unbacked (staleness block threshold: open operator decision)`,
    })
  }
  return { findings, fixes: [] }
}
