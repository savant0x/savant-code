// Public API re-exports (stable for consumers: router, tests). The shared
// types/factories/helpers live in command-shared.ts; command definitions live
// in defs/ (FID-2026-0805-003).
export { defineCommand, defineCommandWithArgs } from './command-shared'
export type {
  CommandDefinition,
  CommandHandler,
  CommandResult,
  RouterParams,
} from './command-shared'

import {
  clearInput,
  defineCommandWithArgs,
  type CommandDefinition,
} from './command-shared'
import { CHAT_COMMANDS } from './defs/chat'
import { CORE_COMMANDS } from './defs/core'
import { MISC_COMMANDS } from './defs/misc'
import { MODE_COMMANDS } from './defs/modes'
import { DESIGN_COMMANDS } from './design'
import { useChatStore } from '../state/chat-store'
import { IS_SAVANT_FREE } from '../utils/constants'
import { getSystemMessage, getUserMessage } from '../utils/message-history'
import { capturePendingAttachments } from '../utils/pending-attachments'
import { getSkillByName } from '../utils/skill-registry'

// FID-2026-0929-005: 'usage' and 'subscribe' are removed from this set —
// the commands themselves are deleted with the backend, so there is nothing
// left to gate.
const SAVANT_FREE_REMOVED_COMMANDS = new Set([
  'ads:enable',
  'ads:disable',
  'image',
  'publish',
  'release',
])

const SAVANT_FREE_ONLY_COMMANDS = new Set(['connect', 'plan', 'end-session'])

// Order is significant: findCommand resolves the first name/alias match (e.g.
// `model` resolves to the /model picker in the paid build, but to /end-session
// in the free build). The defs arrays preserve the original declaration order.
const ALL_COMMANDS: CommandDefinition[] = [
  ...CORE_COMMANDS,
  ...CHAT_COMMANDS,
  ...DESIGN_COMMANDS,
  ...MODE_COMMANDS,
  ...MISC_COMMANDS,
]

// Export the removal sets for the gating-parity test (FID-007 V4).
export const SAVANT_FREE_REMOVED_COMMAND_NAMES = SAVANT_FREE_REMOVED_COMMANDS
export const SAVANT_FREE_ONLY_COMMAND_NAMES = SAVANT_FREE_ONLY_COMMANDS

// FID-007 V4: pure gating filter (testable in either build flavor). The
// free/paid split must stay in lockstep with data/slash-commands.ts — the
// registry-gating test asserts parity between the two files.
export function filterCommandsForBuild(
  commands: CommandDefinition[],
  isFree: boolean,
): CommandDefinition[] {
  return isFree
    ? commands.filter((cmd) => !SAVANT_FREE_REMOVED_COMMANDS.has(cmd.name))
    : commands.filter((cmd) => !SAVANT_FREE_ONLY_COMMANDS.has(cmd.name))
}

export const COMMAND_REGISTRY: CommandDefinition[] = filterCommandsForBuild(
  ALL_COMMANDS,
  IS_SAVANT_FREE,
)

// Exported for the gating-parity test (FID-007 V4).
export const ALL_COMMAND_DEFINITIONS: CommandDefinition[] = ALL_COMMANDS

// Secret dev override command — hoisted so findCommand returns a stable
// identity (FID-007 D2). Not in COMMAND_REGISTRY (invisible to /help +
// autocomplete).
const DEV_COMMAND_DEFINITION: CommandDefinition = defineCommandWithArgs({
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
      getSystemMessage(
        `Unknown /dev subcommand: ${trimmedArgs}. Use "/dev on" or "/dev off".`,
      ),
    ])
    params.saveToHistory(params.inputValue.trim())
    clearInput(params)
  },
})

export function findCommand(cmd: string): CommandDefinition | undefined {
  const lowerCmd = cmd.toLowerCase()

  // Secret dev override command — not in COMMAND_REGISTRY (invisible to /help + autocomplete)
  if (lowerCmd === 'dev') {
    return DEV_COMMAND_DEFINITION
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
        params.setInputValue({
          text: '',
          cursorPosition: 0,
          lastEditDueToNav: false,
        })
        return
      }

      const trimmed = params.inputValue.trim()
      params.saveToHistory(trimmed)
      params.setInputValue({
        text: '',
        cursorPosition: 0,
        lastEditDueToNav: false,
      })

      // Build the message content with skill context and optional user args
      const skillContext = `<skill name="${skill.name}">
${skill.content}
</skill>`

      const userPrompt =
        `I invoke the following skill:\n\n${skillContext}\n\n` +
        (args.trim() ? `User request: ${args.trim()}` : '')

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
