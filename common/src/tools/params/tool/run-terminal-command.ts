import z from 'zod/v4'

import {
  DEFAULT_COMMAND_TIMEOUT_SECONDS,
  commandExecutionMetadataSchema,
  isValidCommandTimeoutSeconds,
} from '../../../util/command-execution'
import { $getNativeToolCallExampleString, jsonToolResultSchema } from '../utils'

import type { $ToolParams } from '../../constants'

export { commandExecutionMetadataSchema }

const commandOutputBaseSchema = z
  .object({
    command: z.string(),
    startingCwd: z.string().optional(),
    message: z.string().optional(),
    stderr: z.string().optional(),
    stdout: z.string().optional(),
    exitCode: z.number().optional(),
  })
  .extend(commandExecutionMetadataSchema.shape)

// Specific outcomes precede the broad shape so their fields survive parsing.
export const terminalCommandOutputSchema = z.union([
  commandOutputBaseSchema.extend({ errorMessage: z.string() }),
  commandOutputBaseSchema.extend({ stdoutOmittedForLength: z.literal(true) }),
  commandOutputBaseSchema.extend({
    processId: z.number(),
    backgroundProcessStatus: z.enum(['running', 'completed', 'error']),
  }),
  commandOutputBaseSchema,
])

/** Current repository/operator authority governs every version-control action. */
export const gitCommitGuidePrompt = [
  '### Using git to commit changes',
  'Review staged and unstaged changes and recent commit messages before committing.',
  "For approved work, use the project's standing local-commit authority; obey narrower explicit holds.",
  'Stage explicit owned paths and review the scoped staged diff. Never use global staging or commit -a during active sessions.',
  'Preserve unrelated operator work and check the staged diff for credentials.',
  'Create one logical, independently revertible commit per coherent change using the repository message convention and FID reference.',
  'Do not add agent signatures, generated-by footers or author attribution.',
  'Follow current project/operator authority for normal fast-forward pushes. Mandatory verification and credential gates remain active.',
  'Releases, publishing, deployment, tags and release artifacts require explicit operator approval. Never force-push or rewrite main.',
  'Do not alter git configuration or create empty commits. Use noninteractive commands and shell-appropriate quoting.',
].join('\n\n')

const toolName = 'run_terminal_command'
const endsAgentStep = true
const inputSchema = z
  .object({
    command: z
      .string()
      .min(1, 'Command cannot be empty')
      .describe('CLI command valid for the selected shell and user OS.'),
    process_type: z
      .enum(['SYNC'])
      .default('SYNC')
      .describe('Wait for completion and return the output.'),
    cwd: z
      .string()
      .optional()
      .describe('Working directory; defaults to the project root.'),
    timeout_seconds: z
      .number()
      .refine(
        isValidCommandTimeoutSeconds,
        'Use -1 for no timeout or a finite nonnegative value within the timer range.',
      )
      .default(DEFAULT_COMMAND_TIMEOUT_SECONDS)
      .optional()
      .describe('Timeout in seconds; -1 for no timeout. Default 30.'),
  })
  .describe('Execute a CLI command from the project root or an explicit cwd.')

const description = [
  'Run project builds, typechecks, tests and other commands within approved work.',
  'Commands use Bash. On Windows, Git Bash installations may lack GNU utilities such as head or find; use the file/search tools or an available executable instead of assuming the full GNU suite exists.',
  'Select the working directory relative to the project root. Do not infer shell syntax from the host OS alone.',
  'Check the exit status and stderr; silent successful static checks are valid, while a zero-test run is not verification.',
  'Follow the session automation level and current project/operator authority. In-scope reversible work and verification need no repeated approval when already authorized.',
  'Require explicit authorization for irreversible effects, production mutations and actions beyond the approved work.',
  'Treat paths outside the project as read-only unless explicitly authorized. Do not install global packages or widen credential access.',
  'Do not create or edit project files through shell scripts, redirection or inline transforms; use direct file-edit tools after reading each file completely.',
  'Use the project package manager and noninteractive options. Never bypass verification, sandbox, scope or credential gates.',
  gitCommitGuidePrompt,
  'Example:',
  $getNativeToolCallExampleString({
    toolName,
    inputSchema,
    input: { command: 'bun run typecheck' },
    endsAgentStep,
  }),
].join('\n\n')

export const runTerminalCommandParams = {
  toolName,
  endsAgentStep,
  description,
  inputSchema,
  outputSchema: jsonToolResultSchema(terminalCommandOutputSchema),
} satisfies $ToolParams
