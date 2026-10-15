import { ScrollBoxRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import { useState } from 'react'

import { initializeThemeStore } from '../../hooks/use-theme'
import { ModelPicker } from '../model-picker'

import type { OpenRouterModel } from '../../utils/openrouter-models'
import type { Renderable } from '@opentui/core'

initializeThemeStore()

const models: OpenRouterModel[] = Array.from({ length: 30 }, (_, index) => ({
  id: `${index < 15 ? 'openai' : 'openrouter'}/model-${String(index).padStart(2, '0')}`,
  name: 'A long model display name that will wrap across several terminal rows',
  provider: index < 15 ? 'openai' : 'openrouter',
}))

const overlappingModels: OpenRouterModel[] = [
  { id: 'openai/gpt-5', name: 'GPT 5', provider: 'openai' },
  { id: 'openai/gpt-4.1', name: 'GPT 4.1', provider: 'openai' },
  { id: 'openai/gpt-5', name: 'OpenAI GPT 5' },
  { id: 'openai/gpt-4.1', name: 'OpenAI GPT 4.1' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat' },
  { id: 'qwen/qwen3-coder', name: 'Qwen Coder' },
]

function findScrollbox(node: Renderable): ScrollBoxRenderable | undefined {
  if (node instanceof ScrollBoxRenderable) return node
  for (const child of node.getChildren()) {
    const found = findScrollbox(child)
    if (found) return found
  }
  return undefined
}

async function mountPicker(width = 60, height = 24, catalog = models) {
  const setup = await createTestRenderer({ width, height, footerHeight: 0 })
  const root = createRoot(setup.renderer)
  let selectedIndex = 0
  let selectedModel: OpenRouterModel | undefined
  let changeQuery: (query: string) => void = () => {}
  let changeHeight: (height: number) => void = () => {}
  let rerender: () => void = () => {}
  function Harness() {
    const [index, setIndex] = useState(0)
    const [query, setQuery] = useState('')
    const [terminalHeight, setTerminalHeight] = useState(height)
    const [, setRevision] = useState(0)
    selectedIndex = index
    changeHeight = setTerminalHeight
    rerender = () => setRevision((revision) => revision + 1)
    changeQuery = (next) => {
      setQuery(next)
      setIndex(0)
    }
    return (
      <ModelPicker
        models={catalog}
        query={query}
        selectedIndex={index}
        onSelectIndex={setIndex}
        onQueryChange={changeQuery}
        onSelect={(model) => {
          selectedModel = model
        }}
        onClose={() => {}}
        terminalHeight={terminalHeight}
      />
    )
  }
  root.render(<Harness />)
  return {
    ...setup,
    root,
    changeHeight: (next: number) => changeHeight(next),
    rerender: () => rerender(),
    changeQuery: (query: string) => changeQuery(query),
    getSelectedIndex: () => selectedIndex,
    getSelectedModel: () => selectedModel,
  }
}

type PickerSetup = Awaited<ReturnType<typeof mountPicker>>

async function flush(setup: PickerSetup): Promise<void> {
  await setup.renderOnce()
  await Bun.sleep(50)
  await setup.renderOnce()
  await Bun.sleep(30)
}

function scrollbox(setup: PickerSetup): ScrollBoxRenderable {
  const scroll = findScrollbox(setup.renderer.root)
  if (!scroll) throw new Error('Model picker scrollbox did not render')
  return scroll
}

function expectSelectedVisible(setup: PickerSetup): void {
  const scroll = scrollbox(setup)
  const selected = scroll.getChildren()[setup.getSelectedIndex()]
  expect(selected).toBeDefined()
  expect(selected?.y).toBeGreaterThanOrEqual(scroll.viewport.y)
  expect((selected?.y ?? 0) + (selected?.height ?? 0)).toBeLessThanOrEqual(
    scroll.viewport.y + scroll.viewport.height,
  )
  expect(setup.captureCharFrame()).toContain('› ')
}

function cleanup(setup: PickerSetup): void {
  setup.root.unmount()
  setup.renderer.destroy()
}

describe('model picker physical scroll geometry', () => {
  test('search removes unrelated rows when providers share model IDs', async () => {
    const setup = await mountPicker(90, 24, overlappingModels)
    try {
      await flush(setup)
      for (const query of ['deepseek', 'qwen', 'no-match']) {
        setup.changeQuery(query)
        await flush(setup)
        const noMatch = query === 'no-match'
        expect(scrollbox(setup).getChildren()).toHaveLength(noMatch ? 1 : 2)
        const frame = setup.captureCharFrame()
        expect(frame).not.toContain('openai/gpt-')
        expect(frame).not.toContain('OPENAI')
        expect(frame).toContain(noMatch ? 'No models match' : `${query}/`)
      }
      setup.changeQuery('')
      await flush(setup)
      expect(scrollbox(setup).getChildren()).toHaveLength(8)
      setup.changeQuery('deepseek')
      await flush(setup)
      setup.mockInput.pressEnter()
      await flush(setup)
      expect(setup.getSelectedModel()).toEqual(overlappingModels[4])
    } finally {
      cleanup(setup)
    }
  })

  test('search keeps both provider routes for a shared model ID', async () => {
    const setup = await mountPicker(90, 24, overlappingModels)
    try {
      await flush(setup)
      setup.changeQuery('gpt-5')
      await flush(setup)
      expect(scrollbox(setup).getChildren()).toHaveLength(4)
      expect(setup.captureCharFrame()).not.toContain('gpt-4.1')
      setup.mockInput.pressEnter()
      await flush(setup)
      expect(setup.getSelectedModel()).toEqual(overlappingModels[0])
      setup.mockInput.pressArrow('down')
      await flush(setup)
      setup.mockInput.pressEnter()
      await flush(setup)
      expect(setup.getSelectedModel()).toEqual(overlappingModels[2])
    } finally {
      cleanup(setup)
    }
  })

  test('long names stay one row and keyboard traverses provider boundaries', async () => {
    const setup = await mountPicker()
    try {
      await flush(setup)
      expect(scrollbox(setup).scrollHeight).toBe(models.length + 2)
      expect(
        scrollbox(setup)
          .getChildren()
          .every((row) => row.height === 1),
      ).toBe(true)
      for (let index = 0; index < models.length + 1; index++) {
        setup.mockInput.pressArrow('down')
        await flush(setup)
        expectSelectedVisible(setup)
      }
      setup.mockInput.pressArrow('up')
      await flush(setup)
      setup.mockInput.pressTab({ shift: true })
      await flush(setup)
      expectSelectedVisible(setup)
      setup.mockInput.pressEnter()
      await flush(setup)
      expect(setup.getSelectedModel()?.id).toBe('openrouter/model-29')
    } finally {
      cleanup(setup)
    }
  }, 10_000)

  test('wheel and scrollbar move through the full catalog without rerender snapback', async () => {
    const setup = await mountPicker()
    try {
      await flush(setup)
      const scroll = scrollbox(setup)
      const selectedIndex = setup.getSelectedIndex()
      await setup.mockMouse.scroll(
        scroll.viewport.x + 3,
        scroll.viewport.y + 2,
        'down',
      )
      await flush(setup)
      const wheelTop = scroll.scrollTop
      expect(wheelTop).toBeGreaterThan(0)
      expect(setup.getSelectedIndex()).toBe(selectedIndex)
      setup.rerender()
      await flush(setup)
      expect(scroll.scrollTop).toBe(wheelTop)
      const bar = scroll.verticalScrollBar
      await setup.mockMouse.click(bar.x, bar.y + bar.height - 1)
      await flush(setup)
      expect(scroll.scrollTop).toBeGreaterThan(wheelTop)
      expect(scroll.scrollTop).toBeLessThanOrEqual(
        scroll.scrollHeight - scroll.viewport.height,
      )
      expect(scroll.getChildren().every((row) => row.height === 1)).toBe(true)
    } finally {
      cleanup(setup)
    }
  })

  test('resize and filter retain one-row geometry and full model selection IDs', async () => {
    const setup = await mountPicker(100)
    try {
      await flush(setup)
      for (let index = 0; index < 20; index++) {
        setup.mockInput.pressArrow('down')
        await flush(setup)
      }
      setup.resize(40, 18)
      setup.changeHeight(18)
      await flush(setup)
      expect(
        scrollbox(setup)
          .getChildren()
          .every((row) => row.height === 1),
      ).toBe(true)
      expectSelectedVisible(setup)
      setup.changeQuery('openai/model-14')
      await flush(setup)
      expect(scrollbox(setup).getChildren()).toHaveLength(2)
      expect(scrollbox(setup).scrollTop).toBe(0)
      expectSelectedVisible(setup)
      setup.mockInput.pressEnter()
      await flush(setup)
      expect(setup.getSelectedModel()?.id).toBe('openai/model-14')
    } finally {
      cleanup(setup)
    }
  }, 10_000)
})
