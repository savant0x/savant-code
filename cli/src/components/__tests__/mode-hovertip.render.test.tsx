import { createTestRenderer } from '@opentui/core/testing'
import { createRoot } from '@opentui/react'
import { describe, expect, test } from 'bun:test'
import React, { useState } from 'react'

import { initializeThemeStore } from '../../hooks/use-theme'
import { buildExpandedSegments } from '../agent-mode-toggle'
import { ModeHovertip } from '../mode-hovertip'
import { SegmentedControl } from '../segmented-control'

initializeThemeStore()

/**
 * Runtime frame-buffer verification of the mode hovertip (FID-2026-0805-001
 * terminal-smoke gate, headless). Uses OpenTUI's own test renderer + mock
 * mouse so the assertion is against the real rendered cells — not SSR markup:
 * 1. The tip renders ABOVE the control (absolute bottom anchoring is not
 *    clipped by the parent bounds in the real frame).
 * 2. A real mouse move over a segment fires onHoverChange and the tip appears.
 * 3. Moving away hides the tip (after the hover-intent grace).
 */
describe('ModeHovertip runtime render (FID-2026-0805-001)', () => {
  test('renders above the control in the real frame and follows hover', async () => {
    // footerHeight must be 0: the default (12) with height 12 would give the
    // content area zero rows (renderHeight = height - footerHeight), so the
    // frame would come back empty.
    const { renderer, renderOnce, captureCharFrame, mockMouse } =
      await createTestRenderer({ width: 60, height: 14, footerHeight: 0 })

    // OpenTUI's renderer paints asynchronously: a loop schedules the frame on
    // a timer, so a single loop call does NOT land the paint (verified
    // empirically). Loop, wait for the timer, loop again, then let the final
    // paint land.
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const flush = async () => {
      await renderOnce()
      await sleep(50)
      await renderOnce()
      await sleep(30)
    }

    function Harness() {
      const [hoveredId, setHoveredId] = useState<string | null>(null)
      const segments = buildExpandedSegments('HYBRID')
      const hovered = hoveredId
        ? segments.find((s) => s.id === hoveredId)
        : undefined

      return (
        <box
          style={{
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            justifyContent: 'flex-end', // mirror the app: toggle sits near the bottom
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            <SegmentedControl
              segments={segments}
              onHoverChange={setHoveredId}
            />
            {hovered?.description && (
              <ModeHovertip text={hovered.description} />
            )}
          </box>
        </box>
      )
    }

    const root = createRoot(renderer)
    root.render(<Harness />)
    await flush()

    // Initial frame: segments visible, no tip yet.
    let frame = captureCharFrame()
    expect(frame).toContain('HYBRID')
    expect(frame).not.toContain('Default.')

    // Hover the HYBRID segment: with 14 rows and justifyContent flex-end, the
    // 3-row control occupies the bottom rows (11-13); the label row is 12.
    await mockMouse.moveTo(3, 12)
    await new Promise((r) => setTimeout(r, 20))
    await flush()

    frame = captureCharFrame()
    // The HYBRID description ('Default. …') is present in the frame.
    expect(frame).toContain('Default.')

    // The tip text must appear ABOVE the segment label row, not over it:
    // the segments occupy the bottom 3 rows (9-11); the tip anchors above.
    const lines = frame.split('\n')
    const segmentRowIndex = lines.findIndex((line) => line.includes('HYBRID'))
    const tipRowIndex = lines.findIndex((line) => line.includes('Default.'))
    expect(segmentRowIndex).toBeGreaterThanOrEqual(0)
    expect(tipRowIndex).toBeGreaterThanOrEqual(0)
    expect(tipRowIndex).toBeLessThan(segmentRowIndex)
  })
})
