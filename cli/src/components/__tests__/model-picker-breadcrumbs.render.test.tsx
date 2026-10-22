import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import React from 'react'

import { initializeThemeStore } from '../../hooks/use-theme'
import { logger } from '../../utils/logger'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'

initializeThemeStore()

/**
 * FID-2026-1022-002: the 2026-10-19 acceptance recorded "arrow keys and filter
 * letter responded" as a human observation with nothing in `debug/cli.jsonl`
 * to check it against. These pins fix the breadcrumb contract so the next
 * acceptance run can be replayed from the log.
 */
const MODELS: OpenRouterModel[] = [
  { id: 'openai/alpha', name: 'Alpha', provider: 'openai' },
  { id: 'openai/beta', name: 'Beta', provider: 'openai' },
  { id: 'anthropic/gamma', name: 'Gamma', provider: 'anthropic' },
]

type Record_ = Record<string, unknown>

function recordsOf(spy: { mock: { calls: unknown[][] } }, event: string) {
  return spy.mock.calls
    .map((call) => call[0] as Record_)
    .filter((data) => data && data.event === event)
}

function PickerHarness({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (model: OpenRouterModel) => void
}) {
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  return (
    <ModelPicker
      models={MODELS}
      query={query}
      selectedIndex={selectedIndex}
      onQueryChange={setQuery}
      onSelectIndex={setSelectedIndex}
      onSelect={onSelect}
      onClose={onClose}
      terminalHeight={40}
    />
  )
}

describe('model picker — breadcrumbs', () => {
  let debugSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    debugSpy = spyOn(logger, 'debug')
  })

  afterEach(() => {
    debugSpy.mockRestore()
  })

  async function mount(onClose: () => void = () => {}) {
    const setup = await createTestRenderer({
      width: 120,
      height: 40,
      footerHeight: 0,
    })
    const root = createRoot(setup.renderer)
    root.render(<PickerHarness onClose={onClose} onSelect={() => {}} />)
    await setup.flush()
    // Effects commit on the frame after the render call, so the mount
    // breadcrumb lands here rather than inside `flush()`.
    await Bun.sleep(20)
    await setup.flush()
    return { setup, root }
  }

  test('records the open with the catalog size', async () => {
    const { root, setup } = await mount()
    try {
      const open = recordsOf(debugSpy, 'model-picker.open')
      expect(open).toHaveLength(1)
      expect(open[0]?.catalog).toBe(MODELS.length)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)

  test('records one handled key per arrow press and stays silent otherwise', async () => {
    const { root, setup } = await mount()
    try {
      const before = recordsOf(debugSpy, 'model-picker.key').length
      setup.mockInput.pressArrow('down')
      await setup.flush()
      await Bun.sleep(10)
      setup.mockInput.pressArrow('up')
      await setup.flush()
      await Bun.sleep(10)
      const keys = recordsOf(debugSpy, 'model-picker.key').slice(before)
      expect(keys.map((record) => record.action)).toEqual(['down', 'up'])
      expect(keys[0]?.key).toBe('down')
      expect(typeof keys[0]?.selected).toBe('number')
      expect(keys[0]?.filtered).toBe(MODELS.length)

      // An unhandled key must not produce a record: the log is a record of
      // handled transitions, not of every keydown.
      const afterHandled = recordsOf(debugSpy, 'model-picker.key').length
      setup.mockInput.pressKey('F1')
      await setup.flush()
      await Bun.sleep(10)
      expect(recordsOf(debugSpy, 'model-picker.key')).toHaveLength(afterHandled)
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)

  test('records the filter response, not the typed text', async () => {
    const { root, setup } = await mount()
    try {
      const before = recordsOf(debugSpy, 'model-picker.key').length
      await setup.mockInput.typeText('g')
      await setup.flush()
      await Bun.sleep(10)
      await setup.flush()
      const key = recordsOf(debugSpy, 'model-picker.key').slice(before)[0]
      expect(key?.action).toBe('filter')
      expect(key?.key).toBe('g')
      expect(String(key?.queryLength)).toBe('0')

      const filters = recordsOf(debugSpy, 'model-picker.filter')
      const last = filters.at(-1)
      expect(last?.queryLength).toBe(1)
      expect(last?.filtered).toBe(1)
      expect(JSON.stringify(key)).not.toContain('gamma')
    } finally {
      root.unmount()
      setup.renderer.destroy()
    }
  }, 60_000)

  test('records a close with the reason it left by', async () => {
    let closed = 0
    const closesBefore = recordsOf(debugSpy, 'model-picker.close').length
    const { root, setup } = await mount(() => {
      closed += 1
    })
    // Ctrl+C takes the same close branch as Escape and is a single byte, so it
    // does not depend on the parser's escape-sequence disambiguation timeout.
    setup.mockInput.pressCtrlC()
    await setup.flush()
    await Bun.sleep(10)
    expect(closed).toBe(1)
    root.unmount()
    setup.renderer.destroy()

    await Bun.sleep(10)
    const closes = recordsOf(debugSpy, 'model-picker.close').slice(closesBefore)
    expect(closes.length).toBeGreaterThanOrEqual(1)
    // The last close names the reason the keyboard asked for; the 'unmount'
    // fallback is what an unmount without a key records, never a substitute.
    expect(closes.at(-1)?.reason).toBe('escape')
  }, 60_000)
})
