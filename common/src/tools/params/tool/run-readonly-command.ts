import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'
import { terminalCommandOutputSchema } from './run-terminal-command'

import type { $ToolParams } from '../../constants'

const toolName = 'run_readonly_command'
const endsAgentStep = true
const inputSchema = z
  .object({
    command: z
      .string()
      .min(1, 'Command cannot be empty')
      .describe(
        "Read-only CLI command valid for the user's OS. Only non-destructive commands are allowed (e.g., typecheck, test, ls, grep, git status).",
      ),
    cwd: z
      .string()
      .optional()
      .describe(
        'The working directory to run the command in. Default is the project root.',
      ),
    timeout_seconds: z
      .number()
      .default(30)
      .optional()
      .describe('Set to -1 for no timeout. Default 30'),
  })
  .describe(
    'Execute a read-only CLI command from the project root. This tool works in any ECHO phase (including idle and red) but rejects commands that could mutate files or spawn sub-shells.',
  )

const description = [
  'Execute a read-only CLI command. This tool is available in every ECHO phase, including `idle` and `red`, but it only accepts non-destructive commands.',
  '',
  'Allowed uses:',
  '1. Running typechecks or build checks (e.g., `bun run typecheck`, `tsc --noEmit`).',
  '2. Running tests (e.g., `bun test`).',
  '3. Inspecting state with commands like `ls`, `cat`, `grep`, `find`, `git status`, `git diff`, `git log`.',
  '4. Chaining read-only commands with `&&` (e.g., `cd sdk && bun run typecheck`).',
  '',
  'Working directory:',
  '- To run a command in a different directory, use the `cwd` parameter.',
  '- Do NOT use `cd ... && ...`; use `cwd` instead.',
  '- Example: `command: "bun run typecheck"`, `cwd: "sdk"`.',
  '',
  'FORBIDDEN — any command containing the following will be rejected:',
  '- Output redirection: `>`, `>>`',
  '- Command substitution: `$()`, backticks',
  '- Pipes: `|`',
  '- Command chaining: `;`, `||`',
  '- Backgrounding: `&`',
  '- Destructive commands: `rm`, `mv`, `cp`, `chmod`, `chown`, `mkfs`, etc.',
  '',
  'Do NOT use this tool to create, edit, move, or delete files. Use `run_terminal_command` in `green` or `audit` phase for destructive operations.',
  '',
  'Example:',
  `${$getNativeToolCallExampleString({
    toolName,
    inputSchema,
    input: {
      command: 'bun run typecheck',
      cwd: 'sdk',
    },
    endsAgentStep,
  })}`,
].join('\n')

export const runReadonlyCommandParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(terminalCommandOutputSchema),
} satisfies $ToolParams
