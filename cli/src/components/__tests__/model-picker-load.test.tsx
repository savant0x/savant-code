import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import React, { useState } from 'react'

import { waitForNativeFrame } from './native-render-frame'
import { initializeThemeStore } from '../../hooks/use-theme'
import { DialogOverlay } from '../dialog-overlay'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'

initializeThemeStore()

test('unchanged picker skips three agent updates while query and catalog stay live', async () => {
  let nameReads = 0
  const models: OpenRouterModel[] = Array.from({ length: 100 }, (_, index) => ({
    id: `openai/model-${index}`,
    provider: 'openai',
    get name() {
      nameReads++
      return `Model ${index}`
    },
  }))
  const setup = await createTestRenderer({
    width: 100,
    height: 30,
    footerHeight: 0,
  })
  const root = createRoot(setup.renderer)
  const noop = () => {}
  let updateAgent: (agent: number) => void = noop
  let search: (query: string) => void = noop
  let refresh: (models: OpenRouterModel[]) => void = noop
  function Harness() {
    const [agents, setAgents] = useState([0, 0, 0])
    const [query, setQuery] = useState('')
    const [catalog, setCatalog] = useState(models)
    const [index, setIndex] = useState(1)
    updateAgent = (agent) =>
      setAgents((current) =>
        current.map((value, i) => (i === agent ? value + 1 : value)),
      )
    search = setQuery
    refresh = setCatalog
    return (
      <box>
        <text>Agent updates {agents.join(',')}</text>
        <DialogOverlay onClose={noop}>
          {(close) => (
            <ModelPicker
              models={catalog}
              query={query}
              selectedIndex={index}
              onSelectIndex={setIndex}
              onQueryChange={setQuery}
              onSelect={noop}
              onClose={close}
              terminalHeight={30}
            />
          )}
        </DialogOverlay>
      </box>
    )
  }
  try {
    root.render(<Harness />)
    await waitForNativeFrame(setup, (frame) => frame.includes('100 models'))
    const initialReads = nameReads
    expect(initialReads).toBeGreaterThan(0)
    for (let agent = 0; agent < 3; agent++) {
      updateAgent(agent)
      const expected = [0, 1, 2].map((i) => (i <= agent ? 1 : 0)).join(',')
      await waitForNativeFrame(setup, (frame) =>
        frame.includes(`updates ${expected}`),
      )
      expect(nameReads).toBe(initialReads)
    }
    search('model-99')
    const filtered = await waitForNativeFrame(setup, (frame) =>
      frame.includes('1 match'),
    )
    expect(filtered).toContain('openai/model-99')
    expect(nameReads).toBeGreaterThan(initialReads)
    refresh([
      {
        id: 'openai/model-99-new',
        name: 'Refreshed model',
        provider: 'openai',
      },
    ])
    const fresh = await waitForNativeFrame(setup, (frame) =>
      frame.includes('Refreshed model'),
    )
    expect(fresh).toContain('openai/model-99-new')
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 15_000)
