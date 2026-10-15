// FID-2026-0725-085 BUG-003: Denylist architecture replaces allowlist.
// A denylist blocks known-dangerous commands while allowing all others.
// This is more maintainable and doesn't break on new/OS-specific commands.
//
// Forbidden shell metacharacters/patterns that could enable command
// substitution, redirection, pipes, or backgrounding. Chaining with `&&` is
// permitted only after safe splitting and per-segment validation (see below).
// NOTE: redirections whose target is a diagnostic sink (`2>nul`, `> /dev/null`)
// and the stream merge `2>&1` are explicitly permitted as they are read-only
// and standard diagnostic patterns; input redirection (`< file`) is permitted
// too, because the shell only reads. FID-2026-1014-001 Loop 1: the POSIX null
// sink and `< file` were refused while the EHEL mutation classifier already
// treated `/dev/null` as a non-mutation target — an asymmetry that turned
// legitimate read-only commands into agent-visible dead ends.
// FID-2026-1001-003 step 1: exported (previously module-private) so the EHEL
// mutation classifier consumes the SAME token lists — Law 13, one truth; the
// classifier must never grow a divergent copy.
export const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/

// Explicitly permitted redirections (read-only, diagnostic): the stream merge
// `2>&1` and any `[n]>`/`[n]>>` whose target is the null device (`/dev/null`,
// `nul`). Named for what it permits rather than for one OS, because the POSIX
// form is the twin of the Windows one and both must hold. Deliberately NOT
// global: the EHEL mutation classifier consumes this same regex with `.test()`,
// and a `g` flag would make its results alternate (Law 13, one truth).
// The sink token must be followed by a delimiter or end of segment: a bare
// `\b` would also match `> nul.txt` / `> /dev/null/foo`, whose real target is a
// file, and stripping them before the metachar scan would admit a write.
export const PERMITTED_REDIRECT_REGEX =
  /\b2>&1\b|\d?>>?\s*(?:\/dev\/null|nul)(?=\s|$|['"]|[;&|])/
// Stripping twin for the metachar scan in `validateReadonlySegment`; local and
// global so the shipped predicate keeps a clean `lastIndex`.
const PERMITTED_REDIRECT_GLOBAL = new RegExp(
  PERMITTED_REDIRECT_REGEX.source,
  'gi',
)
// Destructive filesystem commands that mutate state. These are rejected even
// when used without metacharacters (e.g. `rm -rf /`).
export const DESTRUCTIVE_COMMAND_REGEX =
  /^\s*(rm|mv|cp|chmod|chown|mkdir|mkfs|dd|mount|umount|truncate|mkfifo|mknod|ln\s*-s?|rmdir|touch|tee\s*-?|shred|chattr|setfacl)\b/i
// Mutating git operations. Read-only git (status, diff, log, show, branch, tag, remote) is allowed.
export const GIT_MUTATING_REGEX =
  /^\s*git\s+(?:branch\s+-(?:D|d|M|m|--force|--move|--delete)|tag\s+-(?:d|delete|--delete)|remote\s+(?:add|remove|rename|prune|set-url)|(?:checkout|reset|rm|mv|merge|rebase|cherry-pick|revert|apply|am|switch)\b|\S+\s+--output|--force\b)/i
// Dangerous commands that could execute arbitrary code or access the network.
const DANGEROUS_COMMAND_REGEX =
  /^\s*(?:curl|wget|ssh|scp|rsync|nc|ncat|socat|telnet|eval|exec|source|sh|bash|zsh|fish|dash|ksh|csh|tcsh|powershell|pwsh|cmd|\.\s|pip\s+install|npm\s+(?:install|publish|exec)|npx\s+(?!--version)|yarn\s+(?:add|remove|publish)|cargo\s+(?:install|publish)|go\s+run|python\s+-c|node\s+-e|deno\s+run)\b/i

/**
 * Split a command on unquoted `&&` separators. Respects single quotes,
 * double quotes, and backslash escapes so that `echo "a && b"` is not split.
 * FID-2026-1001-003 step 1: exported for the EHEL mutation classifier.
 */
export function splitSafeAnd(command: string): string[] {
  const segments: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let escapeNext = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    const nextCh = command[i + 1]
    if (escapeNext) {
      current += ch
      escapeNext = false
      continue
    }
    if (ch === '\\') {
      current += ch
      escapeNext = true
      continue
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      current += ch
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      current += ch
      continue
    }
    if (!inSingle && !inDouble && ch === '&' && nextCh === '&') {
      segments.push(current)
      current = ''
      i++ // skip the second &
      continue
    }
    current += ch
  }
  segments.push(current)
  return segments
}
/**
 * FID-2026-0817-002 B1: split a command on unquoted single `|` pipe
 * separators, mirroring splitSafeAnd's quote/escape awareness. A `||` is NOT
 * split (it is the OR-operator and stays forbidden); `hasOrOperator` reports it
 * so the caller rejects it. Each resulting segment is then validated
 * independently against the denylists, so `cat x | sh` is rejected because the
 * `sh` segment is a shell interpreter (added to DANGEROUS_COMMAND_REGEX).
 */
export function splitSafePipes(command: string): {
  segments: string[]
  hasOrOperator: boolean
} {
  const segments: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let escapeNext = false
  let hasOrOperator = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    const nextCh = command[i + 1]
    if (escapeNext) {
      current += ch
      escapeNext = false
      continue
    }
    if (ch === '\\') {
      current += ch
      escapeNext = true
      continue
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      current += ch
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      current += ch
      continue
    }
    if (!inSingle && !inDouble && ch === '|') {
      if (nextCh === '|') {
        hasOrOperator = true
        current += '||'
        i++ // skip the second |
        continue
      }
      segments.push(current)
      current = ''
      continue
    }
    current += ch
  }
  segments.push(current)
  return { segments, hasOrOperator }
}
/**
 * FID-2026-0814-004 H-02: shell-aware metacharacter scan. Replaces the old
 * maskQuoted + regex-on-masked-string approach, which rejected metacharacters
 * INSIDE quotes (a quoted `|`, `$` escaped as `\$`, and `$` inside a `[...]`
 * character class all tripped the denylist even though the shell treats them
 * as literal). This scanner tracks single-quote / double-quote / backslash-
 * escape / `[...]` character-class state and only flags UNQUOTED
 * metacharacters, matching how the shell actually interprets the command.
 *
 * Returns true when a forbidden metacharacter appears outside of quotes and
 * character classes.
 */
function hasUnquotedForbiddenMetachar(command: string): boolean {
  let inSingle = false
  let inDouble = false
  let inClass = false
  let escapeNext = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (escapeNext) {
      escapeNext = false
      continue
    }
    if (ch === '\\') {
      escapeNext = true
      continue
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      continue
    }
    if (inSingle || inDouble) continue
    // `[` starts a character class only when it is not the `[` of a
    // conditional/glob — treat any `[...]` run as literal (FID H-02). A `]`
    // outside a class is a literal character and never a metachar.
    if (ch === '[') {
      inClass = true
      continue
    }
    if (ch === ']' && inClass) {
      inClass = false
      continue
    }
    if (inClass) continue
    // Input redirection (`cmd < file`) only reads, so it is permitted
    // (FID-2026-1014-001 Loop 1: the audit corpus flagged `wc -l < SCOPE.md`).
    // Process substitution (`<(...)`) executes a command and heredocs /
    // here-strings (`<<`, `<<<`) feed an arbitrary payload to stdin; both stay
    // forbidden.
    if (ch === '<') {
      const next = command[i + 1]
      if (next === '(' || next === '<') return true
      continue
    }
    if (FORBIDDEN_METACHAR_REGEX.test(ch)) return true
  }
  return false
}
function validateReadonlySegment(segment: string): {
  valid: boolean
  reason?: string
} {
  // Check for forbidden metacharacters, but allow the permitted redirections
  // (`2>nul`, `> /dev/null`, `2>&1`) which are read-only diagnostic patterns.
  // The scan is quote/class-aware (FID-2026-0814-004 H-02): `|`, `$`, `&`
  // inside quotes or character classes are literal and never flagged. Unquoted
  // `|` is split into pipe segments before this check, so a remaining `|` here
  // is only `||` (rejected earlier) or a quoted literal.
  // FID-2026-1014-001 Loop 1: permitted forms are STRIPPED before the scan
  // rather than merely detected. A `contains` test let a segment carrying both
  // a permitted redirect and a genuine write redirect (`ls 2>/dev/null > f`)
  // through; the stripped text still carries the write redirect, so it is now
  // refused.
  const scanned = segment.replace(PERMITTED_REDIRECT_GLOBAL, '')
  if (hasUnquotedForbiddenMetachar(scanned)) {
    return {
      valid: false,
      reason:
        'Command contains forbidden shell metacharacters (redirection, command substitution, backgrounding, or `||`). Use run_terminal_command in green/audit phase for complex commands.',
    }
  }
  // Denylist checks: block known-dangerous commands
  if (DESTRUCTIVE_COMMAND_REGEX.test(segment)) {
    return {
      valid: false,
      reason:
        'Command is a destructive filesystem operation. Use run_terminal_command in green/audit phase for destructive commands.',
    }
  }
  if (GIT_MUTATING_REGEX.test(segment)) {
    return {
      valid: false,
      reason:
        'Git invocation contains mutating flags (delete/remove/reset/checkout/etc). Use run_terminal_command in green/audit phase for mutating git operations.',
    }
  }
  if (DANGEROUS_COMMAND_REGEX.test(segment)) {
    return {
      valid: false,
      reason:
        'Command could execute arbitrary code or access the network. Use run_terminal_command in green/audit phase for such commands.',
    }
  }
  return { valid: true }
}
export function isReadonlyCommand(command: string): {
  valid: boolean
  reason?: string
} {
  const andSegments = splitSafeAnd(command)
  for (const rawAndSegment of andSegments) {
    const andSegment = rawAndSegment.trim()
    if (andSegment.length === 0) {
      return {
        valid: false,
        reason:
          'Command contains an empty segment (dangling, leading, or consecutive `&&`). Use run_terminal_command in green/audit phase for complex command chains.',
      }
    }
    const { segments: pipeSegments, hasOrOperator } = splitSafePipes(andSegment)
    if (hasOrOperator) {
      return {
        valid: false,
        reason:
          'Command contains `||` (OR-operator). Use run_terminal_command in green/audit phase for conditional command chains.',
      }
    }
    for (const rawPipeSegment of pipeSegments) {
      const segment = rawPipeSegment.trim()
      if (segment.length === 0) {
        return {
          valid: false,
          reason:
            'Command contains an empty pipe segment (dangling or consecutive `|`). Use run_terminal_command in green/audit phase for complex pipelines.',
        }
      }
      const result = validateReadonlySegment(segment)
      if (!result.valid) return result
    }
  }
  return { valid: true }
}
