import { useCallback, useEffect, useRef } from 'react'

import { useAnimationTimeline } from '../hooks/use-animation-timeline'
import { DIALOG_BACKDROP_COLOR } from '../utils/ui-constants'

import type { BoxRenderable } from '@opentui/core'
import type { ReactNode } from 'react'

/**
 * Dimmed-backdrop RGBA token (report §14.2 verified Porter-Duff blending:
 * the 80-suffix encodes ~50% alpha over the chat surface). FID-2026-0822-007:
 * promoted to the documented constant in utils/ui-constants.ts.
 */
const BACKDROP_COLOR = DIALOG_BACKDROP_COLOR
const ENTRY_DURATION = 180
const EXIT_DURATION = 140
/** Entry slide offset in rows — the dialog rises from slightly below center. */
const ENTRY_OFFSET_Y = 6
const OVERLAY_Z_INDEX = 1000

interface DialogOverlayProps {
  /** Called after the exit animation completes (or immediately if no ref). */
  onClose: () => void
  /** Render-prop so the dialog can hand the animated close to its content. */
  children: (requestClose: () => void) => ReactNode
}

/**
 * DialogOverlay — shared centered dialog chrome (FID-2026-0816-007 step 2).
 *
 * Renders a full-screen absolutely-positioned overlay with a dimmed RGBA
 * backdrop and centers its content. The content slides in/out with a
 * `translateY` animation on the Phase 2 timeline engine (no structural
 * reflow — translate is a paint-time offset). The render-prop `requestClose`
 * plays the exit slide before invoking `onClose`, so Escape/selection in a
 * picker fades it out instead of hard-unmounting.
 */
export const DialogOverlay = ({ children, onClose }: DialogOverlayProps) => {
  const timeline = useAnimationTimeline()
  const contentRef = useRef<BoxRenderable | null>(null)

  const runAnimation = useCallback(
    (enter: boolean, onComplete?: () => void) => {
      timeline.items.length = 0
      timeline.add(
        { t: enter ? 0 : 1 },
        {
          t: enter ? 1 : 0,
          duration: enter ? ENTRY_DURATION : EXIT_DURATION,
          ease: enter ? 'outQuad' : 'inQuad',
          onUpdate: (anim) => {
            const t = anim.targets[0]?.t ?? (enter ? 1 : 0)
            const node = contentRef.current
            if (node) {
              node.translateY = Math.round(ENTRY_OFFSET_Y * (1 - t))
            }
          },
          onComplete,
        },
      )
      timeline.restart()
    },
    [timeline],
  )

  useEffect(() => {
    runAnimation(true)
    return () => {
      timeline.pause()
    }
  }, [runAnimation, timeline])

  const requestClose = useCallback(() => {
    runAnimation(false, onClose)
  }, [runAnimation, onClose])

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: OVERLAY_Z_INDEX,
        backgroundColor: BACKDROP_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
      }}
      focusable={false}
    >
      <box ref={contentRef} style={{ flexDirection: 'column' }}>
        {children(requestClose)}
      </box>
    </box>
  )
}
