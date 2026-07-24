import { describe, test, expect, mock, beforeEach } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { findCommand } from '../command-registry'

import type { RouterParams } from '../command-registry'

describe('/dev command', () => {
  const createMockParams = (overrides: Partial<RouterParams> = {}): RouterParams =>
    ({
      abortControllerRef: { current: null },
      agentMode: 'EDIT',
      inputRef: { current: null },
      inputValue: '/dev on',
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

  beforeEach(() => {
    useChatStore.getState().setDevMode(false)
  })

  test('findCommand returns /dev command', () => {
    const dev = findCommand('dev')
    expect(dev).toBeDefined()
    expect(dev?.name).toBe('dev')
    expect(dev?.acceptsArgs).toBe(true)
  })

  test('/dev on activates dev override', () => {
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev on' })

    expect(useChatStore.getState().devMode).toBe(false)
    dev!.handler(params, 'on')

    expect(useChatStore.getState().devMode).toBe(true)
    expect(params.setMessages).toHaveBeenCalled()
  })

  test('/dev off deactivates dev override', () => {
    useChatStore.getState().setDevMode(true)
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev off' })

    dev!.handler(params, 'off')

    expect(useChatStore.getState().devMode).toBe(false)
  })

  test('bare /dev activates dev override', () => {
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev' })

    dev!.handler(params, '')

    expect(useChatStore.getState().devMode).toBe(true)
  })

  test('/dev on when already active reports already active', () => {
    useChatStore.getState().setDevMode(true)
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev on' })

    dev!.handler(params, 'on')

    expect(useChatStore.getState().devMode).toBe(true)
    const setMessagesCall = (params.setMessages as ReturnType<typeof mock>).mock.calls[0][0]
    const newMessages = setMessagesCall([])
    const messageText = JSON.stringify(newMessages)
    expect(messageText).toContain('already active')
  })

  test('/dev off when already off reports already off', () => {
    useChatStore.getState().setDevMode(false)
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev off' })

    dev!.handler(params, 'off')

    expect(useChatStore.getState().devMode).toBe(false)
    const setMessagesCall = (params.setMessages as ReturnType<typeof mock>).mock.calls[0][0]
    const newMessages = setMessagesCall([])
    const messageText = JSON.stringify(newMessages)
    expect(messageText).toContain('already off')
  })

  test('unknown /dev subcommand reports usage', () => {
    const dev = findCommand('dev')
    const params = createMockParams({ inputValue: '/dev password' })

    dev!.handler(params, 'password')

    expect(useChatStore.getState().devMode).toBe(false)
    const setMessagesCall = (params.setMessages as ReturnType<typeof mock>).mock.calls[0][0]
    const newMessages = setMessagesCall([])
    const messageText = JSON.stringify(newMessages)
    expect(messageText).toContain('Unknown /dev subcommand')
    expect(messageText).toContain('/dev on')
    expect(messageText).toContain('/dev off')
  })

  test('/dev is case-insensitive', () => {
    const dev = findCommand('DEV')
    expect(dev).toBeDefined()
    expect(dev?.name).toBe('dev')
  })
})
