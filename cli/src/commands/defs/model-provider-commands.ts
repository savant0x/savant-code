import { useChatStore } from '../../state/chat-store'
import { useModelPickerStore } from '../../state/model-picker-store'
import { useProviderPickerStore } from '../../state/provider-picker-store'
import { useSavantFreeModelStore } from '../../state/savant-free-model-store'
import { getSystemMessage, getUserMessage } from '../../utils/message-history'
import { fetchGatewayModels } from '../../utils/openrouter-models'
import {
  activateConfiguredProvider,
  beginProviderSetup,
  beginResearchKeySetup,
  getConfiguredProviderNames,
  getProviderSetupInfo,
  getResearchKeyServiceInfo,
  PROVIDER_SETUP_CONFIG,
  RESEARCH_KEY_SERVICES,
} from '../../utils/provider-setup'
import {
  loadSavantCodeModelPreference,
  saveSavantCodeModelPreference,
} from '../../utils/settings'
import { clearInput, defineCommandWithArgs } from '../command-shared'

export const MODEL_PROVIDER_COMMANDS = [
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
          : "No model override set. Couldn't load the live OpenRouter model list — type an exact model id to switch, e.g. /model anthropic/claude-sonnet-4"
        params.setMessages((prev) => [...prev, getSystemMessage(message)])
        return
      }

      useModelPickerStore.getState().open(models)
    },
  }),
  defineCommandWithArgs({
    name: 'provider',
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      // No args: open dropdown picker
      if (!trimmedArgs) {
        const configured = getConfiguredProviderNames()
        const providers = (
          Object.entries(PROVIDER_SETUP_CONFIG) as Array<
            [
              string,
              (typeof PROVIDER_SETUP_CONFIG)[keyof typeof PROVIDER_SETUP_CONFIG],
            ]
          >
        ).map(([name, config]) => ({
          name: name as (typeof configured)[number],
          label: config.label,
          configured: configured.includes(name as (typeof configured)[number]),
        }))

        useProviderPickerStore.getState().open(providers)
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      const provider = beginProviderSetup(trimmedArgs)
      const info = provider ? getProviderSetupInfo(provider) : undefined

      if (!provider || !info) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Unknown provider. Use /provider followed by one of: ${Object.keys(PROVIDER_SETUP_CONFIG).join(', ')}.`,
          ),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      params.setInputValue({
        text: '',
        cursorPosition: 0,
        lastEditDueToNav: false,
      })
      const configured = activateConfiguredProvider(provider)
      if (configured) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `${info.label} selected. The existing configured key will be used; no key entry is needed.`,
          ),
        ])
        params.setInputFocused(true)
        params.inputRef.current?.focus()
        return
      }

      useChatStore.getState().setInputMode('providerSetup')
      params.setInputFocused(true)
      params.inputRef.current?.focus()
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(
          `${info.label} selected. Enter your API key below. It will be masked and stored locally in credentials.json. Environment variables take precedence.`,
        ),
      ])
    },
  }),
  defineCommandWithArgs({
    name: 'research-keys',
    aliases: ['research-key'],
    handler: (params, args) => {
      const trimmedArgs = args.trim()

      if (!trimmedArgs) {
        const lines = Object.entries(RESEARCH_KEY_SERVICES)
          .map(
            ([name, config]) =>
              `**${name}** — ${config.label} (${config.envVar})`,
          )
          .join('\n')
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Research API keys (BYOK) — your own key is used and never shared:\n\n${lines}\n\nUse /research-keys <service> to set one.`,
          ),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      const service = beginResearchKeySetup(trimmedArgs)
      const info = service ? getResearchKeyServiceInfo(service) : undefined
      if (!service || !info) {
        params.setMessages((prev) => [
          ...prev,
          getUserMessage(params.inputValue.trim()),
          getSystemMessage(
            `Unknown research service. Use /research-keys followed by one of: ${Object.keys(RESEARCH_KEY_SERVICES).join(', ')}.`,
          ),
        ])
        params.saveToHistory(params.inputValue.trim())
        clearInput(params)
        return
      }

      useChatStore.getState().setInputMode('researchKeySetup')
      params.setInputFocused(true)
      params.inputRef.current?.focus()
      params.setMessages((prev) => [
        ...prev,
        getUserMessage(params.inputValue.trim()),
        getSystemMessage(
          `${info.label} selected. Enter your ${info.label} API key below. It will be masked and stored locally in credentials.json. Environment variables take precedence.`,
        ),
      ])
    },
  }),
]
