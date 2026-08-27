import { runTerminalCommand } from '@savant-code/sdk'

import { WEBSITE_URL } from '../../login/constants'
import { startNewChat } from '../../project-files'
import { useChatStore } from '../../state/chat-store'
import { abortActiveRun } from '../../utils/active-run'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { safeOpen } from '../../utils/open-url'
import { capturePendingAttachments } from '../../utils/pending-attachments'
import { savePermissionModePreference } from '../../utils/settings'
import {
  clearInput,
  defineCommand,
  defineCommandWithArgs,
} from '../command-shared'
import { handleImageCommand } from '../image'
import { handleInitializationFlowLocally } from '../init'
import { handleRewindCommand } from '../rewind'
import { handleUsageCommand } from '../usage'

// Session/chat commands: permissions, rewind, verify, new, init, usage,
// subscribe, image. Split out of command-registry.ts (FID-2026-0805-003).
export const CHAT_COMMANDS = [
  defineCommandWithArgs({
    name: 'permissions',
    aliases: ['sandbox', 'safety'],
    handler: (params, args) => {
      const trimmedArgs = args.trim().toLowerCase()
      const currentMode = useChatStore.getState().permissionMode
      const validModes = ['safe', 'prompt', 'unsafe'] as const
      const modeDescriptions: Record<(typeof validModes)[number], string> = {
        safe: 'Risky tools are denied automatically.',
        prompt:
          'Risky tools are blocked; interactive prompts are not yet implemented, so they currently downgrade to deny.',
        unsafe: 'Risky tools are allowed. Use with caution.',
      }

      if (!trimmedArgs) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Current permission mode: **${currentMode}**\n\n${modeDescriptions[currentMode]}`,
          ),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      if (!validModes.includes(trimmedArgs as (typeof validModes)[number])) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Unknown permission mode: "${trimmedArgs}". Use "/permissions safe", "/permissions prompt", or "/permissions unsafe".`,
          ),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      const newMode = trimmedArgs as (typeof validModes)[number]
      useChatStore.getState().setPermissionMode(newMode)
      savePermissionModePreference(newMode)
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(
          `Permission mode set to **${newMode}**.\n\n${modeDescriptions[newMode]}`,
        ),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommandWithArgs({
    name: 'rewind',
    aliases: ['undo', 'checkpoint'],
    handler: async (params, args) => {
      // FID-2026-0803-004: rewind a previous turn's file state and/or
      // conversation from the persistent per-turn checkpoints.
      await handleRewindCommand(params, args)
    },
  }),
  defineCommandWithArgs({
    name: 'verify',
    aliases: ['typecheck'],
    handler: async (params, args) => {
      const trimmedArgs = args.trim().toLowerCase()

      const workspaceMap: Record<string, string> = {
        sdk: 'sdk',
        common: 'common',
        'agent-runtime': 'packages/agent-runtime',
        cli: 'cli',
      }

      const workspaces =
        trimmedArgs === ''
          ? Object.entries(workspaceMap)
          : [[trimmedArgs, workspaceMap[trimmedArgs]]]

      if (!workspaces.length || workspaces.some(([, dir]) => !dir)) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage('Usage: /verify [sdk|common|agent-runtime|cli]'),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      const results = await Promise.all(
        workspaces.map(async ([name, dir]) => {
          try {
            const [{ value }] = await runTerminalCommand({
              command: 'bun run typecheck',
              process_type: 'SYNC',
              cwd: dir,
              timeout_seconds: 120,
            })
            const stdout = 'stdout' in value ? value.stdout || '' : ''
            const stderr = 'stderr' in value ? value.stderr || '' : ''
            const exitCode = 'exitCode' in value ? (value.exitCode ?? 1) : 1
            return { name, exitCode, stdout, stderr }
          } catch (error) {
            return {
              name,
              exitCode: 1,
              stdout: '',
              stderr: error instanceof Error ? error.message : String(error),
            }
          }
        }),
      )

      const allPassed = results.every((r) => r.exitCode === 0)
      const summary = results
        .map((r) => {
          const status = r.exitCode === 0 ? 'PASS' : 'FAIL'
          const detail =
            r.exitCode === 0
              ? 'No TypeScript errors'
              : `exit ${r.exitCode}\n${(r.stderr || r.stdout).slice(0, 300)}`
          return `${r.name}: ${status}\n${detail}`
        })
        .join('\n\n')

      const overall = allPassed
        ? '✅ All typechecks passed'
        : '❌ Some typechecks failed'

      params.setMessages((prev) => [
        ...prev,
        getSystemMessage(`${overall}\n\n${summary}`),
      ])
    },
  }),
  defineCommandWithArgs({
    name: 'new',
    aliases: ['n', 'clear', 'c', 'reset'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      // Abort any in-flight run BEFORE clearing state and rotating the chat
      // id: an orphaned run would keep streaming after the switch and its
      // late checkpoints/final save would persist the old conversation's
      // state under the new chat (or vice versa).
      abortActiveRun()

      // Reset dev override mode on new chat
      useChatStore.getState().setDevMode(false)

      // Clear the conversation and rotate to a fresh chat directory, so the
      // next message doesn't overwrite the previous conversation's history
      params.setMessages(() => [])
      params.clearMessages()
      startNewChat()
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      params.stopStreaming()

      // If user provided a message, send it as the first message in the new chat
      if (trimmedArgs) {
        // Re-enable queue processing so the message can be sent
        params.setCanProcessQueue(true)
        params.sendMessage({
          content: trimmedArgs,
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
      } else {
        // Only disable queue if we're not sending a message
        params.setCanProcessQueue(false)
      }
    },
  }),
  defineCommand({
    name: 'init',
    handler: async (params) => {
      const { postUserMessage } = handleInitializationFlowLocally()
      const trimmed = params.inputValue.trim()

      params.saveToHistory(trimmed)
      clearInput(params)

      // Check streaming/queue state
      if (
        params.isStreaming ||
        params.streamMessageIdRef.current ||
        params.isChainInProgressRef.current
      ) {
        const pendingAttachments = capturePendingAttachments()
        params.addToQueue(trimmed, pendingAttachments)
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      params.sendMessage({
        content: trimmed,
        agentMode: params.agentMode,
        postUserMessage,
      })
      setTimeout(() => {
        params.scrollToLatest()
      }, 0)
    },
  }),
  defineCommand({
    name: 'compact',
    handler: async (params) => {
      const trimmed = params.inputValue.trim()

      // FID-2026-0821-001 P1-4 / FID-2026-0822-001 RC5: dispatch the literal
      // "/compact" prompt. The serialized savant interceptor force-spawns
      // the context-pruner, then compact-and-stops — the router must SEND
      // the prompt. Without this registry entry the typed input died at
      // route-user-prompt.ts "Command not found" and never reached the model.
      params.saveToHistory(trimmed)
      clearInput(params)

      // Check streaming/queue state
      if (
        params.isStreaming ||
        params.streamMessageIdRef.current ||
        params.isChainInProgressRef.current
      ) {
        const pendingAttachments = capturePendingAttachments()
        params.addToQueue(trimmed, pendingAttachments)
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      params.sendMessage({
        content: trimmed,
        agentMode: params.agentMode,
      })
      setTimeout(() => {
        params.scrollToLatest()
      }, 0)
    },
  }),
  defineCommand({
    name: 'usage',
    aliases: ['credits'],
    handler: async (params) => {
      const { postUserMessage } = await handleUsageCommand()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'subscribe',
    aliases: ['strong', 'sub', 'buy-credits'],
    handler: (params) => {
      safeOpen(WEBSITE_URL + '/subscribe')
      clearInput(params)
    },
  }),
  defineCommandWithArgs({
    name: 'image',
    aliases: ['img', 'attach'],
    handler: async (params, args) => {
      const trimmedArgs = args.trim()

      // If user provided a path directly, process it immediately
      if (trimmedArgs) {
        await handleImageCommand(trimmedArgs)
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      // Otherwise enter image mode
      useChatStore.getState().setInputMode('image')
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
]
