import { useChatStore } from '../../state/chat-store'
import { useFeedbackStore } from '../../state/feedback-store'
import { useLoginStore } from '../../state/login-store'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { handleAdsEnable, handleAdsDisable } from '../ads'
import { handleAttestCommand } from '../attest'
import {
  clearInput,
  defineCommand,
  defineCommandWithArgs,
  resetUiToIdleAfterSlashCommand,
} from '../command-shared'
import { handleContributeCommand } from '../contribute'
import { handleCopyConversationCommand } from '../copy-conversation'
import { handleExportConversationCommand } from '../export-conversation'
import { handleGoalCommand } from '../goal'
import { handleGraphExportCommand } from '../graph-export'
import { handleGraphRefreshCommand } from '../graph-refresh'
import { handleHealthCommand } from '../health-command'
import { handleHelpCommand } from '../help'
import { handleLearnCommand } from '../learn'
import { handleLoopCommand } from '../loop'
import { handlePresenceCommand } from '../presence'
import {
  collectProcessDiagnostics,
  formatProcessDiagnostics,
} from '../process-diagnostics'
import { runBashCommand } from '../router'
import { handleSkillsCommand } from '../skills'
import { handleTelemetryCommand } from '../telemetry'

// Core slash commands: ads, telemetry, help, goal, loop, health, diagnostics,
// copy, export, feedback, bash, login, logout, exit. Split out of
// command-registry.ts (FID-2026-0805-003).
export const CORE_COMMANDS = [
  defineCommand({
    name: 'ads:enable',
    handler: (params) => {
      const { postUserMessage } = handleAdsEnable()
      // FID-007 P1: keep the reactive store slice in sync so slash-command
      // filtering depends on it without re-reading settings per keystroke.
      useChatStore.getState().setAdsEnabled(true)
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'ads:disable',
    handler: (params) => {
      const { postUserMessage } = handleAdsDisable()
      // FID-007 P1: see ads:enable.
      useChatStore.getState().setAdsEnabled(false)
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommandWithArgs({
    name: 'telemetry',
    aliases: ['analytics'],
    handler: (params, args) => {
      const postUserMessage = handleTelemetryCommand(args)
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  // FID-2026-0818-009: Discord Rich Presence control.
  defineCommandWithArgs({
    name: 'presence',
    aliases: ['discord'],
    handler: (params, args) => {
      const postUserMessage = handlePresenceCommand(args)
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      resetUiToIdleAfterSlashCommand()
    },
  }),
  defineCommand({
    name: 'help',
    aliases: ['h', '?'],
    handler: async (params) => {
      const { postUserMessage } = await handleHelpCommand()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      // FID-2026-0718-010 D3: slash-command bridges resetUiToIdle when idle.
      resetUiToIdleAfterSlashCommand()
    },
  }),
  defineCommandWithArgs({
    name: 'goal',
    aliases: ['g'],
    handler: handleGoalCommand,
  }),
  defineCommandWithArgs({
    name: 'loop',
    aliases: ['repeat'],
    handler: handleLoopCommand,
  }),
  // FID-2026-0806-004 Task 2: community contribution flow — add yourself to
  // CONTRIBUTORS.md and open a PR. Ships in BOTH builds (no free-removal set
  // entry) per the converged FID decision (G3).
  defineCommandWithArgs({
    name: 'contribute',
    handler: handleContributeCommand,
  }),
  defineCommand({
    name: 'health',
    aliases: ['status', 'check'],
    handler: async (params) => {
      await handleHealthCommand(params)
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      resetUiToIdleAfterSlashCommand()
    },
  }),
  defineCommand({
    name: 'diagnostics',
    aliases: ['diag', 'processes'],
    handler: (params) => {
      const diagnostics = formatProcessDiagnostics(collectProcessDiagnostics())
      params.setMessages((prev) => [...prev, getSystemMessage(diagnostics)])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      // FID-2026-0718-010 D3: slash-command bridges resetUiToIdle when idle.
      resetUiToIdleAfterSlashCommand()
    },
  }),
  defineCommand({
    name: 'copy',
    aliases: ['copy-chat'],
    handler: async (params) => {
      await handleCopyConversationCommand(params)
    },
  }),
  defineCommandWithArgs({
    name: 'export',
    aliases: ['save'],
    handler: handleExportConversationCommand,
  }),
  defineCommandWithArgs({
    name: 'graph-export',
    aliases: ['graph:export', 'gexport'],
    handler: handleGraphExportCommand,
  }),
  defineCommandWithArgs({
    name: 'attest',
    aliases: ['ztap', 'trust-receipt'],
    handler: handleAttestCommand,
  }),
  defineCommandWithArgs({
    name: 'learn',
    aliases: ['teacher'],
    handler: handleLearnCommand,
  }),
  // FID-2026-0824-012 S0-A/S0-B/S2-E: operator skills CLI (list/show/trust/
  // untrust/rollback). The operator trust boundary — no agent can release a
  // quarantined skill.
  defineCommandWithArgs({
    name: 'skills',
    aliases: ['skill-manage'],
    handler: handleSkillsCommand,
  }),
  defineCommandWithArgs({
    name: 'graph-refresh',
    aliases: ['graph:refresh', 'graph'],
    handler: handleGraphRefreshCommand,
  }),
  defineCommandWithArgs({
    name: 'feedback',
    aliases: ['bug', 'report'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      // If user provided feedback text directly, pre-populate the form
      if (trimmedArgs) {
        useFeedbackStore.getState().setFeedbackText(trimmedArgs)
        useFeedbackStore.getState().setFeedbackCursor(trimmedArgs.length)
      }

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      return { openFeedbackMode: true }
    },
  }),
  defineCommandWithArgs({
    name: 'bash',
    aliases: ['!'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      // If user provided a command directly, execute it immediately
      if (trimmedArgs) {
        const commandWithBang = '!' + trimmedArgs
        params.saveToHistory(commandWithBang)
        clearInput(params)
        runBashCommand(trimmedArgs)
        return
      }

      // Otherwise enter bash mode
      useChatStore.getState().setInputMode('bash')
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'login',
    aliases: ['signin'],
    handler: (params) => {
      params.abortControllerRef.current?.abort()
      params.stopStreaming()
      params.setCanProcessQueue(false)

      const { resetLoginState } = useLoginStore.getState()
      resetLoginState()
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage('Opening login screen...'),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      params.setUser(null)
      params.setIsAuthenticated(false)
    },
  }),
  defineCommand({
    name: 'logout',
    aliases: ['signout'],
    handler: (params) => {
      params.abortControllerRef.current?.abort()
      params.stopStreaming()
      params.setCanProcessQueue(false)

      const { resetLoginState } = useLoginStore.getState()
      params.logoutMutation.mutate(undefined, {
        onSettled: () => {
          resetLoginState()
          params.setMessages((prev) => [
            ...prev,
            getSystemMessage('Logged out.'),
          ])
          clearInput(params)
          setTimeout(() => {
            params.setUser(null)
            params.setIsAuthenticated(false)
          }, 300)
        },
      })
    },
  }),
  defineCommand({
    name: 'exit',
    aliases: ['quit', 'q'],
    handler: () => {
      process.kill(process.pid, 'SIGINT')
    },
  }),
]
