import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  ClientToolName as _ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
// FID-2026-0725-085 BUG-003: Denylist architecture replaces allowlist.
// A denylist blocks known-dangerous commands while allowing all others.
// This is more maintainable and doesn't break on new/OS-specific commands.
//
// Forbidden shell metacharacters/patterns that could enable command
// substitution, redirection, pipes, or backgrounding. Chaining with `&&` is
// permitted only after safe splitting and per-segment validation (see below).
// NOTE: Windows stderr redirections (2>nul, 2>&1) are explicitly permitted
// as they are read-only and standard diagnostic patterns.
const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/
// Explicitly permitted Windows stderr redirections (read-only, diagnostic).
const WINDOWS_STDERR_REDIRECT_REGEX = /\b2>nul\b|\b2>&1\b/
// Destructive filesystem commands that mutate state. These are rejected even
// when used without metacharacters (e.g. `rm -rf /`).
const DESTRUCTIVE_COMMAND_REGEX =
  /^\s*(rm|mv|cp|chmod|chown|mkdir|mkfs|dd|mount|umount|truncate|mkfifo|mknod|ln\s*-s?|rmdir|touch|tee\s*-?|shred|chattr|setfacl)\b/i
// Mutating git operations. Read-only git (status, diff, log, show, branch, tag, remote) is allowed.
const GIT_MUTATING_REGEX =
  /^\s*git\s+(?:branch\s+-(?:D|d|M|m|--force|--move|--delete)|tag\s+-(?:d|delete|--delete)|remote\s+(?:add|remove|rename|prune|set-url)|(?:checkout|reset|rm|mv|merge|rebase|cherry-pick|revert|apply|am|switch)\b|\S+\s+--output|--force\b)/i
// Dangerous commands that could execute arbitrary code or access the network.
const DANGEROUS_COMMAND_REGEX =
  /^\s*(?:curl|wget|ssh|scp|rsync|nc|ncat|socat|telnet|eval|exec|source|sh|bash|zsh|fish|dash|ksh|csh|tcsh|powershell|pwsh|cmd|\.\s|pip\s+install|npm\s+(?:install|publish|exec)|npx\s+(?!--version)|yarn\s+(?:add|remove|publish)|cargo\s+(?:install|publish)|go\s+run|python\s+-c|node\s+-e|deno\s+run)\b/i
/**
 * Split a command on unquoted `&&` separators. Respects single quotes,
 * double quotes, and backslash escapes so that `echo "a && b"` is not split.
 */
function splitSafeAnd(command: string): string[] {
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
function splitSafePipes(command: string): {
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
    if (FORBIDDEN_METACHAR_REGEX.test(ch)) return true
  }
  return false
}
function validateReadonlySegment(segment: string): {
  valid: boolean
  reason?: string
} {
  // Check for forbidden metacharacters, but allow Windows stderr redirections
  // (2>nul, 2>&1) which are read-only diagnostic patterns. The scan is
  // quote/class-aware (FID-2026-0814-004 H-02): `|`, `$`, `&` inside quotes
  // or character classes are literal and never flagged. Unquoted `|` is split
  // into pipe segments before this check, so a remaining `|` here is only
  // `||` (rejected earlier) or a quoted literal.
  if (
    hasUnquotedForbiddenMetachar(segment) &&
    !WINDOWS_STDERR_REDIRECT_REGEX.test(segment)
  ) {
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
function isReadonlyCommand(command: string): {
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
// run_readonly_command is not a ClientToolName, so its handler function type
// does not expose requestClientToolCall. We still delegate to the client tool
// run_terminal_command at runtime, which requires an explicit cast.
// run_readonly_command is not a ClientToolName (it performs server-side
// validation first), but it delegates to run_terminal_command, which IS a
// ClientToolName. The runtime passes requestClientToolCall to every handler,
// so we cast to SavantCodeToolHandlerFunction to keep the public signature
// simple while still using the run_terminal_command client tool internally.
export const handleRunReadonlyCommand = (async ({
  previousToolCallFinished,
  toolCall,
  requestClientToolCall,
}: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'run_readonly_command'>
  requestClientToolCall: (
    toolCall: ClientToolCall<'run_terminal_command'>,
  ) => Promise<SavantCodeToolOutput<'run_terminal_command'>>
}) => {
  const { command, commands, cwd, timeout_seconds } = toolCall.input
  const isBatch = commands !== undefined
  const allCommands: string[] = isBatch
    ? commands
    : command !== undefined
      ? [command]
      : []

  if (allCommands.length === 0) {
    return {
      output: [
        {
          type: 'json',
          value: {
            command: command ?? '',
            stdout: '',
            stderr: 'run_readonly_command rejected: no command provided.',
            exitCode: 1,
          },
        },
      ] as SavantCodeToolOutput<'run_readonly_command'>,
    }
  }

  await previousToolCallFinished

  // FID-2026-0817-002 B3: validate + delegate one command. Reused by both the
  // single-command and batch paths so validation never diverges.
  const runOne = async (
    cmd: string,
  ): Promise<SavantCodeToolOutput<'run_terminal_command'>> => {
    const safety = isReadonlyCommand(cmd)
    if (!safety.valid) {
      return [
        {
          type: 'json',
          value: {
            command: cmd,
            stdout: '',
            stderr: `run_readonly_command rejected: ${safety.reason}`,
            exitCode: 1,
          },
        },
      ]
    }
    const clientToolCall: ClientToolCall<'run_terminal_command'> = {
      toolName: 'run_terminal_command',
      toolCallId: toolCall.toolCallId,
      input: {
        command: cmd,
        mode: 'assistant',
        process_type: 'SYNC',
        timeout_seconds,
        cwd,
      },
    }
    return requestClientToolCall(clientToolCall)
  }

  if (isBatch) {
    const results: Array<SavantCodeToolOutput<'run_terminal_command'>[number]> =
      []
    for (const cmd of allCommands) {
      const out = await runOne(cmd)
      results.push(out[0])
    }
    return {
      output: [
        {
          type: 'json',
          value: {
            commands: allCommands,
            results: results.map((result) => result.value),
          },
        },
      ] as SavantCodeToolOutput<'run_readonly_command'>,
    }
  }

  return { output: await runOne(allCommands[0]) }
}) as SavantCodeToolHandlerFunction<'run_readonly_command'>
