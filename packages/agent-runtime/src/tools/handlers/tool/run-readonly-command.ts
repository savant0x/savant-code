import type { SavantCodeToolHandlerFunction } from '../handler-function-type';
import type { ClientToolCall, ClientToolName as _ClientToolName, SavantCodeToolCall, SavantCodeToolOutput, } from '@savant-code/common/tools/list';
// FID-2026-0725-085 BUG-003: Denylist architecture replaces allowlist.
// A denylist blocks known-dangerous commands while allowing all others.
// This is more maintainable and doesn't break on new/OS-specific commands.
//
// Forbidden shell metacharacters/patterns that could enable command
// substitution, redirection, pipes, or backgrounding. Chaining with `&&` is
// permitted only after safe splitting and per-segment validation (see below).
// NOTE: Windows stderr redirections (2>nul, 2>&1) are explicitly permitted
// as they are read-only and standard diagnostic patterns.
const FORBIDDEN_METACHAR_REGEX = /[<>;|`$&]|\|\||\$\(/;
// Explicitly permitted Windows stderr redirections (read-only, diagnostic).
const WINDOWS_STDERR_REDIRECT_REGEX = /\b2>nul\b|\b2>&1\b/;
// Destructive filesystem commands that mutate state. These are rejected even
// when used without metacharacters (e.g. `rm -rf /`).
const DESTRUCTIVE_COMMAND_REGEX = /^\s*(rm|mv|cp|chmod|chown|mkdir|mkfs|dd|mount|umount|truncate|mkfifo|mknod|ln\s*-s?|rmdir|touch|tee\s*-?|shred|chattr|setfacl)\b/i;
// Mutating git operations. Read-only git (status, diff, log, show, branch, tag, remote) is allowed.
const GIT_MUTATING_REGEX = /^\s*git\s+(?:branch\s+-(?:D|d|M|m|--force|--move|--delete)|tag\s+-(?:d|delete|--delete)|remote\s+(?:add|remove|rename|prune|set-url)|(?:checkout|reset|rm|mv|merge|rebase|cherry-pick|revert|apply|am|switch)\b|\S+\s+--output|--force\b)/i;
// Dangerous commands that could execute arbitrary code or access the network.
const DANGEROUS_COMMAND_REGEX = /^\s*(?:curl|wget|ssh|scp|rsync|nc|ncat|socat|telnet|eval|exec|source|\.\s|pip\s+install|npm\s+(?:install|publish|exec)|npx\s+(?!--version)|yarn\s+(?:add|remove|publish)|cargo\s+(?:install|publish)|go\s+run|python\s+-c|node\s+-e|deno\s+run)\b/i;
/**
 * Split a command on unquoted `&&` separators. Respects single quotes,
 * double quotes, and backslash escapes so that `echo "a && b"` is not split.
 */
function splitSafeAnd(command: string): string[] {
    const segments: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escapeNext = false;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i];
        const nextCh = command[i + 1];
        if (escapeNext) {
            current += ch;
            escapeNext = false;
            continue;
        }
        if (ch === '\\') {
            current += ch;
            escapeNext = true;
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            current += ch;
            continue;
        }
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            current += ch;
            continue;
        }
        if (!inSingle && !inDouble && ch === '&' && nextCh === '&') {
            segments.push(current);
            current = '';
            i++; // skip the second &
            continue;
        }
        current += ch;
    }
    segments.push(current);
    return segments;
}
/**
 * Mask quoted substrings in a command by replacing them with whitespace.
 * Used to detect forbidden metacharacters outside of quoted arguments.
 */
function maskQuoted(command: string): string {
    let masked = '';
    let inSingle = false;
    let inDouble = false;
    let escapeNext = false;
    for (const ch of command) {
        if (escapeNext) {
            masked += ch;
            escapeNext = false;
            continue;
        }
        if (ch === '\\') {
            masked += ch;
            escapeNext = true;
            continue;
        }
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            masked += ch;
            continue;
        }
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            masked += ch;
            continue;
        }
        if (inSingle || inDouble) {
            masked += ' ';
        }
        else {
            masked += ch;
        }
    }
    return masked;
}
function isReadonlyCommand(command: string): {
    valid: boolean;
    reason?: string;
} {
    const segments = splitSafeAnd(command);
    for (const rawSegment of segments) {
        const segment = rawSegment.trim();
        if (segment.length === 0) {
            return {
                valid: false,
                reason: 'Command contains an empty segment (dangling, leading, or consecutive `&&`). Use run_terminal_command in green/audit phase for complex command chains.',
            };
        }
        const masked = maskQuoted(segment);
        // Check for forbidden metacharacters, but allow Windows stderr redirections
        // (2>nul, 2>&1) which are read-only diagnostic patterns.
        if (FORBIDDEN_METACHAR_REGEX.test(masked) && !WINDOWS_STDERR_REDIRECT_REGEX.test(segment)) {
            return {
                valid: false,
                reason: 'Command contains forbidden shell metacharacters (redirection, pipes, command substitution, backgrounding, or `||`). Use run_terminal_command in green/audit phase for complex commands.',
            };
        }
        // Denylist checks: block known-dangerous commands
        if (DESTRUCTIVE_COMMAND_REGEX.test(segment)) {
            return {
                valid: false,
                reason: 'Command is a destructive filesystem operation. Use run_terminal_command in green/audit phase for destructive commands.',
            };
        }
        if (GIT_MUTATING_REGEX.test(segment)) {
            return {
                valid: false,
                reason: 'Git invocation contains mutating flags (delete/remove/reset/checkout/etc). Use run_terminal_command in green/audit phase for mutating git operations.',
            };
        }
        if (DANGEROUS_COMMAND_REGEX.test(segment)) {
            return {
                valid: false,
                reason: 'Command could execute arbitrary code or access the network. Use run_terminal_command in green/audit phase for such commands.',
            };
        }
        // All other commands are allowed (denylist architecture).
        // This includes: findstr, Windows diagnostic tools, any command not in the denylist.
    }
    return { valid: true };
}
// run_readonly_command is not a ClientToolName, so its handler function type
// does not expose requestClientToolCall. We still delegate to the client tool
// run_terminal_command at runtime, which requires an explicit cast.
// run_readonly_command is not a ClientToolName (it performs server-side
// validation first), but it delegates to run_terminal_command, which IS a
// ClientToolName. The runtime passes requestClientToolCall to every handler,
// so we cast to SavantCodeToolHandlerFunction to keep the public signature
// simple while still using the run_terminal_command client tool internally.
export const handleRunReadonlyCommand = (async ({ previousToolCallFinished, toolCall, requestClientToolCall, }: {
    previousToolCallFinished: Promise<void>;
    toolCall: SavantCodeToolCall<'run_readonly_command'>;
    requestClientToolCall: (toolCall: ClientToolCall<'run_terminal_command'>) => Promise<SavantCodeToolOutput<'run_terminal_command'>>;
}) => {
    const { command, cwd, timeout_seconds } = toolCall.input;
    const safety = isReadonlyCommand(command);
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
        };
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
    };
    await previousToolCallFinished;
    return { output: await requestClientToolCall(clientToolCall) };
}) as SavantCodeToolHandlerFunction<'run_readonly_command'>;
