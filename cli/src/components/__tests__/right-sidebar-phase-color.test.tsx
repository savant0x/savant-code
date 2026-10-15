// FID-2026-1009-007 — wiring pin: the rendered phase line in the live
// sidebar carries the phase's OWN color (not the hardcoded muted it
// regressed to). Renders through the real OpenTUI test renderer because
// the store-driven phase is invisible to renderToStaticMarkup (zustand's
// useStore serves the INITIAL state as the server snapshot).
import { RGBA, rgbToHex } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { ChatSidebar } from '../../chat/sidebar'
import { initializeThemeStore, useThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { EasterEggProvider } from '../savant-ui/easter-egg-logo'

initializeThemeStore()

/** Minimal shape of the rendered text nodes this test walks. */
interface TextNodeLike {
  plainText: string
  fg: RGBA
}

function collectTextNodes(node: unknown, out: TextNodeLike[]): TextNodeLike[] {
  const renderable = node as {
    getChildren?: () => unknown[]
    plainText?: unknown
    fg?: unknown
  }
  if (typeof renderable.getChildren === 'function') {
    if (
      typeof renderable.plainText === 'string' &&
      renderable.fg instanceof RGBA
    )
      out.push(renderable as unknown as TextNodeLike)
    for (const child of renderable.getChildren()) collectTextNodes(child, out)
  }
  return out
}

async function renderSidebarPhase(phase: string): Promise<string> {
  const setup = await createTestRenderer({
    width: 160,
    height: 40,
    footerHeight: 0,
    exitOnCtrlC: false,
  })
  const root = createRoot(setup.renderer)
  useChatStore.setState({
    sidebarCollapsed: false,
    inputFocused: false,
    inputValue: '',
    fsmPhase: phase,
    activity: { kind: 'idle', since: Date.now() },
  })
  root.render(
    <EasterEggProvider>
      <box flexDirection="row" height="100%">
        <box flexGrow={1}>
          <text>CHAT</text>
        </box>
        <ChatSidebar
          contextTokensUsed={70}
          contextTokensMax={100}
          contextWindowSource="catalog"
          sessionCost={0.25}
          sidebarModel="vendor/model-x"
          toolsUsed={[]}
          filesChanged={{ created: 0, modified: 0, added: 0, deleted: 0 }}
          agentStack={[]}
          toolHistory={[]}
          isStreaming={false}
          isWaitingForResponse={false}
          fsmPhase={phase}
          agentMode="HYBRID"
        />
      </box>
    </EasterEggProvider>,
  )
  const flush = async () => {
    await Bun.sleep(60)
    await setup.renderOnce()
    await Bun.sleep(40)
    await setup.renderOnce()
  }
  try {
    await flush()
    const nodes = collectTextNodes(setup.renderer.root, [])
    // FID-2026-1010-004: the label is `Phase · …` — FID-2026-1008-006 renamed
    // it from `ECHO · …` in agent-status.tsx and this pin kept the old string,
    // so the gate went red with the color contract untouched.
    const phaseNode = nodes.find((node) => node.plainText.includes('Phase ·'))
    if (!phaseNode) throw new Error(`phase line not rendered for ${phase}`)
    return rgbToHex(phaseNode.fg)
  } finally {
    root.unmount()
    setup.renderer.destroy()
    useChatStore.setState({
      fsmPhase: 'idle',
      activity: { kind: 'idle', since: 0 },
    })
  }
}

test('the rendered phase line carries the phase color (FID-2026-1009-007)', async () => {
  const theme = useThemeStore.getState().theme
  const expected: Record<string, string> = {
    idle: theme.muted,
    red: theme.error,
    green: theme.success,
    audit: theme.warning,
    adversarial: theme.phaseAdversarial,
    self_correct: theme.warning,
    complete: theme.primary,
  }
  const seen = new Set<string>()
  for (const [phase, hex] of Object.entries(expected)) {
    const rendered = await renderSidebarPhase(phase)
    expect(rendered).toBe(hex.toLowerCase())
    seen.add(rendered)
  }
  // Six distinct colors across the seven phases (self_correct shares
  // audit's warning by design) — the line is not monochrome.
  expect(seen.size).toBeGreaterThanOrEqual(6)
}, 30_000)
