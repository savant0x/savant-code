import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { detectOllama } from '@savant-code/llm-providers/ollama'

import { getSystemMessage } from '../utils/message-history'
import { readStoredProviderKeys } from '../utils/provider-credentials'
import { formatProviderQuota, readProviderQuota } from '../utils/provider-quota'
import {
  getConfiguredProviderKey,
  getProviderSetupInfo,
} from '../utils/provider-setup'
import {
  getActiveProvider,
  loadAnalyticsEnabled,
  loadPermissionModePreference,
  loadSavantCodeModelPreference,
  loadSettings,
} from '../utils/settings'
import {
  formatVerifyResult,
  verifyCustomProviderKey,
} from '../utils/verify-custom-provider'

import type { RouterParams } from './command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

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
  // Phase 4: the persisted fallback is the canonical activeProvider; its base
  // URL derives from the registry (directProviderBaseUrl remains only for the
  // local Ollama path, which is detected at startup).
  const persistedProvider = getActiveProvider()
  // FID-2026-0910-004 Step 9 (D8 widening): the persisted provider may be a
  // custom id, so the base-URL lookup reads the effective registry (built-ins
  // + registered customs). This is C6's effective lookup — pulled forward
  // from Step 10 because the widening makes the built-in-only index
  // type-illegal here. Known-id guard preserves the ollama branch exactly.
  const persistedBaseUrl =
    settings.directProviderBaseUrl ??
    (persistedProvider !== 'ollama'
      ? getEffectiveProviderRegistry()[persistedProvider]?.baseUrl
      : undefined)
  // A custom INFERENCE_BASE_URL without DIRECT_PROVIDER is a custom endpoint —
  // do not overlay the persisted provider onto it.
  const directProvider =
    process.env.DIRECT_PROVIDER ??
    (process.env.INFERENCE_BASE_URL?.trim() ? undefined : persistedProvider)
  const inferenceBaseUrl = process.env.INFERENCE_BASE_URL ?? persistedBaseUrl
  const isDirectProvider =
    (directProvider ?? '').trim().length > 0 ||
    (inferenceBaseUrl ?? '').trim().length > 0

  const ollama = await detectOllama()

  const ollamaSection = ollama.available
    ? `🟢 **Ollama** — running at ${ollama.host} (v${ollama.version ?? 'unknown'})\n` +
      `  Models: ${ollama.models.length > 0 ? ollama.models.join(', ') : '*none*'}`
    : `🔴 **Ollama** — not detected\n  ${ollama.error ?? 'Start with: \`ollama serve\`'}`

  // When running against a direct provider, report the required credential
  // variable and whether a key is configured (shell or stored).
  const providerName =
    directProvider ?? (inferenceBaseUrl ? 'custom' : undefined)
  const providerInfo = providerName
    ? getProviderSetupInfo(providerName)
    : undefined
  const requiredEnvVar = providerInfo?.envVar
  const keyConfigured = Boolean(
    (requiredEnvVar && process.env[requiredEnvVar]?.trim()) ||
    (providerName ? getConfiguredProviderKey(providerName) : undefined),
  )

  const providerSection = isDirectProvider
    ? `**Provider mode:** direct (${providerName ?? 'INFERENCE_BASE_URL'})\n` +
      `**Base URL:** ${inferenceBaseUrl ?? 'n/a'}` +
      (requiredEnvVar
        ? `\n**Required key env var:** ${requiredEnvVar}\n**Key configured:** ${keyConfigured ? 'yes' : 'no'}`
        : '')
    : '**Provider mode:** SavantCode backend'

  // FID-2026-0911-003: live line for the ACTIVE CUSTOM gateway only.
  // Built-ins carry FID-level keyed live acceptance (their own probes);
  // a network probe per built-in would be new surface without new info.
  // The stored key is verified via the shared helper — timeout-bounded,
  // never throws, never renders key material. Failure degrades to a
  // 'not checked' line; the rest of the report always renders.
  let liveCheckLine = ''
  const activeCustom = (settings.customProviders ?? []).find(
    (config: CustomProviderConfig) => config.id === persistedProvider,
  )
  if (activeCustom) {
    const storedKey = readStoredProviderKeys()[activeCustom.apiKeyEnvVar]
    if (storedKey) {
      const verify = await verifyCustomProviderKey(activeCustom, storedKey)
      liveCheckLine = `**Live check:** ${formatVerifyResult(verify)}`
    } else {
      liveCheckLine = '**Live check:** skipped (no stored key)'
    }
  }

  // FID-2026-0919-026: where the ACTIVE provider documents a key-scoped quota
  // endpoint, state the account's own reading. Unlike a per-built-in `/models`
  // probe, this is new information — a quota refusal (`insufficient_user_quota`)
  // is otherwise indistinguishable inside the tool from an integration defect,
  // and the vendor's web UI may disagree with its own gateway.
  let quotaLine = ''
  const activeConfig = providerName
    ? getEffectiveProviderRegistry()[providerName]
    : undefined
  if (activeConfig?.quota) {
    const activeKey =
      (requiredEnvVar ? process.env[requiredEnvVar]?.trim() : undefined) ??
      (providerName ? getConfiguredProviderKey(providerName) : undefined)
    const quota = await readProviderQuota({
      config: activeConfig,
      key: activeKey,
    })
    quotaLine = `**Quota:** ${formatProviderQuota(quota)}`
  }

  const lines = [
    '# Savant Code Health Check',
    '',
    ollamaSection,
    '',
    providerSection,
    ...(liveCheckLine ? [liveCheckLine] : []),
    ...(quotaLine ? [quotaLine] : []),
    `**Default model:** ${modelPreference ?? 'none (uses agent default)'}`,
    `**Permission mode:** ${permissionMode}`,
    `**Ads enabled:** ${settings.adsEnabled === true ? 'yes' : 'no'}`,
    `**Remote analytics:** ${loadAnalyticsEnabled() ? 'enabled' : 'disabled'}`,
  ]

  params.setMessages((prev) => [...prev, getSystemMessage(lines.join('\n'))])
}
