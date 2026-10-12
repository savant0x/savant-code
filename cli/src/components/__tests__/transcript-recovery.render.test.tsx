import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { waitForNativeFrame } from './native-render-frame'
import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { renderMarkdown } from '../../utils/markdown-renderer'
import { createMarkdownPalette } from '../../utils/theme-system'
import { AgentBody } from '../blocks/agent-branch-body'
import { BlocksRenderer } from '../blocks/blocks-renderer'
import { TranscriptBoundary } from '../blocks/transcript-boundary'
import { ErrorBoundary } from '../error-boundary'
import { RichTextValue } from '../tools/structured-card/rich-text'

import type { ContentBlock } from '../../types/chat'

initializeThemeStore()

test('host failure stays local on initial mount and restored history; input survives', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 24,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  let entered = ''
  const blocks: ContentBlock[] = [
    { type: 'html', render: () => <box>{'illegal raw host text'}</box> },
    { type: 'text', content: 'preserved content' },
  ]
  const palette = createMarkdownPalette(useThemeStore.getState().theme)
  const transcript = (key: string) => (
    <ErrorBoundary fallback={<text>ROOT FAILED</text>}>
      <box>
        {key.startsWith('nested') ? (
          <AgentBody
            key={key}
            agentBlock={{
              type: 'agent',
              agentId: key,
              agentType: 'researcher-web',
              agentName: 'Researcher',
              status: 'complete',
              content: '',
              blocks,
            }}
            keyPrefix={key}
            parentIsStreaming={false}
            availableWidth={100}
            markdownPalette={palette}
            onToggleCollapsed={() => {}}
            onBuildFast={() => {}}
            onBuildMax={() => {}}
            onBuildLite={() => {}}
          />
        ) : (
          <BlocksRenderer
            key={key}
            sourceBlocks={blocks}
            messageId={key}
            isLoading={false}
            isComplete
            isUser={false}
            textColor="white"
            availableWidth={100}
            markdownPalette={palette}
            onToggleCollapsed={() => {}}
            onBuildFast={() => {}}
            onBuildMax={() => {}}
            onBuildLite={() => {}}
          />
        )}
        <text>SIBLING RESULT</text>
        <input
          value="next prompt"
          focused
          onInput={(value) => {
            entered = value
          }}
        />
      </box>
    </ErrorBoundary>
  )
  try {
    for (const key of ['live', 'restored', 'nested-live', 'nested-restored']) {
      root.render(transcript(key))
      const frame = await waitForNativeFrame(
        setup,
        (value) =>
          value.includes('ROOT FAILED') ||
          value.includes('session is still active'),
      )
      expect(frame).not.toContain('ROOT FAILED')
      expect(frame).toContain('session is still active')
      expect(frame).toContain('preserved content')
      expect(frame).toContain('SIBLING RESULT')
      expect(frame).toContain('next prompt')
      entered = ''
      setup.mockInput.pressKey('x')
      await waitForNativeFrame(setup, () => entered.includes('x'))
      expect(entered).toContain('x')
    }
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)

test('legacy raw markdown placement reproduces the recorded host failure locally', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 24,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(
      <TranscriptBoundary label="legacy-rich-text" rawContent="raw evidence">
        <box>{renderMarkdown('# Papers\n\nA **supported** finding.')}</box>
      </TranscriptBoundary>,
    )
    expect(
      await waitForNativeFrame(setup, (frame) =>
        frame.includes('session is still active'),
      ),
    ).toContain('session is still active')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)

test('structured markdown uses legal text hosts in the native reconciler', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 24,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  try {
    root.render(
      <ErrorBoundary fallback={<text>ROOT FAILED</text>}>
        <RichTextValue
          value={'# Papers\n\nA **supported** finding.\n\n- A limitation'}
          theme={useThemeStore.getState().theme}
          fallback={<text>plain</text>}
        />
      </ErrorBoundary>,
    )
    const frame = await waitForNativeFrame(
      setup,
      (value) => value.includes('ROOT FAILED') || value.includes('supported'),
    )
    expect(frame).not.toContain('ROOT FAILED')
    expect(frame).toContain('supported')
    expect(frame).toContain('limitation')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)

test('retry remounts corrected content without restarting the session', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 24,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  let broken = true
  const Content = () =>
    broken ? <box>{'illegal host text'}</box> : <text>RESTORED CONTENT</text>
  try {
    root.render(
      <TranscriptBoundary
        label="retry"
        rawContent={() => {
          throw new Error('bad serialization')
        }}
      >
        <Content />
      </TranscriptBoundary>,
    )
    await waitForNativeFrame(setup, (frame) =>
      frame.includes('original content is preserved'),
    )
    expect(setup.captureCharFrame()).toContain('original content is preserved')
    const retry = setup.renderer.root.findDescendantById(
      'transcript-retry:retry',
    )
    expect(retry).toBeDefined()
    if (!retry) throw new Error('Missing retry control')
    broken = false
    await setup.mockMouse.click(retry.x + 1, retry.y)
    await waitForNativeFrame(setup, (frame) =>
      frame.includes('RESTORED CONTENT'),
    )
    expect(setup.captureCharFrame()).toContain('RESTORED CONTENT')
    expect(setup.captureCharFrame()).not.toContain('could not be displayed')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 30_000)
