import {
  getCurrentSchedule,
  parseCadence,
  setLoopActiveState,
  startLoop,
} from '../hooks/use-loop-scheduler'
import { getSystemMessage, getUserMessage } from '../utils/message-history'

import type { CommandResult, RouterParams } from './command-registry'

/**
 * /loop — Run a prompt on a cadence schedule.
 *
 * Usage:
 *   /loop <cadence> <prompt>   — Start a loop with cadence
 *   /loop stop                  — Stop the active loop
 *   /loop status                — Show loop status
 *
 * Cadence options: Ns (seconds), Nm (minutes), Nh (hourly), Nd (daily)
 *
 * Examples:
 *   /loop 1d "scan for dependency vulnerabilities and create a PR if found"
 *   /loop 1h "check if the build is green and report status"
 *   /loop 5m "watch for new issues in the backlog and triage them"
 *   /loop stop
 *   /loop status
 *
 * The loop is NOT GitHub-specific — it uses terminal/MCP tools and persists
 * state via the existing session DB. No webhooks, no Actions, no external deps.
 */
export async function handleLoopCommand(
  params: RouterParams,
  args: string,
): Promise<CommandResult> {
  const trimmed = args.trim()

  // Handle subcommands
  if (trimmed === 'stop' || trimmed === 'cancel') {
    return handleLoopStop(params)
  }

  if (trimmed === 'status') {
    return handleLoopStatus(params)
  }

  // Parse cadence and prompt
  const firstSpace = trimmed.indexOf(' ')
  if (firstSpace === -1) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Usage: /loop <cadence> <prompt>\n\nCadence: 30s (seconds), 5m (minutes), 1h (hourly), 1d (daily)\n\nExamples:\n  /loop 1d "scan for dependency vulnerabilities"\n  /loop 1h "check staging for errors"\n  /loop stop\n  /loop status',
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }

  const cadenceStr = trimmed.slice(0, firstSpace).trim()
  const prompt = trimmed.slice(firstSpace + 1).trim()

  if (!prompt) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        'Usage: /loop <cadence> <prompt>\n\nExample: /loop 1h "check staging for errors and log findings"',
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }

  const cadence = parseCadence(cadenceStr)
  if (!cadence) {
    params.setMessages((prev) => [
      ...prev,
      getSystemMessage(
        `Invalid cadence: "${cadenceStr}"\n\nValid formats: 30s (seconds), 5m (minutes), 1h (hourly), 1d (daily)`,
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    params.setInputValue({
      text: '',
      cursorPosition: 0,
      lastEditDueToNav: false,
    })
    return
  }

  // Schedule recurring execution. startLoop sets isActive internally.
  startLoop(cadence.intervalMs, cadence.label, prompt)

  // Execute the first run immediately
  params.setMessages((prev) => [
    ...prev,
    getUserMessage(`/loop ${cadence.label} ${prompt}`),
    getSystemMessage(
      `🔄 Loop started: ${cadence.label} cadence\n"${prompt}"\n\nFirst run executing now. Agent will park after completion and resume at the next cadence.\n\nUse /loop stop to cancel. Use /loop status to check state.`,
    ),
  ])

  params.saveToHistory(`/loop ${cadence.label} ${prompt}`)
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  setTimeout(() => {
    params.scrollToLatest()
  }, 0)

  return
}

/**
 * Stop the active loop.
 */

function handleLoopStop(params: RouterParams): CommandResult {
  setLoopActiveState(false)

  params.setMessages((prev) => [
    ...prev,
    getUserMessage('/loop stop'),
    getSystemMessage(
      '⏹️ Loop stopped. Agent will not resume at the next cadence.',
    ),
  ])
  params.saveToHistory('/loop stop')
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  return
}

/**
 * Show current loop status.
 */
function handleLoopStatus(params: RouterParams): CommandResult {
  const schedule = getCurrentSchedule()
  let message: string
  if (schedule && schedule.isActive) {
    const timeUntilNext = Math.max(0, schedule.nextRunAt - Date.now())
    const minutes = Math.floor(timeUntilNext / 60_000)
    const seconds = Math.floor((timeUntilNext % 60_000) / 1000)
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
    message = [
      '📊 Loop Status:',
      `  Cadence: ${schedule.cadenceLabel}`,
      `  Next run: in ${timeStr}`,
      `  Runs completed: ${schedule.runCount}`,
      `  Last run: ${schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : 'never'}`,
      `  Status: ${
        schedule.lastRunSuccess === undefined
          ? '⏳ pending'
          : schedule.lastRunSuccess
            ? '✅ success'
            : '❌ failed'
      }`,
      '',
      'Use /loop stop to cancel.',
    ].join('\n')
  } else {
    message =
      '📊 No active loops. Use /loop <cadence> <prompt> to start a loop.\n\nExample: /loop 1d "scan for dependency vulnerabilities"'
  }
  params.setMessages((prev) => [
    ...prev,
    getUserMessage('/loop status'),
    getSystemMessage(message),
  ])
  params.saveToHistory('/loop status')
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

  return
}
