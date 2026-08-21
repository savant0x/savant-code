/**
 * `/contribute` command — add yourself to the repo's CONTRIBUTORS.md and open
 * a PR via the gh CLI.
 *
 * Usage:
 *   /contribute              → uses `git config user.name` (fallback: usage)
 *   /contribute <username>   → adds @<username> to CONTRIBUTORS.md
 *
 * Note: the no-arg form resolves the repo's CURRENT git identity. Once bot
 * authorship is enabled (scripts/setup-bot-authorship.sh sets user.name to
 * "savant-code"), pass your own username explicitly.
 *
 * Behavior (FID-2026-0806-004 Task 2):
 * - Appends a `| @user | date |` row to CONTRIBUTORS.md (creating the file
 *   with a header when missing). Duplicate-safe: exits early if the username
 *   is already listed.
 * - Runs a git branch → commit → push → `gh pr create` flow so the change
 *   becomes a real PR. The flow operates on the project root (not
 *   process.cwd()), returns to the operator's original branch, and commits
 *   ONLY CONTRIBUTORS.md (other staged/worktree changes are never swept in).
 * - git/gh calls use execFileSync with argv arrays (no shell interpolation →
 *   no injection surface) and every step is Law-14 wrapped: any failure posts
 *   a message explaining the local file was still updated and how to finish.
 */

import fs from 'fs'
import path from 'path'

import { getProjectRoot } from '../project-files'
import { clearInput } from './command-shared'
import {
  buildContributorsContent,
  checkContributorExists,
  defaultExec,
  execErrorSummary,
  getGitConfigUsername,
  runContributeGitFlow,
  sanitizeUsername,
  todayIsoDate,
} from './contribute-core'
import { getSystemMessage } from '../utils/message-history'

import type { CommandResult, RouterParams } from './command-registry'
import type { ExecFn } from './contribute-core'

// Re-export the pure core from the original path (focused-test call-graph).
export {
  buildContributorsContent,
  checkContributorExists,
  CONTRIBUTORS_HEADER,
  formatContributorRow,
  runContributeGitFlow,
  sanitizeUsername,
  type ExecFn,
} from './contribute-core'

export async function handleContributeCommand(
  params: RouterParams,
  args: string,
  exec: ExecFn = defaultExec,
): Promise<CommandResult> {
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)

  let projectRoot: string
  try {
    projectRoot = getProjectRoot()
  } catch {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'No project root is set — /contribute needs a git repository to run in.',
      ),
    ])
    return
  }

  // Resolve the username: an explicit arg wins; otherwise read git config.
  let username = sanitizeUsername(args)
  if (!username) {
    username = getGitConfigUsername(exec, projectRoot)
  }
  if (!username) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        [
          'Usage: /contribute [github-username]',
          '',
          'Example: /contribute spencer',
          '',
          'Adds you to CONTRIBUTORS.md and opens a PR so you become an official contributor. With no argument, the command reads `git config user.name`. Requires the gh CLI (`gh auth login`) and write access to the repo.',
        ].join('\n'),
      ),
    ])
    return
  }

  const contributorsPath = path.join(projectRoot, 'CONTRIBUTORS.md')

  let existing: string | null = null
  try {
    existing = fs.readFileSync(contributorsPath, 'utf8')
  } catch {
    existing = null // File does not exist yet — the header will be created.
  }

  if (existing !== null && checkContributorExists(existing, username)) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `@${username} is already listed in CONTRIBUTORS.md — nothing to do.`,
      ),
    ])
    return
  }

  // Append the row locally first (durable even if the PR step fails below).
  try {
    fs.writeFileSync(
      contributorsPath,
      buildContributorsContent(existing, username, todayIsoDate()),
      'utf8',
    )
  } catch (err) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `❌ Could not write CONTRIBUTORS.md: ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
    ])
    return
  }

  // Branch → commit → push → PR.
  try {
    const prUrl = runContributeGitFlow(projectRoot, username, exec)
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        [
          `✅ @${username} added to CONTRIBUTORS.md — PR opened.`,
          '',
          prUrl,
          '',
          'Approve or merge the PR to become an official contributor. 🎯',
        ].join('\n'),
      ),
    ])
  } catch (err) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        [
          '⚠️ CONTRIBUTORS.md was updated locally, but the git/gh flow failed:',
          '',
          execErrorSummary(err),
          '',
          'Make sure the gh CLI is installed and authenticated (`gh auth login`), the repo has an `origin` remote, and you have write access.',
        ].join('\n'),
      ),
    ])
  }
}
