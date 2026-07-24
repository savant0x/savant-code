import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  ClientToolCall,
  ClientToolName,
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'

// Forbidden shell metacharacters/patterns that could enable command
// substitution, redirection, pipes, or backgrounding. Chaining with `&&` is
// permitted only after safe splitting and per-segment validation (see below).
const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/

// Destructive filesystem commands that mutate state. These are rejected even
// when used without metacharacters (e.g. `rm -rf /`).
const DESTRUCTIVE_COMMAND_REGEX =
  /^\s*(rm|mv|cp|chmod|chown|mkdir|mkfs|dd|mount|umount|truncate|mkfifo|mknod|ln\s*-s?|rmdir|touch|tee\s*-?|shred|chattr|setfacl)\b/i

// Commands that are clearly read-only and useful for diagnostics.
// NOTE: This is an allow-list. Tools that can mutate files or execute
// arbitrary code (e.g. `sed -i`, `awk 'system(...)'`, `code`, editors) are
// intentionally excluded even though they can be used read-only.
const READONLY_COMMAND_ALLOW_REGEX =
  /^\s*(?:bun\s+(?:run\s+typecheck|run\s+test|test|x?eslint|x?prettier\s+--check)|tsc\s+--noEmit|git\s+(?:status|diff|log|show|branch|tag|remote|config\s+-{0,2}list|rev-parse)|ls|ll|dir|cd|cat|head|tail|less|more|grep|rg|find|fd|pwd|echo|printf|which|where|whoami|uname|node\s+--version|npm\s+-v|bun\s+-v|python\s+--version|go\s+version|rustc\s+--version|wc|jq|yq|column|tree|du\s+-|df\s+-|free|top\s+-|ps\s+|date|env|printenv)\b/i

// git subcommands are allowed, but some flags mutate state. Reject those.
const GIT_DESTRUCTIVE_FLAG_REGEX =
  /^\s*git\s+(?:branch\s+-(?:D|d|M|m|--force|--move|--delete)|tag\s+-(?:d|delete|--delete)|remote\s+(?:add|remove|rename|prune|set-url)|(?:checkout|reset|rm|mv|merge|rebase|cherry-pick|revert|apply|am|switch)\b|\S+\s+--output|--force\b)/i

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
 * Mask quoted substrings in a command by replacing them with whitespace.
 * Used to detect forbidden metacharacters outside of quoted arguments.
 */
function maskQuoted(command: string): string {
  let masked = ''
  let inSingle = false
  let inDouble = false
  let escapeNext = false

  for (const ch of command) {
    if (escapeNext) {
      masked += ch
      escapeNext = false
      continue
    }

    if (ch === '\\') {
      masked += ch
      escapeNext = true
      continue
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      masked += ch
      continue
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      masked += ch
      continue
    }

    if (inSingle || inDouble) {
      masked += ' '
    } else {
      masked += ch
    }
  }

  return masked
}

function isReadonlyCommand(command: string): {
  valid: boolean
  reason?: string
} {
  const segments = splitSafeAnd(command)

  for (const rawSegment of segments) {
    const segment = rawSegment.trim()

    if (segment.length === 0) {
      return {
        valid: false,
        reason:
          'Command contains an empty segment (dangling, leading, or consecutive `&&`). Use run_terminal_command in green/audit phase for complex command chains.',
      }
    }

    const masked = maskQuoted(segment)

    if (FORBIDDEN_METACHAR_REGEX.test(masked)) {
      return {
        valid: false,
        reason:
          'Command contains forbidden shell metacharacters (redirection, pipes, command substitution, backgrounding, or `||`). Use run_terminal_command in green/audit phase for complex commands.',
      }
    }

    if (DESTRUCTIVE_COMMAND_REGEX.test(segment)) {
      return {
        valid: false,
        reason:
          'Command is a destructive filesystem operation. Use run_terminal_command in green/audit phase for destructive commands.',
      }
    }

    if (GIT_DESTRUCTIVE_FLAG_REGEX.test(segment)) {
      return {
        valid: false,
        reason:
          'Git invocation contains destructive flags (delete/remove/reset/checkout/etc). Use run_terminal_command in green/audit phase for mutating git operations.',
      }
    }

    if (!READONLY_COMMAND_ALLOW_REGEX.test(segment)) {
      return {
        valid: false,
        reason:
          'Command is not recognized as a read-only diagnostic command. If you need to run it, use run_terminal_command in green/audit phase.',
      }
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
  const { command, cwd, timeout_seconds } = toolCall.input

  const safety = isReadonlyCommand(command)
  if (!safety.valid) {
    return {
      output: [
        {
          type: 'json',
          value: {
            command,
            stdout: '',
            stderr: `run_readonly_command rejected: ${safety.reason}`,
            exitCode: 1,
          },
        },
      ] as SavantCodeToolOutput<'run_readonly_command'>,
    }
  }

  const clientToolCall: ClientToolCall<'run_terminal_command'> = {
    toolName: 'run_terminal_command',
    toolCallId: toolCall.toolCallId,
    input: {
      command,
      mode: 'assistant',
      process_type: 'SYNC',
      timeout_seconds,
      cwd,
    },
  }

  await previousToolCallFinished
  return { output: await requestClientToolCall(clientToolCall) }
}) as SavantCodeToolHandlerFunction<'run_readonly_command'>
