// FID-2026-0913-004 — pre-audit check family A: local-state preconditions
// (worktree churn, release lock, stale tag). The three classes that hit
// BEFORE any gate ran on release night.

import { spawnSync } from 'child_process'
import { existsSync, readFileSync, rmSync } from 'fs'
import path from 'path'

import { releaseLockPath } from './lock'

import type { CheckResult, SafeFix } from './audit-types'

/**
 * The harness's experience-capture hook appends to this file during working
 * sessions; it is the one churn class the release can safely commit for the
 * operator (the automation path already commits everything). Anything else
 * dirty blocks with the operator's own remediation.
 */
const TELEMETRY_CHURN_PATHS = ['dev/experiences/raw-traces.jsonl']

export function checkWorktreeClean(root: string): CheckResult {
  const status = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: root, encoding: 'utf8', windowsHide: true, shell: false },
  )
  if (status.status !== 0) {
    return {
      findings: [
        {
          check: 'worktree-clean',
          severity: 'block',
          message: 'unable to inspect the git worktree (git status failed)',
        },
      ],
      fixes: [],
    }
  }
  if (!status.stdout.trim()) return { findings: [], fixes: [] }
  const dirty = status.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
  const churnOnly =
    dirty.length > 0 &&
    dirty.every((file) => TELEMETRY_CHURN_PATHS.includes(file))
  if (churnOnly) {
    const files = dirty.join(', ')
    const fix: SafeFix = () => {
      const add = spawnSync('git', ['add', '--', ...dirty], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        shell: false,
      })
      const commit = spawnSync(
        'git',
        [
          'commit',
          '-m',
          'chore(experiences): harness trace churn before release (pre-audit)',
        ],
        { cwd: root, encoding: 'utf8', windowsHide: true, shell: false },
      )
      if (add.status !== 0 || commit.status !== 0) {
        return `FAILED to auto-commit telemetry churn (${files}) — commit it manually`
      }
      return `committed telemetry churn: ${files}`
    }
    return {
      findings: [
        {
          check: 'worktree-clean',
          severity: 'fixed',
          message: `harness telemetry churn (${files}) — auto-commit staged`,
        },
      ],
      fixes: [fix],
    }
  }
  return {
    findings: [
      {
        check: 'worktree-clean',
        severity: 'block',
        message: `worktree is dirty (${dirty.length} path(s)); the release refuses to start. Commit or stash: ${dirty.slice(0, 10).join(', ')}`,
      },
    ],
    fixes: [],
  }
}

export function checkReleaseLock(root: string, version: string): CheckResult {
  const lockPath = releaseLockPath(version)
  if (!existsSync(lockPath)) return { findings: [], fixes: [] }
  const ownerPath = path.join(lockPath, 'owner.json')
  let alive = false
  try {
    const owner = JSON.parse(readFileSync(ownerPath, 'utf8')) as {
      pid?: number
    }
    if (owner.pid) {
      try {
        process.kill(owner.pid, 0)
        alive = true
      } catch {
        alive = false
      }
    }
  } catch {
    alive = false
  }
  if (alive) {
    return {
      findings: [
        {
          check: 'release-lock-free',
          severity: 'block',
          message: `a live release process still holds ${lockPath} — wait for it or kill it`,
        },
      ],
      fixes: [],
    }
  }
  return {
    findings: [
      {
        check: 'release-lock-free',
        severity: 'fixed',
        message: `stale release lock (owner dead) — removal staged`,
      },
    ],
    fixes: [
      () => {
        rmSync(lockPath, { recursive: true, force: true })
        return `removed stale lock ${lockPath}`
      },
    ],
  }
}

export function checkStaleTag(
  root: string,
  version: string,
  resume: boolean,
): CheckResult {
  const tag = `v${version}`
  const local = spawnSync(
    'git',
    ['rev-parse', '--verify', `refs/tags/${tag}`],
    { cwd: root, encoding: 'utf8', windowsHide: true, shell: false },
  )
  if (local.status !== 0) return { findings: [], fixes: [] }
  const remote = spawnSync(
    'git',
    ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`],
    { cwd: root, encoding: 'utf8', windowsHide: true, shell: false },
  )
  if (remote.status !== 0) {
    // Cannot verify absence on origin (offline, auth prompt, etc.) — never
    // delete on an unverifiable claim.
    return {
      findings: [
        {
          check: 'stale-tag-absent',
          severity: 'warn',
          message: `cannot verify whether ${tag} exists on origin (ls-remote failed); keeping the tag`,
        },
      ],
      fixes: [],
    }
  }
  const onRemote = Boolean(remote.stdout.trim())
  if (onRemote) {
    return {
      findings: [
        {
          check: 'stale-tag-absent',
          severity: 'block',
          message: `tag ${tag} already exists on origin — the release already shipped; use --resume or delete the release`,
        },
      ],
      fixes: [],
    }
  }
  // Never delete anything during resume: a legitimately re-created tag is
  // part of resume's contract (allowExistingTag verifies it against HEAD).
  if (resume) {
    return {
      findings: [
        {
          check: 'stale-tag-absent',
          severity: 'warn',
          message: `tag ${tag} exists locally but was never pushed — kept (resume mode never deletes)`,
        },
      ],
      fixes: [],
    }
  }
  return {
    findings: [
      {
        check: 'stale-tag-absent',
        severity: 'fixed',
        message: `tag ${tag} exists locally but was never pushed (leftover from a failed run) — deletion staged`,
      },
    ],
    fixes: [
      () => {
        const result = spawnSync('git', ['tag', '-d', tag], {
          cwd: root,
          encoding: 'utf8',
          windowsHide: true,
          shell: false,
        })
        return result.status === 0
          ? `deleted unpushed tag ${tag}`
          : `FAILED to delete tag ${tag} — delete it manually`
      },
    ],
  }
}
