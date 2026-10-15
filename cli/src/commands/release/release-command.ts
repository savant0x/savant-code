// `/release` slash command (interactive chat streaming) and the standalone
// `savant-code release <op>` subcommand. Both share the pure core in
// `./release-runner`; only the output surface differs (chat bubbles vs
// stdout/stderr). The actual release work always runs the canonical
// `scripts/public-release.ts` engine via spawnReleaseScript.

import {
  RELEASE_COMMAND_DIAGNOSE,
  RELEASE_COMMAND_PREVIEW,
  RELEASE_COMMAND_STATUS,
  buildReleaseCommandLine,
  getReleaseStatus,
  normalizeReleaseCommand,
  releaseScriptFlags,
  resolveReleaseRoot,
  spawnReleaseScript,
  type ReleaseCommand,
} from './release-runner'
import {
  buildBashHistoryMessages,
  createRunTerminalToolResult,
} from '../../utils/bash-messages'
import { getSystemMessage } from '../../utils/message-history'
import { clearInput, resetUiToIdleAfterSlashCommand } from '../command-shared'

import type { RouterParams } from '../command-registry'

export const RELEASE_USAGE = [
  'Release command flow (drives scripts/public-release.ts):',
  '',
  '  /release preview    read-only sanity check (repo identity, versions, changelog, auth)',
  '  /release diagnose   read-only 8-gate manifest with evidence (investigate failures)',
  '  /release go         full release: gates → tag → push → GitHub release → npm publish',
  '  /release resume     continue a recorded partial release after a failure',
  '  /release status     show version, git position, tag, last receipt + diagnostic evidence',
  '',
  'Aliases: /release run, /release release, /release diagnostic, /release continue, /release check',
].join('\n')

/**
 * Interactive handler: streams the release engine output into a running
 * assistant tool message and finishes with a compact summary bubble.
 */
export async function handleReleaseCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)

  const op = normalizeReleaseCommand(args)
  if (!op) {
    postMessage(
      params,
      `Unknown release operation${args.trim() ? `: \`${args.trim()}\`` : ''}.`,
      RELEASE_USAGE,
    )
    return
  }

  const root = resolveReleaseRoot(process.cwd())
  if (!root) {
    postMessage(
      params,
      'Release commands must run inside the savant-code repository.',
      'Expected to find scripts/public-release.ts by walking up from the current directory.',
    )
    return
  }

  if (op === RELEASE_COMMAND_STATUS) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(getReleaseStatus({ root })),
    ])
    return
  }

  // Running operation: render a bash-style tool message that streams output.
  const command = buildReleaseCommandLine(op)
  const { assistantMessage, toolCallId } = buildBashHistoryMessages({
    command,
    cwd: root,
    output: '⏳ Running…',
  })
  params.setMessages((prev) => [...prev, assistantMessage])

  let stdout = ''
  let stderr = ''
  let lastPaint = 0
  const rawOutput = () => `${stdout}${stderr ? `\n[stderr]\n${stderr}` : ''}`

  const paint = (final: boolean, exitCode?: number) => {
    const now = Date.now()
    if (!final && now - lastPaint < 150) return
    lastPaint = now
    const toolOutput = final
      ? JSON.stringify(
          createRunTerminalToolResult({
            command,
            cwd: root,
            stdout: stdout || null,
            stderr: stderr || null,
            exitCode: exitCode ?? 0,
          }),
        )
      : rawOutput() || '⏳ Running…'
    params.setMessages((prev) =>
      prev.map((msg) => {
        if (!msg.blocks) return msg
        let didUpdate = false
        const blocks = msg.blocks.map((block) => {
          if ('toolCallId' in block && block.toolCallId === toolCallId) {
            didUpdate = true
            return { ...block, output: toolOutput }
          }
          return block
        })
        return didUpdate ? { ...msg, blocks, isComplete: final } : msg
      }),
    )
  }

  try {
    const result = await spawnReleaseScript({
      root,
      command,
      flags: releaseScriptFlags(op),
      onOutput: (chunk, stream) => {
        if (stream === 'stdout') stdout += chunk
        else stderr += chunk
        paint(false)
      },
    })
    paint(true, result.exitCode)
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(buildReleaseSummary(op, command, result.exitCode)),
    ])
  } catch (error) {
    paint(true, 1)
    postMessage(
      params,
      `Release ${op} could not start.`,
      error instanceof Error ? error.message : String(error),
    )
  }
  // FID-2026-0718-010 D3: async slash-command bridges restore the idle state
  // after completion so the input/status UI returns to normal.
  resetUiToIdleAfterSlashCommand()
}

function postMessage(
  params: RouterParams,
  headline: string,
  detail?: string,
): void {
  params.setMessages((prev) => [
    ...prev,
    getSystemMessage(`${headline}${detail ? `\n\n${detail}` : ''}`),
  ])
}

function buildReleaseSummary(
  op: ReleaseCommand,
  command: string,
  exitCode: number,
): string {
  if (exitCode === 0) {
    return `✅ \`${command}\` finished successfully (exit 0).\n\nNext: \`/release status\` to confirm the receipt, then \`/release go\` for the full publish (or \`/release resume\` after a failure).`
  }
  const investigate =
    op === RELEASE_COMMAND_DIAGNOSE
      ? 'The diagnostic wrote evidence — read the receipt/transcript paths printed above.'
      : op === RELEASE_COMMAND_PREVIEW
        ? 'Preview failed without changing anything — fix the reported issue and re-run.'
        : 'The release stopped at the failed stage and was recorded in a receipt. Investigate with `/release diagnose`, then `/release resume`.'
  return `❌ \`${command}\` failed (exit ${exitCode}).\n\n${investigate}`
}

/**
 * Standalone subcommand surface: `savant-code release <op>`.
 * Streams the engine output to stdout/stderr and returns the process exit
 * code (0 = ok, 1 = release failure, 2 = usage error).
 */
/* eslint-disable no-console -- standalone release subcommand writes its
   transcript and result to stdout/stderr by contract (mirrors headless-run). */
export async function runStandaloneRelease(op?: string): Promise<number> {
  const root = resolveReleaseRoot(process.cwd())
  if (!root) {
    console.error(
      'release: not inside the savant-code repository (scripts/public-release.ts not found).',
    )
    return 2
  }
  if (!op) {
    console.error(RELEASE_USAGE)
    return 2
  }
  const command = normalizeReleaseCommand(op)
  if (!command) {
    console.error(`release: unknown operation "${op}"`)
    console.error(RELEASE_USAGE)
    return 2
  }
  if (command === RELEASE_COMMAND_STATUS) {
    console.log(getReleaseStatus({ root }))
    return 0
  }

  const commandLine = buildReleaseCommandLine(command)
  console.log(`▶ ${commandLine}`)
  console.log(`  (working directory: ${root})`)
  try {
    const result = await spawnReleaseScript({
      root,
      command: commandLine,
      flags: releaseScriptFlags(command),
      onOutput: (chunk, stream) => process[stream].write(chunk),
    })
    if (result.exitCode === 0) {
      console.log(`\n✅ ${commandLine} finished (exit 0)`)
      return 0
    }
    console.error(`\n❌ ${commandLine} failed (exit ${result.exitCode})`)
    return 1
  } catch (error) {
    console.error(
      `\n❌ ${commandLine} could not start: ${error instanceof Error ? error.message : String(error)}`,
    )
    return 1
  }
}
