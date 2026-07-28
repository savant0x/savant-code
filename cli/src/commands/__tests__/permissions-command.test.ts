import { describe, test, expect, mock, beforeEach } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { findCommand } from '../command-registry'

import type { RouterParams } from '../command-registry'

const createMockParams = (
  overrides: Partial<RouterParams> = {},
): RouterParams =>
  ({
    abortControllerRef: { current: null },
    agentMode: 'EDIT',
    inputRef: { current: null },
    inputValue: '/permissions',
    isChainInProgressRef: { current: false },
    isStreaming: false,
    logoutMutation: {} as RouterParams['logoutMutation'],
    streamMessageIdRef: { current: null },
    addToQueue: mock(() => {}),
    clearMessages: mock(() => {}),
    saveToHistory: mock(() => {}),
    scrollToLatest: mock(() => {}),
    sendMessage: mock(async () => {}),
    setCanProcessQueue: mock(() => {}),
    setInputFocused: mock(() => {}),
    setInputValue: mock(() => {}),
    setIsAuthenticated: mock(() => {}),
    setMessages: mock(() => {}),
    setUser: mock(() => {}),
    stopStreaming: mock(() => {}),
    ...overrides,
  }) as RouterParams

describe('/permissions command', () => {
  beforeEach(() => {
    useChatStore.getState().setPermissionMode('prompt')
  })

  test('command exists in registry', () => {
    const command = findCommand('permissions')
    expect(command).toBeDefined()
    expect(command?.name).toBe('permissions')
    expect(command?.acceptsArgs).toBe(true)
  })

  test('aliases resolve to permissions', () => {
    const sandbox = findCommand('sandbox')
    const safety = findCommand('safety')
    expect(sandbox?.name).toBe('permissions')
    expect(safety?.name).toBe('permissions')
  })

  test('/permissions with no args shows current mode', () => {
    const command = findCommand('permissions')
    const setMessages = mock(() => {})
    const params = createMockParams({ setMessages })

    command!.handler(params, '')

    expect(setMessages).toHaveBeenCalled()
    expect(params.saveToHistory).toHaveBeenCalledWith('/permissions')
  })

  test('/permissions safe sets safe mode', () => {
    const command = findCommand('permissions')
    const params = createMockParams()

    command!.handler(params, 'safe')

    expect(useChatStore.getState().permissionMode).toBe('safe')
  })

  test('/permissions unsafe sets unsafe mode', () => {
    const command = findCommand('permissions')
    const params = createMockParams()

    command!.handler(params, 'unsafe')

    expect(useChatStore.getState().permissionMode).toBe('unsafe')
  })

  test('/permissions unknown prints usage and does not change mode', () => {
    const command = findCommand('permissions')
    const setMessages = mock(() => {})
    const params = createMockParams({ setMessages })

    command!.handler(params, 'banana')

    expect(useChatStore.getState().permissionMode).toBe('prompt')
    expect(setMessages).toHaveBeenCalled()
  })
})
