import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'
import { runTerminalCommand } from '@savant-code/sdk'

import { handleAdsEnable, handleAdsDisable } from './ads'
import { handleCopyConversationCommand } from './copy-conversation'
import { handleGoalCommand } from './goal'
import { handleHealthCommand } from './health-command'
import { handleHelpCommand } from './help'
import { handleImageCommand } from './image'
import { handleInitializationFlowLocally } from './init'
import { handleLoopCommand } from './loop'
import {
  collectProcessDiagnostics,
  formatProcessDiagnostics,
} from './process-diagnostics'
import {
  buildInterviewPrompt,
  buildPlanPrompt,
  buildReviewPromptFromArgs,
} from './prompt-builders'
import { runBashCommand } from './router'
import { handleUsageCommand } from './usage'
import { returnToSavantFreeLanding } from '../hooks/use-savant-free-session'
import { useThemeStore } from '../hooks/use-theme'
import { WEBSITE_URL } from '../login/constants'
import { startNewChat } from '../project-files'
import { useChatStore } from '../state/chat-store'
import { useFeedbackStore } from '../state/feedback-store'
import { useLoginStore } from '../state/login-store'
import { useModelPickerStore } from '../state/model-picker-store'
import { useSavantFreeModelStore } from '../state/savant-free-model-store'
import { abortActiveRun } from '../utils/active-run'
import {
  AGENT_MODES,
  END_SESSION_MESSAGE,
  IS_SAVANT_FREE,
} from '../utils/constants'
import { resetUiToIdle as _resetUiToIdle } from '../utils/finish-logic'
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import { safeOpen } from '../utils/open-url'
import { fetchGatewayModels } from '../utils/openrouter-models'
import { capturePendingAttachments } from '../utils/pending-attachments'
import {
  loadSavantCodeModelPreference,
  saveSavantCodeModelPreference,
  savePermissionModePreference,
} from '../utils/settings'
import { getSkillByName } from '../utils/skill-registry'

import type { MultilineInputHandle } from '../components/multiline-input'
import type { ChatMessage } from '../types/chat'
import type { SendMessageFn } from '../types/contracts/send-message'
import type { InputValue, PendingAttachment } from '../types/store'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { UseMutationResult } from '@tanstack/react-query'


// FID-2026-0718-010 (D3): helper for slash-command bridges. Calls
// resetUiToIdle (which itself calls onStreamEnded) with the slash-command
// reason. Gated by !isChainInProgress && !isRetrying inside finish-logic.
const resetUiToIdleAfterSlashCommand = () => _resetUiToIdle('slash-command')

export type RouterParams = {
  abortControllerRef: React.MutableRefObject<AbortController | null>
  agentMode: AgentMode
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  inputValue: string
  isChainInProgressRef: React.MutableRefObject<boolean>
  isStreaming: boolean
  logoutMutation: UseMutationResult<boolean, Error, void, unknown>
  streamMessageIdRef: React.MutableRefObject<string | null>
  addToQueue: (message: string, attachments?: PendingAttachment[]) => void
  clearMessages: () => void
  saveToHistory: (message: string) => void
  scrollToLatest: () => void
  sendMessage: SendMessageFn
  setCanProcessQueue: (value: React.SetStateAction<boolean>) => void
  setInputFocused: (focused: boolean) => void
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  setIsAuthenticated: (value: React.SetStateAction<boolean | null>) => void
  setMessages: (
    value: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void
  setUser: (value: React.SetStateAction<User | null>) => void
  stopStreaming: () => void
}

export type CommandResult = {
  openFeedbackMode?: boolean
  openPublishMode?: boolean
  openChatHistory?: boolean
  openReviewScreen?: boolean
  preSelectAgents?: string[]
} | void

export type CommandHandler = (
  params: RouterParams,
  args: string,
) => Promise<CommandResult> | CommandResult

export type CommandDefinition = {
  name: string
  aliases: string[]
  handler: CommandHandler
  /** Whether this command accepts arguments. Set automatically by the factory functions. */
  acceptsArgs: boolean
}

/**
 * Handler type for commands that don't accept arguments.
 */
type CommandHandlerNoArgs = (
  params: RouterParams,
) => Promise<CommandResult> | CommandResult

/**
 * Handler type for commands that accept arguments.
 */
type CommandHandlerWithArgs = (
  params: RouterParams,
  args: string,
) => Promise<CommandResult> | CommandResult

/**
 * Configuration for defining a command that does NOT accept arguments.
 */
type CommandConfig = {
  name: string
  aliases?: string[]
  handler: CommandHandlerNoArgs
}

/**
 * Configuration for defining a command that accepts arguments.
 */
type CommandWithArgsConfig = {
  name: string
  aliases?: string[]
  handler: CommandHandlerWithArgs
}

/**
 * Factory for commands that do NOT accept arguments.
 * Any args passed are gracefully ignored.
 *
 * @example
 * defineCommand({
 *   name: 'new',
 *   aliases: ['n', 'clear'],
 *   handler: (params) => {
 *     params.setMessages(() => [])
 *   },
 * })
 */
export function defineCommand(config: CommandConfig): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases ?? [],
    acceptsArgs: false,
    handler: (params) => {
      // Args are gracefully ignored for commands that don't accept them
      return config.handler(params)
    },
  }
}

/**
 * Factory for commands that accept arguments.
 * The handler receives both params and args.
 *
 * @example
 * defineCommandWithArgs({
 *   name: 'bash',
 *   aliases: ['!'],
 *   handler: (params, args) => {
 *     if (args.trim()) {
 *       runBashCommand(args.trim())
 *     }
 *   },
 * })
 */
export function defineCommandWithArgs(
  config: CommandWithArgsConfig,
): CommandDefinition {
  return {
    name: config.name,
    aliases: config.aliases ?? [],
    acceptsArgs: true,
    handler: config.handler,
  }
}

const clearInput = (params: RouterParams) => {
  params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
}

const SAVANT_FREE_REMOVED_COMMANDS = new Set([
  'ads:enable',
  'ads:disable',
  'usage',
  'subscribe',
  'image',
  'publish',
])

const SAVANT_FREE_ONLY_COMMANDS = new Set([
  'connect',
  'plan',
  'end-session',
])

const ALL_COMMANDS: CommandDefinition[] = [
  defineCommand({
    name: 'ads:enable',
    handler: (params) => {
      const { postUserMessage } = handleAdsEnable()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
    },
  }),
  defineCommand({
    name: 'ads:disable',
    handler: (params) => {
      const { postUserMessage } = handleAdsDisable()
      params.setMessages((prev) => postUserMessage(prev))
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
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
  }),  defineCommand({
    name: 'copy',
    aliases: ['copy-chat', 'export'],
    handler: async (params) => {
      await handleCopyConversationCommand(params)
    },
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
  defineCommandWithArgs({
    name: 'permissions',
    aliases: ['sandbox', 'safety'],
    handler: (params, args) => {
      const trimmedArgs = args.trim().toLowerCase()
      const currentMode = useChatStore.getState().permissionMode
      const validModes = ['safe', 'prompt', 'unsafe'] as const
      const modeDescriptions: Record<
        (typeof validModes)[number],
        string
      > = {
        safe: 'Risky tools are denied automatically.',
        prompt:
          'Risky tools are blocked; interactive prompts are not yet implemented, so they currently downgrade to deny.',
        unsafe:
          'Risky tools are allowed. Use with caution.',
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
    name: 'verify',
    aliases: ['typecheck', 'check'],
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
          getSystemMessage(
            'Usage: /verify [sdk|common|agent-runtime|cli]',
          ),
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
            const exitCode = 'exitCode' in value ? value.exitCode ?? 1 : 1
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
  // Mode commands generated from AGENT_MODES (excluded in SavantFree)
  ...(IS_SAVANT_FREE ? [] : AGENT_MODES).map((mode) =>
    defineCommandWithArgs({
      name: `mode:${mode.toLowerCase()}`,
      aliases: [`model:${mode.toLowerCase()}`],
      handler: (params, args) => {
        const trimmedArgs = args.trim()

        useChatStore.getState().setAgentMode(mode)
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(`Switched to ${mode} mode.`),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)

        // If user provided a message, send it in the new mode
        if (trimmedArgs) {
          params.setCanProcessQueue(true)
          params.sendMessage({
            content: trimmedArgs,
            agentMode: mode,
          })
          setTimeout(() => {
            params.scrollToLatest()
          }, 0)
        }
      },
    }),
  ),
  ...(IS_SAVANT_FREE
    ? []
    : [
        defineCommandWithArgs({
          name: 'model',
          aliases: ['switch-model'],
          handler: async (params, args) => {
            const trimmedArgs = args.trim()
            params.saveToHistory(params.inputValue.trim())
            clearInput(params)

            // Free-text selection always works: /model <exact-id> switches
            // immediately, even if the live catalog is unavailable.
            if (trimmedArgs) {
              saveSavantCodeModelPreference(trimmedArgs)
              useSavantFreeModelStore.getState().switchModel(trimmedArgs)
              params.setMessages((prev) => [
                ...prev,
                getSystemMessage(`Model switched to: ${trimmedArgs}`),
              ])
              return
            }

            const currentModel = loadSavantCodeModelPreference()

            // Live picker: fetch the real-time OpenRouter catalog and render a
            // filterable list. Typing /model <id> (or re-running with a filter)
            // selects the model. Degrades to free-text if the catalog can't load.
            const models = await fetchGatewayModels()
            if (models.length === 0) {
              const message = currentModel
                ? `Current model: ${currentModel}\n\nCouldn't load the live OpenRouter model list. Type an exact model id to switch, e.g. /model anthropic/claude-sonnet-4`
                : 'No model override set. Couldn\'t load the live OpenRouter model list — type an exact model id to switch, e.g. /model anthropic/claude-sonnet-4'
              params.setMessages((prev) => [
                ...prev,
                getSystemMessage(message),
              ])
              return
            }

            useModelPickerStore.getState().open(models)
          },
        }),
      ]),
  defineCommandWithArgs({
    name: 'publish',
    handler: (params, args) => {
      const trimmedArgs = args.trim()
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      // If user provided agent ids directly, skip to confirmation step
      if (trimmedArgs) {
        const agentIds = trimmedArgs.split(/\s+/).filter(Boolean)
        return { openPublishMode: true, preSelectAgents: agentIds }
      }

      // Otherwise open selection UI
      return { openPublishMode: true }
    },
  }),
  ...(CHATGPT_OAUTH_ENABLED
    ? [
        defineCommand({
          name: 'connect',
          aliases: ['connect:chatgpt', 'chatgpt'],
          handler: (params) => {
            useChatStore.getState().setInputMode('connect:chatgpt')
            params.saveToHistory(params.inputValue.trim())
            clearInput(params)
          },
        }),
      ]
    : []),
  defineCommand({
    name: 'history',
    aliases: ['chats'],
    handler: (params) => {
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      // FID-2026-0718-010 D3: slash-command bridges resetUiToIdle when idle.
      resetUiToIdleAfterSlashCommand()
      return { openChatHistory: true }
    },
  }),
  defineCommandWithArgs({
    name: 'interview',
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      // If user provided text directly, send it immediately
      if (trimmedArgs) {
        params.sendMessage({
          content: buildInterviewPrompt(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      // Otherwise enter interview mode
      useChatStore.getState().setInputMode('interview')
    },
  }),
  defineCommandWithArgs({
    name: 'plan',
    handler: (params, args) => {
      // /plan runs on the selected model by default, or delegates to GPT when a
      // ChatGPT account is connected (handled in buildPlanPrompt). No gate.
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      // If user provided plan text directly, send it immediately
      if (trimmedArgs) {
        params.sendMessage({
          content: buildPlanPrompt(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      // Otherwise enter plan mode
      useChatStore.getState().setInputMode('plan')
    },
  }),
  defineCommandWithArgs({
    name: 'review',
    handler: (params, args) => {
      // /review runs on the selected model by default, or delegates to GPT when
      // a ChatGPT account is connected (handled in buildReviewPrompt). No gate.
      const trimmedArgs = args.trim()

      params.saveToHistory(params.inputValue.trim())
      clearInput(params)

      // If user provided review text directly, send it immediately without showing the screen
      if (trimmedArgs) {
        params.sendMessage({
          content: buildReviewPromptFromArgs(trimmedArgs),
          agentMode: params.agentMode,
        })
        setTimeout(() => {
          params.scrollToLatest()
        }, 0)
        return
      }

      // Otherwise open the selection UI
      return { openReviewScreen: true }
    },
  }),
  defineCommand({
    name: 'theme:toggle',
    handler: (params) => {
      const { theme, setThemeName } = useThemeStore.getState()
      const newTheme = theme.name === 'dark' ? 'light' : 'dark'
      setThemeName(newTheme)
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(`Switched to ${newTheme} theme.`),
      ])
      clearInput(params)
      // FID-2026-0718-010 D3: slash-command bridges resetUiToIdle when idle.
      resetUiToIdleAfterSlashCommand()
    },
  }),
  // /end-session (savant-free-only) — end the active session early and drop back
  // to the model picker. The hook flips status to 'none', which unmounts
  // <Chat> and mounts <SavantFreeLandingScreen>, where the user picks a model
  // and hits Enter to start a new session.
  defineCommand({
    name: 'end-session',
    aliases: ['model'],
    handler: (params) => {
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(END_SESSION_MESSAGE),
      ])
      params.saveToHistory(params.inputValue.trim())
      clearInput(params)
      returnToSavantFreeLanding({ resetChat: true }).catch(() => {
        // The hook surfaces poll errors via the session store; nothing to do
        // here beyond letting the chat history reflect the attempt.
      })
    },
  }),
]

export const COMMAND_REGISTRY: CommandDefinition[] = IS_SAVANT_FREE
  ? ALL_COMMANDS.filter((cmd) => !SAVANT_FREE_REMOVED_COMMANDS.has(cmd.name))
  : ALL_COMMANDS.filter((cmd) => !SAVANT_FREE_ONLY_COMMANDS.has(cmd.name))

export function findCommand(cmd: string): CommandDefinition | undefined {
  const lowerCmd = cmd.toLowerCase()

  // Secret dev override command — not in COMMAND_REGISTRY (invisible to /help + autocomplete)
  if (lowerCmd === 'dev') {
    return defineCommandWithArgs({
      name: 'dev',
      handler: (params, args) => {
        const trimmedArgs = args.trim().toLowerCase()
        const devModeActive = useChatStore.getState().devMode

        // /dev off — deactivate
        if (trimmedArgs === 'off') {
          if (devModeActive) {
            useChatStore.getState().setDevMode(false)
            params.setMessages((prev) => [
              ...prev,
              getSystemMessage('Dev override deactivated.'),
            ])
          } else {
            params.setMessages((prev) => [
              ...prev,
              getSystemMessage('Dev override is already off.'),
            ])
          }
          params.saveToHistory(params.inputValue.trim())
          clearInput(params)
          return
        }

        // /dev on — activate (no passphrase required)
        if (trimmedArgs === 'on' || trimmedArgs === '') {
          if (devModeActive) {
            params.setMessages((prev) => [
              ...prev,
              getSystemMessage('Dev override is already active.'),
            ])
          } else {
            useChatStore.getState().setDevMode(true)
            params.setMessages((prev) => [
              ...prev,
              getSystemMessage('Dev override activated.'),
            ])
          }
          params.saveToHistory(params.inputValue.trim())
          clearInput(params)
          return
        }

        // Unknown /dev subcommand
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(`Unknown /dev subcommand: ${trimmedArgs}. Use "/dev on" or "/dev off".`),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
      },
    })
  }

  // First check the static command registry
  const staticCommand = COMMAND_REGISTRY.find(
    (def) => def.name === lowerCmd || def.aliases.includes(lowerCmd),
  )
  if (staticCommand) {
    return staticCommand
  }

  // Check if this is a skill command (prefixed with "skill:")
  if (lowerCmd.startsWith('skill:')) {
    const skillName = lowerCmd.slice('skill:'.length)
    const skill = getSkillByName(skillName)
    if (skill) {
      return createSkillCommand(skill.name)
    }
  }

  return undefined
}

/**
 * Creates a dynamic command definition for a skill.
 * When invoked, the skill's content is sent to the agent.
 */
function createSkillCommand(skillName: string): CommandDefinition {
  return defineCommandWithArgs({
    name: skillName,
    handler: (params, args) => {
      const skill = getSkillByName(skillName)
      if (!skill) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(`Skill not found: ${skillName}`),
        ])
        params.saveToHistory(params.inputValue.trim())
        params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })
        return
      }

      const trimmed = params.inputValue.trim()
      params.saveToHistory(trimmed)
      params.setInputValue({ text: '', cursorPosition: 0, lastEditDueToNav: false })

      // Build the message content with skill context and optional user args
      const skillContext = `<skill name="${skill.name}">
${skill.content}
</skill>`

      const userPrompt = `I invoke the following skill:\n\n${skillContext}\n\n`
        + (args.trim()
          ? `User request: ${args.trim()}`
          : '')

      // Check streaming/queue state
      if (
        params.isStreaming ||
        params.streamMessageIdRef.current ||
        params.isChainInProgressRef.current
      ) {
        const pendingAttachments = capturePendingAttachments()
        params.addToQueue(userPrompt, pendingAttachments)
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      params.sendMessage({
        content: userPrompt,
        agentMode: params.agentMode,
      })
      setTimeout(() => {
        params.scrollToLatest()
      }, 0)
    },
  })
}
