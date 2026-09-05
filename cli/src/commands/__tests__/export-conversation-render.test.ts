import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { handleExportConversationCommand } from '../export-conversation'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

// FID-2026-0819-005 Loop 182: HTML-escaping/rendering suites split verbatim
// from export-conversation.test.ts (harness copied verbatim).

describe('handleExportConversationCommand', () => {
  let tempDir: string
  let renderedMessages: ChatMessage[]

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'savant-export-'))
    renderedMessages = []
    useChatStore.setState({
      messages: [],
      chatSessionId: 'test-session-1234',
    })
  })

  afterEach(() => {
    useChatStore.setState({ messages: [], chatSessionId: '' })
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  function makeParams(): RouterParams {
    return {
      inputRef: { current: null },
      setMessages: mock(
        (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
          renderedMessages =
            typeof update === 'function' ? update(renderedMessages) : update
        },
      ),
      saveToHistory: mock(() => {}),
      setInputValue: mock(() => {}),
      setInputFocused: mock(() => {}),
      setIsAuthenticated: mock(() => {}),
      setUser: mock(() => {}),
      addToQueue: mock(() => {}),
      clearMessages: mock(() => {}),
      scrollToLatest: mock(() => {}),
      sendMessage: mock(async () => {}),
      setCanProcessQueue: mock(() => {}),
      setStreamStatus: mock(() => {}),
      inputValue: '/export',
      agentMode: 'HYBRID',
      isChainInProgressRef: { current: false },
      isStreaming: false,
      streamMessageIdRef: { current: null },
      abortControllerRef: { current: null },
      logoutMutation: {} as RouterParams['logoutMutation'],
    } as unknown as RouterParams
  }

  test('escapes HTML in message content to prevent injection', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'user',
          content: '<script>alert("pwned")</script>',
          timestamp: '2026-08-04T00:00:00.000Z',
        },
      ],
      chatSessionId: 'test-session-1234',
    })

    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    const html = fs.readFileSync(outputPath, 'utf8')
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  test('renders tool blocks with the terminal icon and escaped output', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'ai',
          blocks: [
            {
              type: 'tool',
              toolName: 'read_files',
              input: { paths: ['a.ts'] },
              output: 'line one\nline two',
            },
          ],
          timestamp: '2026-08-04T00:00:00.000Z',
        } as unknown as ChatMessage,
      ],
      chatSessionId: 'test-session-1234',
    })

    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    const html = fs.readFileSync(outputPath, 'utf8')
    expect(html).toContain('fa-terminal')
    expect(html).toContain('Read Files')
    expect(html).toContain('line one')
  })

  test('renders sub-agent blocks with the proper agent name', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'ai',
          content: '',
          blocks: [
            {
              type: 'agent',
              agentId: 'detective-1',
              agentName: 'detective',
              agentType: 'detective',
              content: 'Analysis complete',
              status: 'complete',
              initialPrompt: 'Investigate',
            },
          ],
          timestamp: '2026-08-04T00:00:00.000Z',
        },
      ],
      chatSessionId: 'test-session-1234',
    })

    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    const html = fs.readFileSync(outputPath, 'utf8')
    expect(html).toContain('Subagent: Detective')
    expect(html).toContain('fa-share-nodes')
    expect(html).toContain('Analysis complete')
  })
})
