import type { createTestRenderer } from '@opentui/core/testing'

type Capture = Pick<
  Awaited<ReturnType<typeof createTestRenderer>>,
  'renderOnce' | 'captureCharFrame'
>

/** Wait for the observed native frame, never a presumed fixed commit delay. */
export async function waitForNativeFrame(
  capture: Capture,
  ready: (frame: string) => boolean,
): Promise<string> {
  const deadline = Date.now() + 2000
  let frame = ''
  do {
    await Bun.sleep(10)
    await capture.renderOnce()
    frame = capture.captureCharFrame()
    if (ready(frame)) return frame
  } while (Date.now() < deadline)
  throw new Error(`Native frame did not become ready within 2000 ms:\n${frame}`)
}
