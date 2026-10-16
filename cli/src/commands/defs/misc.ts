import { CHATGPT_OAUTH_ENABLED } from '@savant-code/common/constants/chatgpt-oauth'

import { useThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { handleAutoCommand } from '../auto-drive'
import {
  clearInput,
  defineCommand,
  defineCommandWithArgs,
  resetUiToIdleAfterSlashCommand,
} from '../command-shared'
import {
  buildInterviewPrompt,
  buildPlanPrompt,
  buildReviewPromptFromArgs,
} from '../prompt-builders'
import { handleReleaseCommand } from '../release/release-command'

// Remaining commands: publish, connect, history, interview, plan, review,
// theme:toggle, end-session. Split out of command-registry.ts
// (FID-2026-0805-003).
export const MISC_COMMANDS = [
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
  // FID-2026-0818-002: Auto Drive entry — clarify → pre-build plan → one
  // operator Confirmation (Law 2), then the run drives autonomously.
  // Canonical name is `auto-drive` (the feature name); `/auto`, `/drive`, and
  // `/autodrive` are hidden aliases that resolve to the same handler.
  defineCommandWithArgs({
    name: 'auto-drive',
    aliases: ['auto', 'drive', 'autodrive'],
    handler: handleAutoCommand,
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
  // Release command flow — drives scripts/public-release.ts. Streaming output
  // is handled inside the handler (chat bubbles + summary).
  defineCommandWithArgs({
    name: 'release',
    aliases: ['rel'],
    handler: handleReleaseCommand,
  }),
]
