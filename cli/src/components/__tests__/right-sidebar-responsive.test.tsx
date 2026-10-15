import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { ChatSidebar } from '../../chat/sidebar'
import { initializeThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { EasterEggProvider } from '../savant-ui/easter-egg-logo'

initializeThemeStore()

test('chat composition follows the breakpoint and preserves manual folds', async () => {
  const setup = await createTestRenderer({
    width: 100,
    height: 24,
    footerHeight: 0,
    exitOnCtrlC: false,
  })
  const root = createRoot(setup.renderer)
  useChatStore.setState({
    sidebarCollapsed: false,
    inputFocused: false,
    inputValue: '',
  })
  root.render(
    <EasterEggProvider>
      <box flexDirection="row" height="100%">
        <box flexGrow={1}>
          <text>CHAT CONTENT</text>
        </box>
        <ChatSidebar
          contextTokensUsed={70}
          contextTokensMax={100}
          contextWindowSource="catalog"
          sessionCost={0.25}
          sidebarModel="vendor/fully-qualified-model-identifier"
          toolsUsed={['read_files']}
          filesChanged={{ created: 1, modified: 2, added: 0, deleted: 0 }}
          agentStack={[]}
          toolHistory={[]}
          isStreaming={false}
          isWaitingForResponse={false}
          fsmPhase="idle"
          agentMode="HYBRID"
        />
      </box>
    </EasterEggProvider>,
  )
  const flush = async () => {
    await Bun.sleep(50)
    await setup.renderOnce()
    await Bun.sleep(30)
    await setup.renderOnce()
  }
  try {
    await flush()
    expect(setup.captureCharFrame()).toContain('Model')
    setup.resize(99, 24)
    await flush()
    expect(setup.renderer.root.findDescendantById('rail-brand')).toBeDefined()
    expect(setup.captureCharFrame()).not.toContain('Model ·')
    await setup.mockMouse.moveTo(98, 4)
    await flush()
    expect(setup.captureCharFrame()).toContain('Model')
    expect(setup.captureCharFrame()).toContain('CHAT CONTENT')
    setup.mockInput.pressKey('c', { ctrl: true })
    await flush()
    expect(setup.renderer.root.findDescendantById('rail-brand')).toBeDefined()
    await setup.mockMouse.moveTo(1, 1)
    setup.resize(100, 24)
    await flush()
    expect(setup.captureCharFrame()).toContain('Model')
    useChatStore.setState({ inputFocused: true, inputValue: 'editing' })
    setup.mockInput.pressKey('b', { ctrl: true })
    await flush()
    expect(useChatStore.getState().sidebarCollapsed).toBe(false)
    useChatStore.setState({ inputValue: '' })
    setup.mockInput.pressKey('b', { ctrl: true })
    await flush()
    expect(useChatStore.getState().sidebarCollapsed).toBe(true)
    await setup.mockMouse.moveTo(98, 4)
    await flush()
    expect(setup.captureCharFrame()).not.toContain('Model ·')
    setup.resize(160, 40)
    await flush()
    expect(setup.renderer.root.findDescendantById('rail-brand')).toBeDefined()
    expect(setup.captureCharFrame()).not.toContain('Model ·')
    setup.mockInput.pressKey('b', { ctrl: true })
    await flush()
    expect(setup.captureCharFrame()).toContain('Model')
    expect(setup.captureCharFrame()).toContain('Context · 70/100 · 70%')
    for (const height of [20, 24, 40]) {
      setup.resize(100, height)
      await flush()
      const collapse = setup.renderer.root.findDescendantById(
        'sidebar-fold-button',
      )
      if (!collapse) throw new Error('Missing collapse button')
      await setup.mockMouse.click(collapse.x + 2, collapse.y + 1)
      await flush()
      expect(useChatStore.getState().sidebarCollapsed).toBe(true)
      const unfold =
        setup.renderer.root.findDescendantById('rail-unfold-button')
      if (!unfold) throw new Error('Missing unfold button')
      await setup.mockMouse.click(unfold.x + 2, unfold.y + 1)
      await flush()
      expect(useChatStore.getState().sidebarCollapsed).toBe(false)
      expect(setup.captureCharFrame()).toContain('Context · 70/100 · 70%')
      expect(setup.captureCharFrame().match(/Window source/g)).toHaveLength(1)
    }
  } finally {
    root.unmount()
    setup.renderer.destroy()
    useChatStore.setState({
      sidebarCollapsed: false,
      inputValue: '',
      inputFocused: false,
    })
  }
})
