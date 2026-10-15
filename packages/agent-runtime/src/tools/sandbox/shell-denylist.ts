/**
 * Destructive shell command denylist.
 *
 * FID-2026-07-27-001 — Phase 1
 *
 * These patterns are matched against the raw command string before execution.
 * They intentionally target commands that are destructive, irreversible, or
 * escape the project workspace. Benign commands such as `bun test`,
 * `git status`, or `echo "rm -rf"` should not match.
 */

/** Human-readable labels for each pattern family. */
export type DestructivePatternName =
  | 'rm-root'
  | 'rm-home'
  | 'rm-recursive-absolute'
  | 'disk-overwrite'
  | 'sudo'
  | 'mkfs'
  | 'dd-to-device'
  | 'curl-pipe-sh'
  | 'wget-pipe-sh'
  | 'fork-bomb'
  | 'chmod-system'
  | 'chown-system'

/** A single destructive pattern with a user-facing reason. */
export interface DestructivePattern {
  name: DestructivePatternName
  pattern: RegExp
  reason: string
}

/**
 * Default destructive patterns.
 *
 * Notes on false-positive avoidance:
 * - `rm -rf /` and `rm -rf /*` are blocked, but `rm -rf ./build` is not.
 * - `sudo` is blocked only as a whole-word prefix, not inside words.
 * - `curl ... | bash` / `wget ... | bash` are blocked by detecting the pipe
 *   to an interactive shell interpreter.
 */
export const defaultDestructivePatterns: DestructivePattern[] = [
  {
    name: 'rm-root',
    pattern: /(?:^|\s|;|&&|\|\|)rm\s+(?:-[a-zA-Z]*\s+)?(?:\/\s*(?:$|\s)|\/\*)/i,
    reason:
      'Deleting the filesystem root or all files under it is destructive.',
  },
  {
    name: 'rm-home',
    pattern:
      /(?:^|\s|;|&&|\|\|)rm\s+(?:-[a-zA-Z]*\s+)?(?:~|\$HOME)\s*(?:$|\s|;|&&|\|\|)/i,
    reason: 'Deleting the user home directory is destructive.',
  },
  {
    name: 'rm-recursive-absolute',
    pattern: /(?:^|\s|;|&&|\|\|)rm\s+(?:-[a-zA-Z]*\s+)?\//i,
    reason: 'Recursive removal targeting an absolute path is destructive.',
  },
  {
    name: 'disk-overwrite',
    pattern: /(?:>|>>)\s*\/dev\/(?:sda|sdb|sdc|nvme|disk)/i,
    reason: 'Overwriting a block device destroys data.',
  },
  {
    name: 'sudo',
    pattern: /(?:^|\s|;|&&|\|\|)sudo\s/i,
    reason: 'Running commands with elevated privileges is unsafe.',
  },
  {
    name: 'mkfs',
    pattern: /(?:^|\s|;|&&|\|\|)mkfs\./i,
    reason: 'Creating a filesystem is destructive.',
  },
  {
    name: 'dd-to-device',
    pattern: /(?:^|\s|;|&&|\|\|)dd\s+.*\s+of=\/(?:dev|sys|proc)\//i,
    reason: 'Writing raw data to a system device is destructive.',
  },
  {
    name: 'curl-pipe-sh',
    pattern: /curl\s+[^|]*\|\s*(?:sh|bash|zsh|fish)/i,
    reason: 'Piping curl directly to a shell can execute untrusted code.',
  },
  {
    name: 'wget-pipe-sh',
    pattern: /wget\s+[^|]*\|\s*(?:sh|bash|zsh|fish)/i,
    reason: 'Piping wget directly to a shell can execute untrusted code.',
  },
  {
    name: 'fork-bomb',
    pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: 'Fork bombs exhaust system resources.',
  },
  {
    name: 'chmod-system',
    pattern:
      /(?:^|\s|;|&&|\|\|)chmod\s+(?:-[a-zA-Z]*\s+)?(?:-R\s+)?(?:777|755)\s*\//i,
    reason: 'Recursively changing permissions on system paths is destructive.',
  },
  {
    name: 'chown-system',
    pattern:
      /(?:^|\s|;|&&|\|\|)chown\s+(?:-[a-zA-Z]*\s+)?(?:-R\s+)?[^\s]+\s+\//i,
    reason: 'Recursively changing ownership of system paths is destructive.',
  },
]

/**
 * Checks whether a shell command matches any destructive pattern.
 * Returns the first matching pattern or undefined.
 */
export function findDestructivePattern(
  command: string,
  patterns: DestructivePattern[] = defaultDestructivePatterns,
): DestructivePattern | undefined {
  return patterns.find((p) => p.pattern.test(command))
}
