import { detectOllama } from '@savant-code/llm-providers/ollama'

import { getSystemMessage } from '../utils/message-history'
import {
  loadAnalyticsEnabled,
  loadPermissionModePreference,
  loadSavantCodeModelPreference,
  loadSettings,
} from '../utils/settings'

import type { RouterParams } from './command-registry'

/**
 * Build a markdown-style health report for the current Savant Code install.
 *
 * Reports:
 * - Whether a local Ollama instance is reachable and which models are available
 * - The current default model preference
 * - The current sandbox permission mode
 * - The configured provider mode (backend vs direct / Ollama)
 */
export async function handleHealthCommand(params: RouterParams): Promise<void> {
  const settings = loadSettings()
  const modelPreference = loadSavantCodeModelPreference()
  const permissionMode = loadPermissionModePreference()

  // Prefer the active runtime config, but fall back to persisted settings so
  // the report stays useful when the user has not yet sent a message.
  const directProvider = process.env.DIRECT_PROVIDER ?? settings.directProvider
  const inferenceBaseUrl =
    process.env.INFERENCE_BASE_URL ?? settings.directProviderBaseUrl
  const isDirectProvider =
    (directProvider ?? '').trim().length > 0 ||
    (inferenceBaseUrl ?? '').trim().length > 0

  const ollama = await detectOllama()

  const ollamaSection = ollama.available
    ? `🟢 **Ollama** — running at ${ollama.host} (v${ollama.version ?? 'unknown'})\n` +
      `  Models: ${ollama.models.length > 0 ? ollama.models.join(', ') : '*none*'}`
    : `🔴 **Ollama** — not detected\n  ${ollama.error ?? 'Start with: \`ollama serve\`'}`

  const providerSection = isDirectProvider
    ? `**Provider mode:** direct (${directProvider ?? 'INFERENCE_BASE_URL'})\n` +
      `**Base URL:** ${inferenceBaseUrl ?? 'n/a'}`
    : '**Provider mode:** SavantCode backend'

  const lines = [
    '# Savant Code Health Check',
    '',
    ollamaSection,
    '',
    providerSection,
    `**Default model:** ${modelPreference ?? 'none (uses agent default)'}`,
    `**Permission mode:** ${permissionMode}`,
    `**Ads enabled:** ${settings.adsEnabled === true ? 'yes' : 'no'}`,
    `**Remote analytics:** ${loadAnalyticsEnabled() ? 'enabled' : 'disabled'}`,
  ]

  params.setMessages((prev) => [...prev, getSystemMessage(lines.join('\n'))])
}
