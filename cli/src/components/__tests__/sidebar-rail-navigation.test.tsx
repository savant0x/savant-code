import { ScrollBoxRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { contrastRatio } from '@savant-code/design-systems'
import { describe, expect, test } from 'bun:test'
import React from 'react'

import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { RightSidebar } from '../right-sidebar'
import { createSidebarFocusController } from '../right-sidebar-focus'
import { EasterEggProvider } from '../savant-ui/easter-egg-logo'
import { SidebarRail } from '../sidebar-rail'

import type { Renderable } from '@opentui/core'

initializeThemeStore()
const props = {
  tokensUsed: 70,
  tokensMax: 100,
  windowSource: 'catalog' as const,
  cost: 0.25,
  model: 'vendor/fully-qualified-model-identifier',
  mode: 'default',
  agent: 'Savant',
  toolsUsed: ['read_files'],
  toolsAvailable: ['apply_patch'],
  filesChanged: { created: 1, modified: 2, added: 0, deleted: 0 },
  agentStack: [],
  toolHistory: [],
  isStreaming: false,
  isWaitingForResponse: false,
  fsmPhase: 'idle',
}

function find(
  node: Renderable,
  predicate: (node: Renderable) => boolean,
): Renderable | undefined {
  if (predicate(node)) return node
  for (const child of node.getChildren()) {
    const found = find(child, predicate)
    if (found) return found
  }
  return undefined
}

async function mount(rail = false, height = 24) {
  const setup = await createTestRenderer({
    width: 100,
    height,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  const controller = createSidebarFocusController()
  controller.reducedMotion = true
  useChatStore.setState({
    inputFocused: false,
    inputValue: '',
    activity: { kind: 'idle', since: 0 },
  })
  root.render(
    <EasterEggProvider>
      <box flexDirection="row" height="100%">
        <box flexGrow={1}>
          <text>CHAT CONTENT</text>
        </box>
        {rail ? (
          <SidebarRail
            {...props}
            focusController={controller}
            onUnfold={() => {}}
          />
        ) : (
          <RightSidebar
            {...props}
            focusController={controller}
            onCollapse={() => {}}
          />
        )}
      </box>
    </EasterEggProvider>,
  )
  const flush = async () => {
    await Bun.sleep(50)
    await setup.renderOnce()
    await Bun.sleep(30)
    await setup.renderOnce()
  }
  await flush()
  return {
    ...setup,
    flush,
    root,
    controller,
    close: () => {
      root.unmount()
      setup.renderer.destroy()
    },
  }
}

describe('native sidebar interaction', () => {
  test('rail Enter expands and reveals the requested offscreen section', async () => {
    const setup = await mount(true, 12)
    setup.resize(50, 12)
    try {
      setup.controller.focusSection('rail-History')
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('History')
      const focusedSpan = setup
        .captureSpans()
        .lines.flatMap((line) => line.spans)
        .find((span) => span.text.includes('History'))
      expect(focusedSpan).toBeDefined()
      if (!focusedSpan) throw new Error('Missing focused label')
      const hex = (color: typeof focusedSpan.fg) =>
        '#' +
        color
          .toInts()
          .slice(0, 3)
          .map((channel) => channel.toString(16).padStart(2, '0'))
          .join('')
      expect(
        contrastRatio(hex(focusedSpan.fg), hex(focusedSpan.bg)),
      ).toBeGreaterThanOrEqual(4.5)
      setup.mockInput.pressEnter()
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('History')
      expect(setup.captureCharFrame()).toContain('CHAT CONTENT')
      setup.mockInput.pressKey(' ')
      await setup.flush()
      expect(setup.controller.folds.get('History')).toBe(true)
      const detail = find(
        setup.renderer.root,
        (node) => node instanceof ScrollBoxRenderable,
      )
      if (!(detail instanceof ScrollBoxRenderable))
        throw new Error('Missing details')
      detail.scrollBy(1)
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('(empty)')
      setup.mockInput.pressEscape()
      await setup.flush()
      expect(setup.renderer.root.findDescendantById('rail-brand')).toBeDefined()
    } finally {
      setup.close()
    }
  })
  test('fold and scroll survive density and theme changes', async () => {
    const setup = await mount(false)
    try {
      setup.controller.focusSection('Tools')
      setup.mockInput.pressEnter()
      await setup.flush()
      expect(setup.controller.folds.get('Tools')).toBe(true)
      const scroll = find(
        setup.renderer.root,
        (node) => node instanceof ScrollBoxRenderable,
      )
      expect(scroll instanceof ScrollBoxRenderable).toBe(true)
      if (!(scroll instanceof ScrollBoxRenderable))
        throw new Error('Missing detail viewport')
      scroll.scrollTop = 4
      setup.resize(100, 19)
      useThemeStore.getState().setThemeName('light')
      await setup.flush()
      expect(setup.controller.folds.get('Tools')).toBe(true)
      expect(scroll.scrollTop).toBeGreaterThan(0)
      setup.controller.focusSection('Tools')
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('read_files')
      setup.resize(100, 24)
      useThemeStore.getState().setThemeName('dark')
      await setup.flush()
      expect(setup.controller.folds.get('Tools')).toBe(true)
    } finally {
      setup.close()
      useThemeStore.getState().setThemeName('dark')
    }
  })
  test('native density budgets leave detail reachable at short heights', async () => {
    for (const height of [1, 8, 12, 19, 20, 24]) {
      const setup = await mount(false, height)
      try {
        expect(
          setup.captureCharFrame().split('\n').length,
        ).toBeGreaterThanOrEqual(height)
        if (height > 1) {
          setup.controller.focusSection('History')
          await setup.flush()
          expect(setup.captureCharFrame()).toContain('History')
        }
      } finally {
        setup.close()
      }
    }
  })
  test('Ctrl+G passes through; F6 reaches controls without losing the draft', async () => {
    for (const rail of [false, true]) {
      const setup = await mount(rail)
      try {
        useChatStore.setState({ inputFocused: true, inputValue: 'editing' })
        setup.mockInput.pressKey('g', { ctrl: true })
        await setup.flush()
        expect(
          find(setup.renderer.root, (node) => node.focused),
        ).toBeUndefined()
        setup.mockInput.pressKey('g', { ctrl: true })
        await setup.flush()
        expect(
          find(setup.renderer.root, (node) => node.focused),
        ).toBeUndefined()
        setup.mockInput.pressKey('F6')
        await setup.flush()
        expect(find(setup.renderer.root, (node) => node.focused)).toBeDefined()
        expect(useChatStore.getState().inputValue).toBe('editing')
      } finally {
        setup.close()
      }
    }
  })
  test('context stays below details in spacious mode and scrolls last when short', async () => {
    const setup = await mount(false, 20)
    try {
      const context = setup.renderer.root.findDescendantById('sidebar-context')
      const details = setup.renderer.root.findDescendantById('sidebar-details')
      if (!context || !(details instanceof ScrollBoxRenderable))
        throw new Error('Missing context or details')
      expect(details.viewport.height).toBeGreaterThanOrEqual(6)
      expect(context.y).toBeGreaterThanOrEqual(details.y + details.height)
      const bar = find(
        context,
        (node) => node.width === 24 && node.height === 1,
      )
      if (!bar) throw new Error('Missing meter bar')
      const version = setup.renderer.root.findDescendantById('sidebar-version')
      if (!version) throw new Error('Missing footer version')
      expect(version.y).toBeLessThan(bar.y)
      expect(
        Math.abs(version.x - context.x - (context.width - version.width) / 2),
      ).toBeLessThanOrEqual(0.5)
      expect(
        Math.abs(bar.x - context.x - (context.width - bar.width) / 2),
      ).toBeLessThanOrEqual(0.5)
      expect(setup.captureCharFrame().match(/Window source/g)).toHaveLength(1)
      setup.controller.focusSection('History')
      setup.mockInput.pressEnter()
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('Window source')
      setup.resize(100, 19)
      await setup.flush()
      const shortDetails =
        setup.renderer.root.findDescendantById('sidebar-details')
      if (!(shortDetails instanceof ScrollBoxRenderable))
        throw new Error('Missing short viewport')
      expect(
        !!find(shortDetails, (node) => node.id === 'sidebar-context'),
      ).toBe(true)
      shortDetails.scrollTo(shortDetails.scrollHeight)
      await setup.flush()
      expect(setup.captureCharFrame()).toContain('Window source')
    } finally {
      setup.close()
    }
  })
  test('original S rail mark and raised fold buttons retain their geometry', async () => {
    for (const rail of [false, true]) {
      const setup = await mount(rail)
      try {
        const button = setup.renderer.root.findDescendantById(
          rail ? 'rail-unfold-button' : 'sidebar-fold-button',
        )
        expect(button?.width).toBe(5)
        expect(button?.height).toBe(3)
        if (rail) {
          const mark = setup.renderer.root.findDescendantById('rail-brand')
          expect(mark?.height).toBe(2)
          expect(mark?.parent?.height).toBe(2)
          expect(setup.captureCharFrame()).toContain('▀')
          const label =
            setup.renderer.root.findDescendantById('rail-Status-label')
          if (!label?.parent) throw new Error('Missing rail label')
          expect(
            label.y - (mark?.y ?? 0) - (mark?.height ?? 0),
          ).toBeGreaterThanOrEqual(1)
          expect(
            Math.abs(
              label.x - label.parent.x - (label.parent.width - label.width) / 2,
            ),
          ).toBeLessThanOrEqual(0.5)
        }
      } finally {
        setup.close()
      }
    }
  })
})
