import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import {
  beginProviderSetup,
  getProviderSetupInfo,
} from '../../utils/provider-setup'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

describe('routeUserPrompt providerSetup mode', () => {
  let originalConfigDir: string | undefined
  let originalApiKey: string | undefined
  let tempDir: string

  beforeEach(() => {
    originalConfigDir = process.env.SAVANT_CODE_CONFIG_DIR
    originalApiKey = process.env.OPENCODE_GO_API_KEY
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-provider-route-'))
    process.env.SAVANT_CODE_CONFIG_DIR = tempDir
    delete process.env.OPENCODE_GO_API_KEY
    useChatStore.getState().reset()
    beginProviderSetup('opencode-go')
    useChatStore.getState().setInputMode('providerSetup')
  })

  afterEach(() => {
    useChatStore.getState().reset()
    if (originalConfigDir === undefined)
      delete process.env.SAVANT_CODE_CONFIG_DIR
    else process.env.SAVANT_CODE_CONFIG_DIR = originalConfigDir
    if (originalApiKey === undefined) delete process.env.OPENCODE_GO_API_KEY
    else process.env.OPENCODE_GO_API_KEY = originalApiKey
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  test('stores the key without saving or rendering the secret', async () => {
    const saveToHistory = mock(() => {})
    const setInputValue = mock(() => {})
    const setInputFocused = mock(() => {})
    let renderedMessages: ChatMessage[] = []
    const setMessages = mock(
      (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
        renderedMessages =
          typeof update === 'function' ? update(renderedMessages) : update
      },
    )
    const secret = 'sentinel-opencode-api-key'

    const params = {
      abortControllerRef: { current: null },
      agentMode: 'EDIT',
      inputRef: { current: null },
      inputValue: secret,
      isChainInProgressRef: { current: false },
      isStreaming: false,
      logoutMutation: {} as RouterParams['logoutMutation'],
      streamMessageIdRef: { current: null },
      addToQueue: () => {},
      clearMessages: () => {},
      saveToHistory,
      scrollToLatest: () => {},
      sendMessage: async () => {},
      setCanProcessQueue: () => {},
      setInputFocused,
      setInputValue,
      setIsAuthenticated: () => {},
      setMessages,
      setUser: () => {},
      stopStreaming: () => {},
    } satisfies RouterParams

    const { routeUserPrompt } = await import('../router')
    await routeUserPrompt(params)

    expect(saveToHistory).not.toHaveBeenCalled()
    expect(process.env.OPENCODE_GO_API_KEY).toBe(secret)
    expect(useChatStore.getState().inputMode).toBe('default')
    expect(setInputFocused).toHaveBeenCalledWith(true)

    const setupInfo = getProviderSetupInfo('opencode-go')
    expect(setupInfo?.envVar).toBe('OPENCODE_GO_API_KEY')
    expect(JSON.stringify(renderedMessages)).not.toContain(secret)
  })
})
