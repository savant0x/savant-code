import { describe, test, expect, mock, beforeEach } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { MODE_DESCRIPTIONS, AGENT_MODES } from '../../utils/constants'
import { findCommand } from '../command-registry'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

const createMockParams = (
  overrides: Partial<RouterParams> = {},
): RouterParams =>
  ({
    abortControllerRef: { current: null },
    agentMode: 'HYBRID',
    inputRef: { current: null },
    inputValue: '/mode',
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

/** Runs the handler and returns the messages produced by its setMessages updater. */
const runAndCollectMessages = (
  commandName: string,
  args: string,
): ChatMessage[] => {
  const command = findCommand(commandName)
  expect(command, `Command ${commandName} should exist`).toBeDefined()

  let collected: ChatMessage[] | null = null
  const params = createMockParams({
    setMessages: ((fn: unknown) => {
      // The /mode handlers always pass a function updater, never a plain
      // array; guard anyway so this helper stays safe to reuse.
      if (typeof fn === 'function') {
        const updater = fn as (prev: ChatMessage[]) => ChatMessage[]
        collected = updater([])
      }
    }) as RouterParams['setMessages'],
  })
  command!.handler(params, args)
  return collected ?? []
}

describe('/mode command (FID-2026-0805-001)', () => {
  beforeEach(() => {
    useChatStore.getState().setAgentMode('HYBRID')
  })

  test('bare mode command exists in registry and accepts args', () => {
    const command = findCommand('mode')
    expect(command).toBeDefined()
    expect(command?.name).toBe('mode')
    expect(command?.acceptsArgs).toBe(true)
  })

  test('/mode with no args lists every mode with its contract and marks current', () => {
    useChatStore.getState().setAgentMode('STRICT')
    const messages = runAndCollectMessages('mode', '')
    const systemMessage = messages[messages.length - 1]
    const content = String(systemMessage.content)

    // Lists all four modes with their MODE_DESCRIPTIONS contracts.
    for (const mode of AGENT_MODES) {
      expect(content).toContain(`**${mode}**`)
      expect(content).toContain(MODE_DESCRIPTIONS[mode])
    }

    // Marks the active mode.
    expect(content).toContain('**STRICT** (current)')
    expect(content).not.toContain('**HYBRID** (current)')
  })

  test('/mode <name> switches mode and shows the contract', () => {
    const messages = runAndCollectMessages('mode', 'strict')
    expect(useChatStore.getState().agentMode).toBe('STRICT')
    const content = String(messages[messages.length - 1].content)
    expect(content).toContain('Switched to STRICT mode.')
    expect(content).toContain(MODE_DESCRIPTIONS.STRICT)
  })

  test('/mode <name> is case-insensitive and trims whitespace', () => {
    runAndCollectMessages('mode', '  analyze ')
    expect(useChatStore.getState().agentMode).toBe('ANALYZE')
  })

  test('/mode <unknown> prints usage and does not change mode', () => {
    const messages = runAndCollectMessages('mode', 'banana')
    expect(useChatStore.getState().agentMode).toBe('HYBRID')
    const content = String(messages[messages.length - 1].content)
    expect(content).toContain('Unknown mode: "banana"')
    expect(content).toContain('/mode:<name>')
  })

  test('/mode <name> <message> switches mode and sends the message', () => {
    const sendMessage = mock(async () => {})
    const setCanProcessQueue = mock(() => {})
    const command = findCommand('mode')
    expect(command).toBeDefined()
    const params = createMockParams({
      inputValue: '/mode strict hello world',
      sendMessage,
      setCanProcessQueue,
    })
    command!.handler(params, 'strict hello world')

    expect(useChatStore.getState().agentMode).toBe('STRICT')
    expect(setCanProcessQueue).toHaveBeenCalledWith(true)
    expect(sendMessage).toHaveBeenCalledWith({
      content: 'hello world',
      agentMode: 'STRICT',
    })
  })

  test('/mode:strict confirmation carries the STRICT ceremony contract', () => {
    const messages = runAndCollectMessages('mode:strict', '')
    expect(useChatStore.getState().agentMode).toBe('STRICT')
    const content = String(messages[messages.length - 1].content)
    expect(content).toContain('Switched to STRICT mode.')
    expect(content).toContain(MODE_DESCRIPTIONS.STRICT)
  })

  test('/mode:hybrid confirmation carries the HYBRID contract', () => {
    const messages = runAndCollectMessages('mode:hybrid', '')
    const content = String(messages[messages.length - 1].content)
    expect(content).toContain('Switched to HYBRID mode.')
    expect(content).toContain(MODE_DESCRIPTIONS.HYBRID)
  })
})
