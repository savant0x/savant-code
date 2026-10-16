import z from 'zod/v4'

import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'
import { terminalCommandOutputSchema } from './run-terminal-command'
import {
  DEFAULT_COMMAND_TIMEOUT_SECONDS,
  isValidCommandTimeoutSeconds,
} from '../../../util/command-execution'

import type { $ToolParams } from '../../constants'

const toolName = 'run_readonly_command'
const endsAgentStep = true
const inputSchema = z
  .object({
    command: z
      .string()
      .min(1, 'Command cannot be empty')
      .optional()
      .describe(
        "Read-only CLI command valid for the user's OS. Only non-destructive commands are allowed (e.g., typecheck, test, ls, grep, git status).",
      ),
    commands: z
      .array(z.string().min(1, 'Command cannot be empty'))
      .min(1, 'commands cannot be empty')
      .optional()
      .describe(
        'Run several read-only commands in one call. Each command is validated independently and results are returned in order. When provided, `command` is ignored.',
      ),
    cwd: z
      .string()
      .optional()
      .describe(
        'The working directory to run the command in. Default is the project root.',
      ),
    timeout_seconds: z
      .number()
      .refine(
        isValidCommandTimeoutSeconds,
        'Use -1 for no timeout or a finite nonnegative value within the timer range.',
      )
      .default(DEFAULT_COMMAND_TIMEOUT_SECONDS)
      .optional()
      .describe('Set to -1 for no timeout. Default 30'),
  })
  .describe(
    'Execute one or more read-only CLI commands from the project root. This tool works in any ECHO phase (including idle and red) but rejects commands that could mutate files or spawn sub-shells.',
  )

const description = [
  'Execute a read-only CLI command. This tool is available in every ECHO phase, including `idle` and `red`, but it only accepts non-destructive commands.',
  '',
  'Allowed uses:',
  '1. Running typechecks or build checks (e.g., `bun run typecheck`, `tsc --noEmit`).',
  '2. Running tests (e.g., `bun test`).',
  '3. Inspecting state with `rg`, `git status`, `git diff`, and `git log`; prefer glob and read_files for file discovery and paginated reads.',
  '4. Chaining read-only commands with `&&`; select the directory with cwd.',
  '5. Piping read-only commands with `|` — every pipe segment must itself be read-only.',
  'On Windows this runs in Bash, whose installation may lack GNU head, tail, wc, or find. Windows FIND is incompatible with GNU find. Use rg/glob/read_files instead of assuming those utilities exist. A nonzero rg search with no matches does not prove a tool defect.',
  '',
  'Working directory:',
  '- To run a command in a different directory, use the `cwd` parameter.',
  '- Do NOT use `cd ... && ...`; use `cwd` instead.',
  '- Example: `command: "bun run typecheck"`, `cwd: "sdk"`.',
  '',
  'FORBIDDEN — any command containing the following will be rejected:',
  '- Output redirection: `>`, `>>`',
  '- Command substitution: `$()`, backticks',
  '- OR-operator / statement chaining: `||`, `;`',
  '- Backgrounding: `&`',
  '- Destructive commands: `rm`, `mv`, `cp`, `chmod`, `chown`, `mkfs`, etc.',
  '- Shell interpreters and network tools: `sh`, `bash`, `zsh`, `curl`, `wget`, `ssh`, `eval`, `exec`, …',
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

export const batchReadonlyCommandOutputSchema = z.object({
  commands: z.array(z.string()),
  results: z.array(terminalCommandOutputSchema),
})

export const runReadonlyCommandParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(
    z.union([terminalCommandOutputSchema, batchReadonlyCommandOutputSchema]),
  ),
} satisfies $ToolParams
