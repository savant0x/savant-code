import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { useChatStore } from '../../state/chat-store'
import { handleExportConversationCommand } from '../export-conversation'
import { CHARACTER_LOGO_DATA_URI } from '../graph-export/character'

import type { ChatMessage } from '../../types/chat'
import type { RouterParams } from '../command-registry'

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

  function renderedText(): string {
    return renderedMessages.map((m) => m.content ?? '').join('\n')
  }

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

  test('exports a branded HTML report with logo, Font Awesome, and tokens', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'user',
          content: 'Hello Savant',
          timestamp: '2026-08-04T00:00:00.000Z',
        },
        {
          id: 'm2',
          variant: 'ai',
          content: '**Ready** to help.\n\n```ts\nconst x = 1\n```',
          timestamp: '2026-08-04T00:00:01.000Z',
        },
      ],
      chatSessionId: 'test-session-1234',
    })

    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    const html = fs.readFileSync(outputPath, 'utf8')

    // Logo embedded as a base64 data URI (no runtime file dependency)
    expect(html).toContain('data:image/png;base64,')
    expect(html).toContain('<img class="logo"')
    // Branding alignment (FID-2026-0807-009): the header uses the character
    // logo, identical to the graph export surface.
    expect(html).toContain(`<img class="logo" src="${CHARACTER_LOGO_DATA_URI}"`)

    // Brand header: logo, name, and version stacked in a centered column
    expect(html).toContain('<div class="brand">')
    expect(html).toContain(
      '.brand {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    justify-content: center;',
    )
    // Version sits on its own line under the brand name (centered)
    expect(html).toContain('<span class="brand-version">v')
    expect(html).toMatch(/class="brand-version">v\d+\.\d+\.\d+</)

    // Message rows: icon + role on one line (.row-head), content below
    // flush with the icon (.row-content) — not indented under the label
    expect(html).toContain('<div class="row-head">')
    expect(html).toContain('<div class="row-content">')
    expect(html).not.toContain('row-body')

    // Font Awesome 6.7.2 is inlined as base64 webfonts — no CDN, fully offline
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).toContain('url(data:font/woff2;base64,')
    expect(html).toContain('Font Awesome 6 Free')

    // Neon Slate brand token + cyan tool badge (not purple)
    expect(html).toContain('--brand: #18faf9')
    expect(html).toContain('--tool-badge: #18faf9')
    // Cyan-only accent family: no lavender/purple tokens anywhere
    expect(html).toContain('--accent: #18faf9')
    expect(html).toContain('--accent-light: #9ffbfa')
    expect(html).toContain('--code: #7ad4d6')
    expect(html).not.toContain('#a599e9')
    expect(html).not.toContain('#e4ccff')
    expect(html).not.toContain('#b1baf9')
    expect(html).not.toContain('--lavender')
    // Role labels stay distinguishable within the cyan family:
    // user = soft cyan (--link), assistant = brand cyan (--accent)
    expect(html).toContain('.row-user .row-role { color: var(--link); }')
    expect(html).toContain('.row-assistant .row-role { color: var(--brand); }')
    // Neutral border for user rows — no purple tint, no navy (operator
    // directive 2026-08-16: slate family is pre-fork branding)
    expect(html).toContain('--border-user: #26262e')
    expect(html).not.toContain('#26324a')
    expect(html).not.toContain('#2d2b55')
    expect(html).not.toContain('--tool-badge: #5945b1')

    // Reference design structure (no // prefix)
    expect(html).toContain('class="corner corner-tl"')
    expect(html).not.toContain('<span class="prefix">')
    expect(html).toContain('Expand all')

    // Brand: two-word display name + full session id (never truncated)
    expect(html).toContain('Savant Code')
    expect(html).toContain('test-session-1234')
    expect(html).not.toContain('test-sessio…')

    // Footer: text-only line (no logo image in front of 'Exported from')
    expect(html).not.toContain('logo-mini')
    expect(html).toContain(
      '<p>Exported from <span class="brand">Savant Code</span>',
    )

    // Meta grid is center aligned
    expect(html).toMatch(
      /gap: 12px 24px;\s*margin: 0;\s*font-size: 12px;\s*text-align: center;/,
    )

    // Role markers: Savant rows carry the logo image, user rows carry an icon
    expect(html).toContain('class="row-logo"')
    // Row markers use the same character logo as the header.
    expect(html).toContain(
      `<img class="row-logo" src="${CHARACTER_LOGO_DATA_URI}"`,
    )
    expect(html).toContain('fa-user')
    expect(html).toContain('>Savant</span>')

    // Timestamp is MM-DD-YYYY 12h AM/PM EST
    expect(html).toMatch(/\d{2}-\d{2}-\d{4} \d{1,2}:\d{2} (AM|PM) EST/)

    // Every message row carries a bottom-aligned copy button whose payload is
    // JSON plain text prefixed with the sender (User / Savant).
    const copyButtons = html.match(/class="copy-btn"/g) ?? []
    expect(copyButtons.length).toBe(2)
    expect(html).toContain('onclick="copyMessage(this)"')
    expect(html).toContain('function copyMessage(btn)')
    // Bottom-aligned, not top-aligned
    expect(html).toMatch(/\n\s+bottom: 8px;\n\s+right: 12px;/)
    expect(html).not.toMatch(/\n\s+top: 6px;/)
    // Payload includes the sender label: "User\n\nHello Savant" (JSON-escaped)
    expect(html).toContain('data-copy="&quot;User\\n\\nHello Savant&quot;"')

    // Copy-all button concatenates every message payload
    expect(html).toContain('onclick="copyAll(this)"')
    expect(html).toContain('Copy all')
    expect(html).toContain('function copyAll(btn)')
    expect(html).toContain("document.querySelectorAll('.copy-btn')")

    // Rendered markdown content
    expect(html).toContain('<strong>Ready</strong>')
    expect(html).toContain('<pre><code class="language-ts">')

    // Success message names the output path
    expect(renderedText()).toContain('Exported 2 messages')
    expect(renderedText()).toContain(outputPath)
  })

  test('copy payload mirrors the rendered row (blocks over content, pretty output, text attachments)', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 'm1',
          variant: 'ai',
          // Blocks render, so the copy payload must include blocks but NOT this
          // content prose (the row displays either/or, never both).
          content: 'This prose is hidden when blocks exist',
          blocks: [
            {
              type: 'tool',
              toolName: 'read_files',
              input: { paths: ['a.ts'] },
              output: '{"ok":true}',
            },
          ],
          textAttachments: [{ filename: 'snippet.txt', content: 'x' }],
          timestamp: '2026-08-04T00:00:00.000Z',
        } as unknown as ChatMessage,
      ],
      chatSessionId: 'test-session-1234',
    })

    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    const html = fs.readFileSync(outputPath, 'utf8')
    const m = html.match(/data-copy="([^"]*)"/)
    expect(m).not.toBeNull()
    // Decode the HTML-escaped JSON attribute and parse it back.
    const decoded = m![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    const payload = JSON.parse(decoded)

    expect(payload.startsWith('Savant')).toBe(true)
    expect(payload).not.toContain('This prose is hidden when blocks exist')
    expect(payload).toContain('Read Files')
    expect(payload).toContain('Input:')
    expect(payload).toContain('Output:')
    // JSON tool output is pretty-printed in the copy, matching the rendered row
    expect(payload).toContain('\n  "ok": true\n')
    expect(payload).toContain('Attached 1 pasted text snippet(s)')
  })

  test('reports when the conversation is empty without writing a file', async () => {
    const outputPath = path.join(tempDir, 'report.html')
    await handleExportConversationCommand(makeParams(), outputPath)

    expect(fs.existsSync(outputPath)).toBe(false)
    expect(renderedText()).toContain('Nothing to export')
  })
})
