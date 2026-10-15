import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import React from 'react'

import { initializeThemeStore } from '../../hooks/use-theme'
import { DialogOverlay } from '../dialog-overlay'

initializeThemeStore()

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const flush = async (renderOnce: () => Promise<void>): Promise<void> => {
  await renderOnce()
  await sleep(80)
  await renderOnce()
  await sleep(60)
}

describe('DialogOverlay (FID-2026-0816-007 step 2)', () => {
  test('renders centered content above the dimmed backdrop', async () => {
    const { renderer, renderOnce, captureCharFrame } = await createTestRenderer(
      { width: 80, height: 24, footerHeight: 0 },
    )

    const root = createRoot(renderer)
    root.render(
      <DialogOverlay onClose={() => {}}>
        {() => <text>PICKER CONTENT</text>}
      </DialogOverlay>,
    )
    await flush(renderOnce)

    const frame = captureCharFrame()
    expect(frame).toContain('PICKER CONTENT')
    root.unmount()
  })

  test('requestClose plays the exit animation then calls onClose', async () => {
    const requestCloseRef: { current: (() => void) | null } = { current: null }
    let closed = false

    const { renderer, renderOnce } = await createTestRenderer({
      width: 80,
      height: 24,
      footerHeight: 0,
    })

    const root = createRoot(renderer)
    root.render(
      <DialogOverlay
        onClose={() => {
          closed = true
        }}
      >
        {(requestClose) => {
          requestCloseRef.current = requestClose
          return <text>CONTENT</text>
        }}
      </DialogOverlay>,
    )
    await flush(renderOnce)

    expect(requestCloseRef.current).toBeTruthy()
    requestCloseRef.current?.()

    // Exit animation is 140ms; allow the timeline to run to completion.
    await sleep(250)
    expect(closed).toBe(true)
    root.unmount()
  })
})
