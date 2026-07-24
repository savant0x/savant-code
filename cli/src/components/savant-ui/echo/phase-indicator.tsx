import { TextAttributes } from '@opentui/core'
import { useTimeline } from '@opentui/react'
import React, { useEffect, useState } from 'react'

import { phaseMapping } from './phase-info'
import { useTheme } from '../../../hooks/use-theme'
import { glyph } from '../../../utils/glyphs'
import { resolveThemeColor } from '../icon-theme-keys'

export interface PhaseIndicatorProps {
  phase: string
  showLabel?: boolean
}

/**
 * Renders an FSM phase glyph + label as a standalone `<text>` element.
 * Uses `useTheme()` internally — suitable for top-level mounting (e.g.
 * `agent-status.tsx`). Consumers that need to inline a phase glyph inside
 * another `<text>` (OpenTUI forbids nested `<text>`) should use the exported
 * `phaseMapping` + `glyph` + `resolveThemeColor` helpers directly (see
 * `right-sidebar.tsx`).
 *
 * Phase changes are animated with a short Timeline tween that fades the label
 * from dim to full brightness, giving the Perfection Loop indicator a smooth
 * transition without depending on the underlying color format.
 */
export function PhaseIndicator({ phase, showLabel = true }: PhaseIndicatorProps) {
  const theme = useTheme()
  const mapping = phaseMapping(phase)
  const color = resolveThemeColor(theme, mapping.colorKey)
  const icon = glyph(mapping.glyph)

  const [brightness, setBrightness] = useState(1)
  const timeline = useTimeline({ autoplay: false })

  useEffect(() => {
    setBrightness(0)
    timeline.once(
      { brightness: 0 },
      {
        brightness: 1,
        duration: 200,
        ease: 'outQuad',
        onUpdate: (anim) => {
          setBrightness(anim.targets[0]?.brightness ?? 1)
        },
      },
    )
    timeline.play()
  }, [phase, timeline])

  const attributes = brightness < 1 ? TextAttributes.DIM : undefined

  return (
    <text fg={color} attributes={attributes}>
      {icon} {showLabel ? mapping.label : phase}
    </text>
  )
}

// Re-export for callers that compose inline (right-sidebar) and need the
// resolved pieces without mounting a <text> element.
export { phaseMapping, activityMapping, statusMapping } from './phase-info'
export { glyph } from '../../../utils/glyphs'
export { resolveThemeColor } from '../icon-theme-keys'
