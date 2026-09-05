import { WEBSITE_URL } from '../../login/constants'
import { startNewChat } from '../../project-files'
import { useChatStore } from '../../state/chat-store'
import { abortActiveRun } from '../../utils/active-run'
import { safeOpen } from '../../utils/open-url'
import { capturePendingAttachments } from '../../utils/pending-attachments'
import {
  clearInput,
  defineCommand,
  defineCommandWithArgs,
} from '../command-shared'
import { handlePermissionsCommand } from './chat-permissions'
import { handleVerifyCommand } from './chat-verify'
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
    handler: handlePermissionsCommand,
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
    handler: handleVerifyCommand,
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
