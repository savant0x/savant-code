import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'

import { Argument, Command } from 'commander'

import { IS_SAVANT_FREE, type AgentMode } from './utils/constants'
import { getCliEnv } from './utils/env'

import type { PermissionMode } from './utils/settings'

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
  initialPermissionMode?: PermissionMode
  /** FID-2026-0806-011: run the prompt headlessly and print the result to stdout. */
  print: boolean
  /** Versioned design-authoring JSON path, or '-' for stdin. */
  designInput?: string
  /** FID-2026-0818-002: Auto Drive goal (non-TUI entry; routed per child 008). */
  auto?: string
  /** FID-2026-0818-002: spec file content that skips the Auto Drive interview. */
  spec?: string
  /** FID-2026-0818-008: operator-reviewed plan artifact to execute headlessly. */
  planFile?: string
  /** FID-2026-0818-008: explicit non-interactive approval signal. */
  approve: boolean
  /** FID-2026-0818-008: emit the plan and exit 0 without executing. */
  planOnly: boolean
  /** FID-2026-0820-008: `server` subcommand ephemeral port (--port=<n>). */
  port?: number
}

/**
 * Resolve a CLI-supplied file path against cwd, falling back to the parent
 * (project root) for nested-workspace invocations. Shared by `--prompt-file`
 * and `--spec` (Law 13 — one resolution rule).
 */
function resolveCliFilePath(filePath: string): string {
  if (path.isAbsolute(filePath)) return filePath
  const cwdPath = path.resolve(process.cwd(), filePath)
  if (fs.existsSync(cwdPath)) return cwdPath
  const parentPath = path.resolve(process.cwd(), '..', filePath)
  if (fs.existsSync(parentPath)) return parentPath
  return cwdPath
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
      .option(
        '--auto <goal>',
        'Start Auto Drive: clarify, plan, and approve a goal, then run it to completion',
      )
      .option(
        '--spec <path>',
        'Use a spec file as the Auto Drive spec input (skips the interview)',
      )
      .option(
        '--plan-file <path>',
        'Execute an operator-reviewed Auto Drive plan headlessly',
      )
      .option(
        '--approve',
        'Approve the Auto Drive goal + resolution policy up front (non-interactive Law 2)',
      )
      .option(
        '--plan-only',
        'Generate the Auto Drive plan and exit without executing (for review)',
      )
      .option(
        '--port <number>',
        'Server subcommand: bind this port (default: ephemeral)',
      )
      .option(
        '--print',
        'Run the prompt headlessly and print the final answer to stdout (non-zero exit on failure)',
      )
      .option(
        '--design-input <path>',
        'Create or update a design system from versioned JSON at a path, or - for stdin',
      )
      .option('--edit', 'Start in HYBRID mode (default; legacy flag name)')
      .option('--scaffold', 'Start in SCAFFOLD mode')
      .option('--strict', 'Start in STRICT mode')
      .option('--analyze', 'Start in ANALYZE mode')
      .option(
        '--permission-mode <mode>',
        'Sandbox permission mode: safe, prompt, or unsafe (default: prompt)',
      )
      .addHelpText(
        'after',
        '\nCommands:\n  login                          Log in to your account\n  publish                        Publish agents to the registry\n  release <op>                    Run the public release flow (preview | diagnose | go | resume | status)\n  server                         Start the desktop session gateway (WebSocket JSON-RPC)',
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
      initialPrompt = fs.readFileSync(resolveCliFilePath(promptFile), 'utf8')
    } else if (args.length > 0) {
      initialPrompt = args.join(' ')
    }
  }

  // Determine initial mode from flags (last flag wins if multiple specified)
  let initialMode: AgentMode | undefined
  if (isSavantFree) {
    initialMode = 'HYBRID'
  } else {
    if (options.edit) initialMode = 'HYBRID'
    if (options.scaffold) initialMode = 'SCAFFOLD'
    if (options.strict) initialMode = 'STRICT'
    if (options.analyze) initialMode = 'ANALYZE'
  }

  // Validate and normalize --permission-mode (last flag wins)
  let initialPermissionMode: PermissionMode | undefined
  if (options.permissionMode) {
    const normalized = String(options.permissionMode).toLowerCase()
    if (
      normalized === 'safe' ||
      normalized === 'prompt' ||
      normalized === 'unsafe'
    ) {
      initialPermissionMode = normalized
    }
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
    initialPermissionMode,
    print: options.print || false,
    designInput:
      typeof options.designInput === 'string' ? options.designInput : undefined,
    auto: typeof options.auto === 'string' ? options.auto : undefined,
    spec:
      typeof options.spec === 'string'
        ? fs.readFileSync(resolveCliFilePath(options.spec), 'utf8')
        : undefined,
    planFile:
      typeof options.planFile === 'string' ? options.planFile : undefined,
    approve: options.approve === true,
    planOnly: options.planOnly === true,
    port:
      typeof options.port === 'string' && options.port.trim().length > 0
        ? Number(options.port)
        : undefined,
  }
}
