import { MODEL_PROVIDER_COMMANDS } from './model-provider-commands'
import { useChatStore } from '../../state/chat-store'
import {
  AGENT_MODES,
  IS_SAVANT_FREE,
  MODE_DESCRIPTIONS,
} from '../../utils/constants'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { clearInput, defineCommandWithArgs } from '../command-shared'

import type { AgentMode } from '../../utils/constants'

// Mode/model/provider commands. Split out of command-registry.ts
// (FID-2026-0805-003). Order within this file is preserved: the bare /mode
// command, the generated mode:<name> commands, then /model and /provider.
export const MODE_COMMANDS = [
  // Bare /mode — lists every mode with its one-line contract (MODE_DESCRIPTIONS,
  // the same single source the toggle hovertip uses) and marks the active one;
  // with an argument, switches mode. FID-2026-0805-001.
  ...(IS_SAVANT_FREE
    ? []
    : [
        defineCommandWithArgs({
          name: 'mode',
          handler: (params, args) => {
            const trimmedArgs = args.trim()
            const currentMode = useChatStore.getState().agentMode

            if (!trimmedArgs) {
              const lines = AGENT_MODES.map((m) => {
                const marker = m === currentMode ? ' (current)' : ''
                return `**${m}**${marker} — ${MODE_DESCRIPTIONS[m]}`
              }).join('\n')
              params.setMessages((prev) => [
                ...prev,
                getUserMessage(params.inputValue.trim()),
                getSystemMessage(`Execution modes:\n\n${lines}`),
              ])
              params.saveToHistory(params.inputValue.trim())
              clearInput(params)
              return
            }

            // First word is the mode name; any trailing text is sent as the
            // first message in the new mode (parity with /mode:<name>).
            const [rawMode, ...restArgs] = trimmedArgs.split(/\s+/)
            const target = rawMode.toUpperCase()
            if (!AGENT_MODES.includes(target as AgentMode)) {
              params.setMessages((prev) => [
                ...prev,
                getUserMessage(params.inputValue.trim()),
                getSystemMessage(
                  `Unknown mode: "${rawMode}". Use "/mode" to list modes, or "/mode:<name>".`,
                ),
              ])
              params.saveToHistory(params.inputValue.trim())
              clearInput(params)
              return
            }
            const targetMode = target as AgentMode

            useChatStore.getState().setAgentMode(targetMode)
            params.setMessages((prev) => [
              ...prev,
              getUserMessage(params.inputValue.trim()),
              getSystemMessage(
                `Switched to ${targetMode} mode.\n\n${MODE_DESCRIPTIONS[targetMode]}`,
              ),
            ])
            params.saveToHistory(params.inputValue.trim())
            clearInput(params)

            const trailingMessage = restArgs.join(' ').trim()
            if (trailingMessage) {
              params.setCanProcessQueue(true)
              params.sendMessage({
                content: trailingMessage,
                agentMode: targetMode,
              })
              setTimeout(() => {
                params.scrollToLatest()
              }, 0)
            }
          },
        }),
      ]),
  // Mode commands generated from AGENT_MODES (excluded in SavantFree)
  // FID-2026-0805-001: HYBRID keeps the legacy `mode:edit` alias.
  ...(IS_SAVANT_FREE ? [] : AGENT_MODES).map((mode) =>
    defineCommandWithArgs({
      name: `mode:${mode.toLowerCase()}`,
      aliases: [
        `model:${mode.toLowerCase()}`,
        // Legacy pre-rename spellings still resolve to HYBRID.
        ...(mode === 'HYBRID' ? ['mode:edit', 'model:edit'] : []),
      ],
      handler: (params, args) => {
        const trimmedArgs = args.trim()

        useChatStore.getState().setAgentMode(mode)
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Switched to ${mode} mode.\n\n${MODE_DESCRIPTIONS[mode]}`,
          ),
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
  ...(IS_SAVANT_FREE ? [] : MODEL_PROVIDER_COMMANDS),
]
