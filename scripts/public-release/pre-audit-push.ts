// FID-2026-0913-004 — pre-audit check family B: the pushed range. Dry-runs
// the exact pre-push credential scan (plus its 2MB blob cap) against the
// range `git push origin main` would push, so an over-cap blob or a
// credential-shaped file fails the release BEFORE the confirmation instead
// of at the push stage.

import { spawnSync } from 'child_process'

import { runPrePushSecretScan } from '../pre-push-scan'

import type { AuditFinding, CheckResult } from './audit-types'

/** 2MB — must stay in lockstep with pre-push-scan.ts's credential-scan cap. */
export const PUSH_BLOB_SCAN_CAP = 2 * 1024 * 1024

export function runGit(root: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    shell: false,
  })
  if (result.status !== 0) {
    const detail = String(result.stderr ?? '').trim() || 'unknown git error'
    throw new Error(`git ${args[0] ?? ''} failed: ${detail}`)
  }
  return String(result.stdout ?? '')
}

/** Blobs in `origin/main..main` over the scan cap, with their paths. */
export function oversizedPushedBlobs(
  root: string,
): { sha: string; size: number; path: string }[] {
  try {
    runGit(root, ['fetch', 'origin', 'main'])
  } catch {
    // Offline or already current: the local origin/main ref stays truth.
  }
  const objects = runGit(root, ['rev-list', '--objects', 'origin/main..main'])
  const shaToPath = new Map<string, string>()
  for (const line of objects.split(/\r?\n/)) {
    const [sha, filePath] = line.trim().split(/\s+/, 2)
    if (sha && filePath) shaToPath.set(sha, filePath)
  }
  const batch = spawnSync(
    'git',
    ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
    {
      cwd: root,
      input: [...shaToPath.keys()].join('\n'),
      encoding: 'utf8',
      windowsHide: true,
      shell: false,
    },
  )
  const oversized: { sha: string; size: number; path: string }[] = []
  for (const line of String(batch.stdout ?? '').split(/\r?\n/)) {
    const [sha, type, size] = line.trim().split(/\s+/)
    if (type !== 'blob') continue
    const bytes = Number(size)
    if (bytes > PUSH_BLOB_SCAN_CAP) {
      oversized.push({
        sha,
        size: bytes,
        path: shaToPath.get(sha) ?? '(unknown)',
      })
    }
  }
  return oversized.sort((a, b) => b.size - a.size)
}

export function checkPushRange(root: string): CheckResult {
  const findings: AuditFinding[] = []
  try {
    const oversized = oversizedPushedBlobs(root)
    if (oversized.length > 0) {
      const shown = oversized
        .slice(0, 10)
        .map(
          (blob) => `${blob.path} (${(blob.size / 1024 / 1024).toFixed(1)}MB)`,
        )
        .join(', ')
      findings.push({
        check: 'push-range-scannable',
        severity: 'block',
        message: `the pushed range carries blob(s) over the 2MB credential-scan cap, which refuses the push fail-closed: ${shown}. Drop them from the unpushed history (fast-forward-safe rewrite) before releasing.`,
      })
    }
    const head = runGit(root, ['rev-parse', 'main']).trim()
    const base = runGit(root, ['rev-parse', 'origin/main']).trim()
    const scan = runPrePushSecretScan(
      root,
      `refs/heads/main ${head} refs/heads/main ${base}\n`,
    )
    if (scan.flagged.length > 0) {
      findings.push({
        check: 'push-range-credential-clean',
        severity: 'block',
        message: `the pushed range would be refused by the pre-push credential scan (${scan.flagged.length} finding(s)): ${scan.flagged.slice(0, 5).join(' | ')}`,
      })
    }
  } catch (error) {
    findings.push({
      check: 'push-range-credential-clean',
      severity: 'warn',
      message: `pushed-range audit could not run (${error instanceof Error ? error.message : String(error)}) — the pre-push scan will still fail closed at push time`,
    })
  }
  return { findings, fixes: [] }
}
