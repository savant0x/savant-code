import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'

import { Argument, Command } from 'commander'

import { IS_SAVANT_FREE, type AgentMode } from './utils/constants'
import { getCliEnv } from './utils/env'

const require = createRequire(import.meta.url)

export type ParsedArgs = {
  initialPrompt: string | null
  command?: string
  agent?: string
  clearLogs: boolean
  continue: boolean
  continueId?: string | null
  cwd?: string
  initialMode?: AgentMode
}

export function loadPackageVersion(): string {
  const env = getCliEnv()
  if (env.SAVANT_CODE_CLI_VERSION) {
    return env.SAVANT_CODE_CLI_VERSION
  }

  try {
    const pkg = require('../package.json') as { version?: string }
    if (pkg.version) {
      return pkg.version
    }
  } catch {
    // Continue to dev fallback
  }

  return 'dev'
}

export function parseArgs({
  argv = process.argv,
  isSavantFree = IS_SAVANT_FREE,
  version = loadPackageVersion(),
}: {
  argv?: string[]
  isSavantFree?: boolean
  version?: string
} = {}): ParsedArgs {
  const program = new Command()

  if (isSavantFree) {
    // SavantFree: simplified CLI - no prompt args, no agent override, no clear-logs
    program
      .name('savant-free')
      .description('SavantFree - Free AI coding assistant')
      .version(version, '-v, --version', 'Print the CLI version')
      .option(
        '--continue [conversation-id]',
        'Continue from a previous conversation (optionally specify a conversation id)',
      )
      .option(
        '--cwd <directory>',
        'Set the working directory (default: current directory)',
      )
      .addArgument(
        new Argument('[command]', 'Command to run').choices(['login']),
      )
      .helpOption('-h, --help', 'Show this help message')
  } else {
    // SavantCode: full CLI with all options
    program
      .name('savant-code')
      .description('SavantCode CLI - AI-powered coding assistant')
      .version(version, '-v, --version', 'Print the CLI version')
      .option(
        '--agent <agent-id>',
        'Run a specific agent id (skips loading local .agents overrides)',
      )
      .option(
        '--clear-logs',
        'Remove any existing CLI log files before starting',
      )
      .option(
        '--continue [conversation-id]',
        'Continue from a previous conversation (optionally specify a conversation id)',
      )
      .option(
        '--cwd <directory>',
        'Set the working directory (default: current directory)',
      )
      .option(
        '--prompt-file <path>',
        'Read the initial prompt from a file instead of argv',
      )
      .option('--edit', 'Start in EDIT mode (default)')
      .option('--scaffold', 'Start in SCAFFOLD mode')
      .option('--analyze', 'Start in ANALYZE mode')
      .addHelpText(
        'after',
        '\nCommands:\n  login                          Log in to your account\n  publish                        Publish agents to the registry',
      )
      .helpOption('-h, --help', 'Show this help message')
      .argument('[prompt...]', 'Initial prompt to send to the agent')
      .allowExcessArguments(true)
  }

  program.parse(argv)

  const options = program.opts()
  const args = program.args

  const continueFlag = options.continue

  // Resolve the initial prompt from argv or a prompt file. A prompt file is
  // useful for very large prompts that exceed comfortable argv limits or
  // contain shell-sensitive characters. Resolve relative paths against the
  // user's current working directory. If the file is missing and the CLI is
  // running from a nested workspace directory (e.g. `bun --cwd cli dev`),
  // fall back to the parent directory so project-root paths still work.
  let initialPrompt: string | null = null
  if (!isSavantFree) {
    if (options.promptFile) {
      const promptFile = options.promptFile as string
      const resolvePromptFile = (): string => {
        if (path.isAbsolute(promptFile)) return promptFile
        const cwdPath = path.resolve(process.cwd(), promptFile)
        if (fs.existsSync(cwdPath)) return cwdPath
        const parentPath = path.resolve(process.cwd(), '..', promptFile)
        if (fs.existsSync(parentPath)) return parentPath
        return cwdPath
      }
      initialPrompt = fs.readFileSync(resolvePromptFile(), 'utf8')
    } else if (args.length > 0) {
      initialPrompt = args.join(' ')
    }
  }

  // Determine initial mode from flags (last flag wins if multiple specified)
  let initialMode: AgentMode | undefined
  if (isSavantFree) {
    initialMode = 'EDIT'
  } else {
    if (options.edit) initialMode = 'EDIT'
    if (options.scaffold) initialMode = 'SCAFFOLD'
    if (options.analyze) initialMode = 'ANALYZE'
  }

  return {
    initialPrompt,
    command: args[0],
    agent: options.agent,
    clearLogs: options.clearLogs || false,
    continue: Boolean(continueFlag),
    continueId:
      typeof continueFlag === 'string' && continueFlag.trim().length > 0
        ? continueFlag.trim()
        : null,
    cwd: options.cwd,
    initialMode,
  }
}
