import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { runTerminalCommand, buildChildEnv } from '@savant-code/sdk'

import { useChatStore } from '../../state/chat-store'
import { trackEvent } from '../../utils/analytics'
import {
  buildBashHistoryMessages,
  createRunTerminalToolResult,
} from '../../utils/bash-messages'

import type { RouterParams } from '../command-registry'

/**
 * Run a bash command with automatic ghost/direct mode selection.
 * Uses ghost mode when streaming or chain in progress, otherwise adds directly to chat history.
 */
export function runBashCommand(command: string) {
  const {
    streamingAgents,
    isChainInProgress,
    setMessages,
    addPendingBashMessage,
    updatePendingBashMessage,
  } = useChatStore.getState()

  const ghost = streamingAgents.size > 0 || isChainInProgress
  const id = crypto.randomUUID()
  const commandCwd = process.cwd()
  const startTime = Date.now()

  if (ghost) {
    // Ghost mode: add to pending messages
    addPendingBashMessage({
      id,
      command,
      stdout: '',
      stderr: '',
      exitCode: 0,
      isRunning: true,
      startTime: Date.now(),
      cwd: commandCwd,
    })
  } else {
    // Direct mode: add to chat history with placeholder output (user + assistant)
    const { assistantMessage } = buildBashHistoryMessages({
      command,
      cwd: commandCwd,
      toolCallId: id,
      output: '...',
    })
    setMessages((prev) => [...prev, assistantMessage])
  }

  // FID-2026-0919-008 (SEC-1): route through the SDK's allowlisted child-env
  // builder instead of handing the full process env (with every provider
  // credential) to the spawned shell as explicit overrides. Commands that
  // need extra vars fail fast with an obvious remediation; the model-facing
  // tool path applies the same policy.
  const env = buildChildEnv() as Record<string, string>

  runTerminalCommand({
    command,
    process_type: 'SYNC',
    cwd: commandCwd,
    timeout_seconds: -1,
    env,
  } as Parameters<typeof runTerminalCommand>[0])
    .then(([{ value }]) => {
      const stdout = 'stdout' in value ? value.stdout || '' : ''
      const stderr = 'stderr' in value ? value.stderr || '' : ''
      const exitCode = 'exitCode' in value ? (value.exitCode ?? 0) : 0

      // Track terminal command completion
      const durationMs = Date.now() - startTime
      trackEvent(AnalyticsEvent.TERMINAL_COMMAND_COMPLETED, {
        command: command.split(' ')[0], // Just the command name, not args
        exitCode,
        success: exitCode === 0,
        ghost,
        durationMs,
        hasStdout: stdout.length > 0,
        hasStderr: stderr.length > 0,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      })

      if (ghost) {
        updatePendingBashMessage(id, {
          stdout,
          stderr,
          exitCode,
          isRunning: false,
        })
      } else {
        const toolResultOutput = createRunTerminalToolResult({
          command,
          cwd: commandCwd,
          stdout: stdout || null,
          stderr: stderr || null,
          exitCode,
        })
        const outputJson = JSON.stringify(toolResultOutput)

        setMessages((prev) =>
          prev.map((msg) => {
            if (!msg.blocks) return msg
            let didUpdate = false
            const blocks = msg.blocks.map((block) => {
              if ('toolCallId' in block && block.toolCallId === id) {
                didUpdate = true
                return { ...block, output: outputJson }
              }
              return block
            })
            return didUpdate ? { ...msg, blocks, isComplete: true } : msg
          }),
        )

        // Also add to pending bash messages so the next user message includes this context for the LLM
        // Mark as already added to history to avoid duplicate UI entries
        addPendingBashMessage({
          id,
          command,
          stdout,
          stderr,
          exitCode,
          isRunning: false,
          cwd: commandCwd,
          addedToHistory: true,
        })
      }
    })
    .catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      // Track terminal command completion with error
      const durationMs = Date.now() - startTime
      trackEvent(AnalyticsEvent.TERMINAL_COMMAND_COMPLETED, {
        command: command.split(' ')[0], // Just the command name, not args
        exitCode: 1,
        success: false,
        ghost,
        durationMs,
        hasStdout: false,
        hasStderr: true,
        stdoutLength: 0,
        stderrLength: errorMessage.length,
        isException: true,
      })

      if (ghost) {
        updatePendingBashMessage(id, {
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
          isRunning: false,
        })
      } else {
        const errorToolResultOutput = createRunTerminalToolResult({
          command,
          cwd: commandCwd,
          stdout: null,
          stderr: null,
          exitCode: 1,
          errorMessage,
        })
        const errorOutputJson = JSON.stringify(errorToolResultOutput)

        setMessages((prev) =>
          prev.map((msg) => {
            if (!msg.blocks) return msg
            let didUpdate = false
            const blocks = msg.blocks.map((block) => {
              if ('toolCallId' in block && block.toolCallId === id) {
                didUpdate = true
                return { ...block, output: errorOutputJson }
              }
              return block
            })
            return didUpdate ? { ...msg, blocks, isComplete: true } : msg
          }),
        )

        // Also add to pending bash messages so the next user message includes this context for the LLM
        // Mark as already added to history to avoid duplicate UI entries
        addPendingBashMessage({
          id,
          command,
          stdout: '',
          stderr: errorMessage,
          exitCode: 1,
          isRunning: false,
          cwd: commandCwd,
          addedToHistory: true,
        })
      }
    })
}

/**
 * Add a completed bash command result to the chat message history.
 * Note: This is UI-only; we no longer send these commands to the AI context.
 */
export function addBashMessageToHistory(params: {
  command: string
  stdout: string
  stderr: string | null
  exitCode: number
  cwd: string
  setMessages: RouterParams['setMessages']
}) {
  const { command, stdout, stderr, exitCode, cwd, setMessages } = params
  const toolResultOutput = createRunTerminalToolResult({
    command,
    cwd,
    stdout: stdout || null,
    stderr: stderr ?? null,
    exitCode,
  })
  const toolCallId = crypto.randomUUID()
  const outputJson = JSON.stringify(toolResultOutput)
  const { assistantMessage } = buildBashHistoryMessages({
    command,
    cwd,
    toolCallId,
    output: outputJson,
    isComplete: true,
  })

  setMessages((prev) => [...prev, assistantMessage])
}
