import fs from 'fs'
import os from 'os'
import path from 'path'

import { mock } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { useProviderPickerStore } from '../../state/provider-picker-store'
import { cancelWizardSession } from '../../utils/provider-wizard'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'
import type { CustomProviderConfig } from '@savant-code/common/providers/types'

/**
 * Shared harness for the /provider command-grammar tests
 * (FID-2026-0913-002 split from provider-commands.test.ts — isolated config
 * dir, clean routing env, store resets, settings/credentials seeding, and
 * the RouterParams mock).
 */

// [FID-2026-0913-002 repair — protocol added: the fixture predates the
// FID-2026-0911-003 protocol step; the machine records the 'openai' default
// on the empty protocol submit, so the persisted-form equality pins need it.]
export const CFG: CustomProviderConfig = {
  id: 'my-gateway',
  label: 'My Gateway',
  baseUrl: 'https://gw.example.com/v1',
  apiKeyEnvVar: 'MY_GW_KEY',
  protocol: 'openai',
  catalog: {
    source: 'inline',
    models: { 'my-gateway/m1': 'M One' },
  },
}

/** Redirect the config dir + clean routing env + reset stores (pre-test). */
export function setupProviderCommandEnv(): {
  tempDir: string
  originals: Record<string, string | undefined>
} {
  const originals = {
    configDir: process.env.SAVANT_CODE_CONFIG_DIR,
    directProvider: process.env.DIRECT_PROVIDER,
    inferenceBaseUrl: process.env.INFERENCE_BASE_URL,
    myGwKey: process.env.MY_GW_KEY,
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-cmd-'))
  process.env.SAVANT_CODE_CONFIG_DIR = tempDir
  delete process.env.DIRECT_PROVIDER
  delete process.env.INFERENCE_BASE_URL
  delete process.env.MY_GW_KEY
  useChatStore.getState().reset()
  useProviderPickerStore.getState().close()
  cancelWizardSession()
  return { tempDir, originals }
}

/** Restore env + stores + temp dir (post-test). */
export function restoreProviderCommandEnv(
  originals: Record<string, string | undefined>,
  tempDir: string,
): void {
  useChatStore.getState().reset()
  useProviderPickerStore.getState().close()
  cancelWizardSession()
  if (originals.configDir === undefined)
    delete process.env.SAVANT_CODE_CONFIG_DIR
  else process.env.SAVANT_CODE_CONFIG_DIR = originals.configDir
  if (originals.directProvider === undefined) delete process.env.DIRECT_PROVIDER
  else process.env.DIRECT_PROVIDER = originals.directProvider
  if (originals.inferenceBaseUrl === undefined)
    delete process.env.INFERENCE_BASE_URL
  else process.env.INFERENCE_BASE_URL = originals.inferenceBaseUrl
  if (originals.myGwKey === undefined) delete process.env.MY_GW_KEY
  else process.env.MY_GW_KEY = originals.myGwKey
  fs.rmSync(tempDir, { recursive: true, force: true })
}

export function seedSettings(
  tempDir: string,
  customs: CustomProviderConfig[],
): void {
  fs.writeFileSync(
    path.join(tempDir, 'settings.json'),
    JSON.stringify({ customProviders: customs }),
  )
}

export function seedCredentials(
  tempDir: string,
  keys: Record<string, string>,
): void {
  fs.writeFileSync(
    path.join(tempDir, 'credentials.json'),
    JSON.stringify({ providerApiKeys: keys }),
  )
}

export function readSettings(tempDir: string): {
  customProviders?: CustomProviderConfig[]
} {
  return JSON.parse(
    fs.readFileSync(path.join(tempDir, 'settings.json'), 'utf8'),
  ) as { customProviders?: CustomProviderConfig[] }
}

export function makeParams(inputValue: string, messages: ChatMessage[]) {
  const saveToHistory = mock(() => {})
  const setMessages = mock(
    (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      const next = typeof update === 'function' ? update(messages) : update
      messages.length = 0
      messages.push(...next)
    },
  )
  return {
    params: {
      abortControllerRef: { current: null },
      agentMode: 'HYBRID',
      inputRef: { current: null },
      inputValue,
      isChainInProgressRef: { current: false },
      isStreaming: false,
      logoutMutation: {} as RouterParams['logoutMutation'],
      streamMessageIdRef: { current: null },
      addToQueue: () => {},
      clearMessages: () => {},
      saveToHistory,
      scrollToLatest: () => {},
      sendMessage: mock(async () => {}),
      setCanProcessQueue: () => {},
      setInputFocused: mock(() => {}),
      setInputValue: mock(() => {}),
      setIsAuthenticated: () => {},
      setMessages,
      setUser: () => {},
      stopStreaming: () => {},
    } satisfies RouterParams,
    saveToHistory,
  }
}
