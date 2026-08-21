import { execFileSync } from 'child_process'

/**
 * `/contribute` core (FID-2026-0819-005 split): pure helpers, the injectable
 * exec boundary, and the git branch → commit → push → PR flow. The command
 * handler lives in contribute.ts.
 */

/** Header written when CONTRIBUTORS.md does not exist yet. */
export const CONTRIBUTORS_HEADER = [
  '# Contributors',
  '',
  'Thank you to everyone who has contributed to Savant Code!',
  '',
  '| GitHub | Added |',
  '|--------|-------|',
].join('\n')

/** Injectable process runner (defaults to execFileSync) so tests can fake git/gh. */
export type ExecFn = (cmd: string, args: string[], cwd: string) => string

export const defaultExec: ExecFn = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim()

/**
 * Validates and normalizes a GitHub username.
 * GitHub usernames are alphanumeric + hyphens (max 39 chars). Anything else
 * (spaces, slashes, shell metacharacters, leading `@`) is rejected — this is
 * the injection boundary for every downstream git/gh argv.
 */
export function sanitizeUsername(raw: string): string {
  const trimmed = raw.trim().replace(/^@/, '')
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/.test(trimmed) ? trimmed : ''
}

/**
 * Duplicate check against the contributors table. Matches the `@user` cell
 * bounded on the right by whitespace/EOL so `savant` does not match
 * `savant0x`. Case-insensitive.
 */
export function checkContributorExists(
  content: string,
  username: string,
): boolean {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`@${escaped}(?=\\s|$)`, 'i').test(content)
}

/** Formats a single contributors-table row. */
export function formatContributorRow(username: string, date: string): string {
  return `| @${username} | ${date} |`
}

/**
 * Builds the new CONTRIBUTORS.md content: keeps the existing content (or
 * creates the header when the file is missing) and appends the new row.
 */
export function buildContributorsContent(
  existing: string | null,
  username: string,
  date: string,
): string {
  const base = existing ?? CONTRIBUTORS_HEADER
  const normalized = base.endsWith('\n') ? base : `${base}\n`
  return `${normalized}${formatContributorRow(username, date)}\n`
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Reads `git config user.name` from the repo-local config; '' when unset. */
export function getGitConfigUsername(exec: ExecFn, cwd: string): string {
  try {
    return sanitizeUsername(exec('git', ['config', 'user.name'], cwd))
  } catch {
    return ''
  }
}

/** Last stderr line(s) from a failed git/gh call — enough to hint at the cause. */
export function execErrorSummary(err: unknown): string {
  if (err instanceof Error) {
    const { stderr } = err as Error & { stderr?: unknown }
    const text =
      typeof stderr === 'string'
        ? stderr
        : Buffer.isBuffer(stderr)
          ? stderr.toString('utf8')
          : err.message
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return lines.slice(-2).join(' ') || err.message
  }
  return String(err)
}

export function gitBranchExists(
  exec: ExecFn,
  root: string,
  branch: string,
): boolean {
  try {
    exec(
      'git',
      ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`],
      root,
    )
    return true
  } catch {
    return false
  }
}

/**
 * Runs the branch → commit → push → PR flow. Only CONTRIBUTORS.md is ever
 * committed; the operator is returned to their original branch even on
 * failure (best effort). Returns the gh PR URL.
 */
export function runContributeGitFlow(
  projectRoot: string,
  username: string,
  exec: ExecFn = defaultExec,
): string {
  // Sanity: must be inside a git work tree.
  exec('git', ['rev-parse', '--is-inside-work-tree'], projectRoot)

  const originalBranch = exec(
    'git',
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    projectRoot,
  )
  const branchName = `contribute/add-${username.toLowerCase()}`

  try {
    if (gitBranchExists(exec, projectRoot, branchName)) {
      exec('git', ['checkout', branchName], projectRoot)
    } else {
      exec('git', ['checkout', '-b', branchName], projectRoot)
    }

    // Commit CONTRIBUTORS.md only when it actually changed (a prior run may
    // have already committed the same row on an existing branch).
    const dirty = exec(
      'git',
      ['status', '--porcelain', '--', 'CONTRIBUTORS.md'],
      projectRoot,
    )
    if (dirty) {
      exec(
        'git',
        [
          'commit',
          '-m',
          `docs: add @${username} as contributor`,
          '--',
          'CONTRIBUTORS.md',
        ],
        projectRoot,
      )
    }

    exec('git', ['push', '-u', 'origin', branchName], projectRoot)

    return exec(
      'gh',
      [
        'pr',
        'create',
        '--title',
        `Add @${username} as contributor`,
        '--body',
        `Welcome @${username} to the Savant Code contributors! 🎯`,
        '--base',
        'main',
        '--head',
        branchName,
      ],
      projectRoot,
    )
  } finally {
    // Always land the operator back on their original branch.
    if (originalBranch !== 'HEAD') {
      try {
        exec('git', ['checkout', originalBranch], projectRoot)
      } catch {
        // Best effort — the real flow error (if any) takes priority.
      }
    }
  }
}
