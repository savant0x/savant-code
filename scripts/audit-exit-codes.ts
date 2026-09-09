// FID-2026-0907-002 (Step 3) — exit-code-masking audit.
//
// The v0.0.22 incident class: a gate written as `cmd | tail; echo $?`
// reports tail's exit code, not cmd's — a crashed eslint shipped green.
// The repo's own gate runners capture exitCode directly, so the only
// durable defense is an audit that refuses the masking pattern when it
// re-enters tracked shell surfaces (scripts, git hooks, workflow YAML).
//
// Detector is pure text-in/issues-out; the collector resolves the tracked
// surface list via `git ls-files` (dev/LEARNINGS.md: filesystem grep is
// not git state) and normalizes separators before matching.

import fs from 'node:fs'
import path from 'node:path'

export interface MaskedExitCodeIssue {
  file: string
  line: number
  message: string
}

export interface ScriptLines {
  file: string
  lines: string[]
}

/** A command line piping into one of the stream-truncating filters. */
const PIPE_FILTER_PATTERN = /\|\s*(?:tail|head|tee)\b/
/** The masking echo, on its own logical line (shell or YAML run block). */
const ECHO_EXIT_CODE_PATTERN = /^\s*(?:echo|printf)\s+["']?\$\?["']?\s*;?\s*$/
/** How many lines after the piped command the shadowing echo may appear. */
const MASKING_WINDOW = 3
/** Shell comment prefixes that exempt a line from the audit. */
const COMMENT_PATTERN = /^\s*(?:#|\/\/)/

/**
 * Pure detector: flag every `echo $?` that appears within MASKING_WINDOW
 * lines after a pipe into tail/head/tee — the shadowed-exit-code shape.
 * Comment lines are exempt (documented allowlist; a commented example is
 * not an executable gate).
 */
export function detectMaskedExitCodes(
  script: ScriptLines,
): MaskedExitCodeIssue[] {
  const issues: MaskedExitCodeIssue[] = []
  let lastPipedLine = -MASKING_WINDOW - 1
  script.lines.forEach((rawLine, index) => {
    const lineNumber = index + 1
    if (COMMENT_PATTERN.test(rawLine)) return
    if (PIPE_FILTER_PATTERN.test(rawLine)) {
      lastPipedLine = lineNumber
      return
    }
    if (!ECHO_EXIT_CODE_PATTERN.test(rawLine)) return
    const distance = lineNumber - lastPipedLine
    if (distance <= MASKING_WINDOW) {
      issues.push({
        file: script.file,
        line: lineNumber,
        message: `exit code is shadowed: \`echo $\?\` runs ${distance} line(s) after a pipe into tail/head/tee — \`\$?\` reports the filter's status, not the command's. Capture the command's exit code directly (e.g. set -o pipefail, or spawn with exitCode capture).`,
      })
    }
  })
  return issues
}

/** The tracked shell-surface globs the audit covers. */
export const AUDITED_SURFACE_ARGS = [
  'scripts',
  '.githooks',
  '.github/workflows',
]

/**
 * Resolve the audited file list from git (tracked state, per the learnings
 * rule). Injectable runner for tests; sync spawn matches the repo's
 * validate scripts. Non-git environments fail closed with an empty list +
 * a returned error message (auditability is unprovable there).
 */
export function collectAuditedScriptFiles(
  root: string,
  runner: (
    command: string,
    args: string[],
    cwd: string,
  ) => {
    status: number | null
    stdout: string
    stderr: string
  } = defaultRunner,
): { files: string[]; error?: string } {
  const result = runner('git', ['ls-files', ...AUDITED_SURFACE_ARGS], root)
  if ((result.status ?? 1) !== 0) {
    return {
      files: [],
      error: `Unable to list tracked audit surfaces (git ls-files exit ${result.status}): ${result.stderr.trim()}`,
    }
  }
  return {
    files: result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((file) => file.replaceAll('\\', '/')),
  }
}

/** Read + normalize the audited files that exist on disk. */
export function readAuditedScripts(
  root: string,
  files: string[],
): ScriptLines[] {
  const scripts: ScriptLines[] = []
  for (const file of files) {
    const full = path.join(root, file)
    if (!fs.existsSync(full)) continue
    scripts.push({
      file,
      lines: fs.readFileSync(full, 'utf8').split(/\r?\n/),
    })
  }
  return scripts
}

export function auditExitCodeMasking(
  root: string,
  runner?: (
    command: string,
    args: string[],
    cwd: string,
  ) => { status: number | null; stdout: string; stderr: string },
): MaskedExitCodeIssue[] {
  const { files, error } = collectAuditedScriptFiles(root, runner)
  if (error) {
    return [
      {
        file: '(audit surfaces)',
        line: 0,
        message: error,
      },
    ]
  }
  return readAuditedScripts(root, files).flatMap((script) =>
    detectMaskedExitCodes(script),
  )
}

function defaultRunner(
  command: string,
  args: string[],
  cwd: string,
): { status: number | null; stdout: string; stderr: string } {
  const spawned = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    status: spawned.exitCode,
    stdout: spawned.stdout.toString(),
    stderr: spawned.stderr.toString(),
  }
}
