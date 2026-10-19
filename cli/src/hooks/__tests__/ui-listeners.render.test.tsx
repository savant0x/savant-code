import { ScrollBoxRenderable } from '@opentui/core'
import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { expect, test } from 'bun:test'
import { useRef, useState } from 'react'

import { useAnimationBudget } from '../use-animation-budget'
import { useTerminalDimensions } from '../use-terminal-dimensions'

import type { BoxRenderable, Renderable } from '@opentui/core'

function Consumer() {
  const ref = useRef<BoxRenderable | null>(null)
  const budget = useAnimationBudget(ref)
  const { terminalWidth, terminalHeight } = useTerminalDimensions()
  return (
    <box ref={ref} height={1}>
      <text>{`${terminalWidth}x${terminalHeight}:${budget.targetFps}`}</text>
    </box>
  )
}

function findScrollbox(node: Renderable): ScrollBoxRenderable | undefined {
  if (node instanceof ScrollBoxRenderable) return node
  for (const child of node.getChildren()) {
    const found = findScrollbox(child)
    if (found) return found
  }
  return undefined
}

test('many animation consumers share events and release them on unmount', async () => {
  const setup = await createTestRenderer({ width: 90, height: 24 })
  const root = createRoot(setup.renderer)
  let showConsumers = (_visible: boolean) => {}
  function Harness() {
    const [visible, setVisible] = useState(false)
    showConsumers = setVisible
    return visible ? (
      <scrollbox height={10}>
        {Array.from({ length: 30 }, (_, index) => (
          <Consumer key={index} />
        ))}
      </scrollbox>
    ) : (
      <box />
    )
  }
  const flush = async () => {
    await setup.renderOnce()
    await Bun.sleep(50)
    await setup.renderOnce()
  }
  try {
    root.render(<Harness />)
    await flush()
    const baseline = ['resize', 'focus', 'blur'].map((event) =>
      setup.renderer.listenerCount(event),
    )
    for (let cycle = 0; cycle < 3; cycle++) {
      showConsumers(true)
      await flush()
      const scroll = findScrollbox(setup.renderer.root)
      if (!scroll) throw new Error('scrollbox did not mount')
      expect(
        scroll.verticalScrollBar.listenerCount('change'),
      ).toBeLessThanOrEqual(2)
      for (const [index, event] of ['resize', 'focus', 'blur'].entries()) {
        expect(setup.renderer.listenerCount(event) - baseline[index]).toBe(1)
      }
      setup.resize(80, 22)
      setup.renderer.emit('blur')
      await flush()
      expect(setup.captureCharFrame()).toContain('80x22:15')
      setup.renderer.emit('focus')
      await flush()
      expect(setup.captureCharFrame()).toContain('80x22:60')
      showConsumers(false)
      await flush()
      for (const [index, event] of ['resize', 'focus', 'blur'].entries()) {
        expect({ event, count: setup.renderer.listenerCount(event) }).toEqual({
          event,
          count: baseline[index],
        })
      }
    }
  } finally {
    root.unmount()
    setup.renderer.destroy()
  }
}, 15_000)
