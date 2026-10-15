// FID-2026-1009-007 — the single-home invariant. The operator reported the
// right sidebar rendering live status TWICE: a fixed area at the top
// (activity label + phase + `Model ·` + `mode · cost`) above the
// "Activity detail" section, which repeats the phase and the model. The
// section is the correct home; the top area's duplicates were removed.
// These pins fail if a fact ever gets two homes again.
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React from 'react'

import { ChatSidebar } from '../../chat/sidebar'
import { initializeThemeStore } from '../../hooks/use-theme'
import { useChatStore } from '../../state/chat-store'
import { EasterEggProvider } from '../savant-ui/easter-egg-logo'

initializeThemeStore()

async function renderSidebarFrame(): Promise<string> {
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
    fsmPhase: 'green',
    activity: {
      kind: 'thinking',
      model: 'vendor/model-x',
      startedAt: Date.now(),
    },
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
          sidebarModel="vendor/fully-qualified-model-identifier"
          toolsUsed={['read_files']}
          filesChanged={{ created: 1, modified: 2, added: 0, deleted: 0 }}
          agentStack={[]}
          toolHistory={[]}
          isStreaming={false}
          isWaitingForResponse={false}
          fsmPhase="green"
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
    return setup.captureCharFrame()
  } finally {
    root.unmount()
    setup.renderer.destroy()
    useChatStore.setState({
      fsmPhase: 'idle',
      activity: { kind: 'idle', since: 0 },
    })
  }
}

test('every live fact has exactly one home in the sidebar (FID-2026-1009-007)', async () => {
  const frame = await renderSidebarFrame()
  // The phase line: once, inside Activity detail. The label reads `Phase · …`
  // — FID-2026-1008-006 renamed it from `ECHO · …` (agent-status.tsx) and this
  // pin kept the old string, so it went red with the invariant untouched.
  expect(frame.match(/Phase · GREEN/g)).toHaveLength(1)
  // The model: once (the section's Model row). The removed top area
  // rendered `Model · …` — that exact form must not come back.
  expect(frame.match(/Model/g)).toHaveLength(1)
  expect(frame).not.toContain('Model ·')
  // The mode · cost fact survived the top area's removal — it lives in
  // the section's Mode row now.
  expect(frame).toContain('HYBRID · $0.25')
  // The section's Model row carries the selected model. It is ellipsised
  // across two rows, so the fragments are asserted. This pin previously
  // expected the ACTIVITY's model (`vendor/model-x`) here; the current
  // Activity detail renders the selected provider + model instead — measured
  // through dev/scratchpad/active/probe-sidebar-phase.tsx against the real
  // renderer, not inferred — so the assertion tracks the fact that has a home.
  expect(frame).toContain('fully-qualified-model-')
  expect(frame).toContain('identifier')
  // The section is the default-expanded home (▼), not a collapsed stub.
  expect(frame).toContain('▼ Activity detail')
}, 30_000)
