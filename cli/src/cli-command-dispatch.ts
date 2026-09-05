import { isCI } from '@savant-code/common/env-ci'
import { red } from 'picocolors'

import { runStandaloneRelease } from './commands/release/release-command'
import { normalizeReleaseCommand } from './commands/release/release-runner'
import { runHeadlessPrint } from './headless-run'
import { runPlainLogin } from './login/plain-login'
import { getProjectRoot } from './project-files'
import { runServerCommand } from './server-command'
import { runHeadlessAutoDrive } from './utils/auto-drive-headless'
import { initializeAgentRegistry } from './utils/local-agent-registry'
import { readStdin } from './utils/read-stdin'

import type { parseArgs } from './cli-args'

/**
 * Command + headless dispatch (FID-2026-0819-005 Loop 133): the login,
 * release, `--auto`, and `--print`/piped-stdin/CI branches. Moved verbatim
 * from the CLI entrypoint in the original evaluation order. Returns true
 * when the invocation was handled (the caller must return without entering
 * the TUI — the login branch returns; every other handled branch terminates
 * the process). Returns false when the invocation falls through to the
 * interactive path.
 */
export async function dispatchCommandsAndHeadless(
  args: ReturnType<typeof parseArgs>,
): Promise<boolean> {
  const {
    initialPrompt,
    command,
    agent,
    allowedTools,
    continue: continueChat,
    continueId,
    print,
    auto,
    spec,
    planFile,
    approve,
    planOnly,
  } = args
  const hasAgentOverride = Boolean(agent?.trim())
  const isLoginCommand = command === 'login'
  const isReleaseCommand = command === 'release'
  const isServerCommand = command === 'server'

  // FID-2026-0820-008: the `server` subcommand starts the desktop session
  // gateway — a LONG-RUNNING third headless mode (not one-shot like --print/
  // --auto). It must be handled before the generic non-TTY routing below so a
  // sidecar spawned with piped stdin is not mistaken for a headless prompt.
  // Returns true after starting; the process stays alive until the stdin
  // watchdog (parent death) or a stop signal terminates it.
  if (isServerCommand) {
    await runServerCommand({ port: args.port })
    return true
  }

  // Handle explicit command invocations before generic non-TTY routing.
  // Login is a command, not a prompt: in smoke tests, CI, and scripted shells
  // stdin is non-TTY, but that must not turn `savant-free login` into a
  // headless `--print` invocation.
  if (isLoginCommand && !print) {
    await runPlainLogin()
    return true
  }

  // Release command flow: `savant-code release <op>` runs the public release
  // engine standalone and exits with its result code.
  // Handled before the headless branch so scripted (non-TTY) invocations run
  // the release rather than being treated as a headless prompt.
  if (isReleaseCommand) {
    // parseArgs joins every positional arg into initialPrompt (including the
    // `release` word itself, e.g. `release status` → 'release status'), so the
    // operation is the first token after the command word. A bare `release`
    // shows usage; a known operation runs the release engine. Any other
    // first-word `release …` (e.g. a real prompt like "release the docs")
    // falls through to the normal prompt path instead of being hijacked.
    const releaseOp = initialPrompt?.trim().split(/\s+/).slice(1)[0]
    if (releaseOp === undefined || normalizeReleaseCommand(releaseOp)) {
      const exitCode = await runStandaloneRelease(releaseOp)
      process.exit(exitCode)
    }
  }

  // FID-2026-0818-008: Auto Drive headless entry. `--auto` is a headless mode
  // flag (the TUI `/auto` slash command is the interactive path, child 002) —
  // it runs the full drive cycle with no TUI and no runtime ask_user, emitting
  // an exit code as the completion certificate. Handled before the generic
  // `--print`/stdin/CI branch so an explicit `--auto` never falls through to
  // a single-turn print.
  if (auto !== undefined) {
    const result = await runHeadlessAutoDrive({
      goal: auto,
      spec,
      planFile,
      approve,
      planOnly,
      continueChat,
      continueId,
      projectRoot: getProjectRoot(),
    })
    if (result.output !== undefined) {
      // eslint-disable-next-line no-console -- headless stdout contract
      console.log(result.output)
    }
    if (result.error) {
      // eslint-disable-next-line no-console -- headless stderr contract
      console.error(red(`Error: ${result.error}`))
    }
    process.exit(result.exitCode)
  }

  // Headless / non-interactive mode (FID-2026-0806-011): explicit `--print`,
  // piped stdin, or CI. Runs a single prompt through the SDK and prints the
  // final answer to stdout, exiting non-zero on failure. Never enters the TUI
  // — a piped/scripted invocation that fails must not read as a hang.
  if (print || !process.stdin.isTTY || isCI()) {
    // Piped stdin: `echo "refactor this" | savant-code` uses stdin as the
    // prompt. Only read stdin when it is actually piped — with a TTY we never
    // get here unless --print was passed without a prompt, which is a usage
    // error handled below.
    let headlessPrompt = initialPrompt
    if (!headlessPrompt && !process.stdin.isTTY) {
      headlessPrompt = await readStdin()
    }

    // Local agent overrides only apply in interactive sessions; --agent is
    // honored in headless mode so scripted runs can pin an agent id.
    if (!hasAgentOverride) {
      await initializeAgentRegistry()
    }

    const result = await runHeadlessPrint({
      prompt: headlessPrompt ?? '',
      agentId: hasAgentOverride ? agent : undefined,
      allowedTools,
      continueChat,
      continueId,
    })

    if (result.output !== undefined) {
      // eslint-disable-next-line no-console -- headless stdout contract
      console.log(result.output)
    }
    if (result.error) {
      // eslint-disable-next-line no-console -- headless stderr contract
      console.error(red(`Error: ${result.error}`))
    }
    process.exit(result.exitCode)
  }

  return false
}
