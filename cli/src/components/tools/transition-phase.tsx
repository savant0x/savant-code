import { TextAttributes } from '@opentui/core'
import { memo, useMemo } from 'react'

import { defineToolComponent } from './types'
import { useTheme } from '../../hooks/use-theme'
import { blendHex, relativeLuminance } from '../../utils/diff-stats'
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
 * Redesign (FID-2026-0816-009): a single always-visible, bordered,
 * phase-filled bar replacing the collapsed generic tool item. The phase glyph
 * + color come from the same `phaseMapping` source the sidebar consumes
 * (`phase-info.ts`), so the bar and the sidebar can never disagree about what
 * a phase looks like. A `SAVANT CODE` title bar sits on its own row with the
 * phase label + reason below — the brand header is a header, not a
 * side-by-side label (operator feedback 2026-08-16). The reason sits on its
 * own line (truncated, never wrapped) so a long transition reason stays
 * readable without bloating the row.
 *
 * Filled-chip design (operator feedback 2026-08-16): the bar is a SOLID
 * phase-color fill, not a 14% theme tint, so it renders identically in
 * truecolor terminals (Cursor / Windows Terminal) and ANSI-16 fallbacks
 * (classic PowerShell conhost) — a tint collapses to "black background + white
 * header" under ANSI approximation, which is why the design drifted between
 * terminals. Text inverts for contrast: BLACK on bright fills, WHITE on the
 * red fill (black-on-red is unreadable), with a luminance floor so future
 * dark fills never get invisible black text. The idle chip stays the approved
 * mid-tone gray (86% muted) with black text.
 */
const TransitionPhaseBar = memo(function TransitionPhaseBar({
  phase,
  reason,
}: TransitionPhaseBarProps) {
  const theme = useTheme()
  const mapping = phaseMapping(phase)
  const color = resolveThemeColor(theme, mapping.colorKey)
  const icon = glyph(mapping.glyph)
  const isIdle = phase === 'idle'
  // Red is the one fill where black text is unreadable — it always gets white.
  const isRed = mapping.colorKey === 'error'
  // Solid phase-colored fill (theme-independent so it renders identically in
  // truecolor and ANSI-16 fallbacks). Idle stays the approved mid-tone gray.
  const fill = useMemo(
    () => (isIdle ? blendHex(theme.muted, theme.background, 0.14) : color),
    [isIdle, color, theme.muted, theme.background],
  )
  // Inverted text on the fill: black on bright fills, WHITE on red. The
  // luminance floor (< 0.25) is a safety net for future dark fills — it can
  // never override the two operator-mandated cases (idle black, red white).
  const onFill =
    isRed || (!isIdle && relativeLuminance(fill) < 0.25) ? '#ffffff' : '#000000'
  // Darker rim so the rounded border stays visible against the solid fill.
  const rim = useMemo(
    () => blendHex(fill, theme.background, 0.45),
    [fill, theme.background],
  )

  return (
    <box
      style={{
        width: '100%',
        flexDirection: 'column',
        backgroundColor: fill,
        border: true,
        borderStyle: 'rounded',
        borderColor: rim,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
      }}
    >
      {/* Title bar — SAVANT CODE on the phase fill. */}
      <box
        style={{
          width: '100%',
          alignItems: 'center',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text
          fg={onFill}
          attributes={TextAttributes.BOLD}
          style={{ wrapMode: 'none' }}
        >
          SAVANT CODE
        </text>
      </box>
      {/* Body — phase label + reason on the phase fill. */}
      <box
        style={{
          flexDirection: 'column',
          width: '100%',
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text
          fg={onFill}
          attributes={TextAttributes.BOLD}
          style={{ wrapMode: 'none' }}
        >
          {icon} PHASE → {mapping.label}
        </text>
        {reason ? (
          <text fg={onFill} style={{ wrapMode: 'none' }}>
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
 * full-width phase bar instead of the `[Tool: transition_phase]` fallback.
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
