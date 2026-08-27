import { TextAttributes } from '@opentui/core'
import { memo } from 'react'

import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'
import { glyph } from '../../utils/glyphs'
import { phaseMapping } from '../savant-ui/echo/phase-info'
import { resolveThemeColor } from '../savant-ui/icon-theme-keys'

import type { ToolRenderConfig } from './types'
import type { JSONValue } from '@savant-code/common/types/json'

/** Phase string + reason shipped inside a `transition_phase` tool call. */
interface TransitionInput {
  phase: string | undefined
  reason: string | undefined
}

function parseTransitionInput(input: unknown): TransitionInput {
  if (!input || typeof input !== 'object') {
    return { phase: undefined, reason: undefined }
  }
  const record = input as Record<string, JSONValue>
  const phase = record.phase
  const reason = record.reason
  return {
    phase: typeof phase === 'string' ? phase : undefined,
    reason: typeof reason === 'string' ? reason : undefined,
  }
}

interface TransitionPhaseBarProps {
  phase: string
  reason: string | undefined
}

/**
 * TransitionPhaseBar — full-width FSM phase-transition notification.
 *
 * Glow Frame redesign (operator-approved 2026-08-23): replaces the Corner
 * Ticks half-block rails with a clean rounded-border panel whose border is
 * the phase color — the familiar transcript chrome language (cf. the unified
 * TrafficLightPanel frames) tinted per phase. Light-driven only: the border +
 * bold label carry the phase color on the surface background, no fills or
 * inverted text, so the banner renders identically in truecolor and ANSI-16
 * terminals. The label row holds `◆ PHASE // LABEL` left and a dim `SAVANT
 * CODE` brand whisper right; the reason sits below in plain foreground
 * (never wrapped). The phase glyph + color still come from the shared
 * `phaseMapping` source the sidebar consumes (`phase-info.ts`), so the bar
 * and the sidebar can never disagree about what a phase looks like.
 */
const TransitionPhaseBar = memo(function TransitionPhaseBar({
  phase,
  reason,
}: TransitionPhaseBarProps) {
  const theme = useTheme()
  const mapping = phaseMapping(phase)
  const icon = glyph(mapping.glyph)
  // Neon accent: the phase color appears as LIGHT ONLY (border + label).
  const neon = resolveThemeColor(theme, mapping.colorKey)

  return (
    <box style={{ width: '100%', flexDirection: 'column' }}>
      <box
        border
        borderStyle="rounded"
        borderColor={neon}
        style={{
          flexDirection: 'column',
          backgroundColor: theme.surface,
          paddingLeft: 2,
          paddingRight: 2,
          paddingTop: 0,
          paddingBottom: 0,
          width: '100%',
        }}
      >
        <box
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <text
            fg={neon}
            attributes={TextAttributes.BOLD}
            style={{ wrapMode: 'none' }}
          >
            {icon} PHASE // {mapping.label}
          </text>
          <text
            fg={theme.muted}
            attributes={TextAttributes.DIM}
            style={{ wrapMode: 'none' }}
          >
            SAVANT CODE
          </text>
        </box>
        {reason ? (
          <text fg={theme.foreground} style={{ wrapMode: 'none' }}>
            {reason}
          </text>
        ) : null}
      </box>
    </box>
  )
})

/**
 * UI renderer for the `transition_phase` tool (FID-2026-0816-009).
 *
 * Registered in `registry.ts`. Because registered components render their
 * custom content unconditionally (no generic collapse) and are excluded from
 * the CopyableBlock copy-button chrome in `tool-branch.tsx`, every FSM
 * transition — idle→red→green→audit→adversarial→complete — shows the bare
 * glow-frame banner instead of the `[Tool: transition_phase]` fallback.
 */
export const TransitionPhaseComponent = defineToolComponent({
  toolName: 'transition_phase',

  render(toolBlock): ToolRenderConfig {
    const { phase, reason } = parseTransitionInput(toolBlock.input)

    return {
      content:
        phase !== undefined ? (
          <TransitionPhaseBar phase={phase} reason={reason} />
        ) : null,
    }
  },
})