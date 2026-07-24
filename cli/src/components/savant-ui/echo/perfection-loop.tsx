import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useFids } from '../../../hooks/use-fids'
import { useTheme } from '../../../hooks/use-theme'
import { glyph } from '../../../utils/glyphs'
import { resolveThemeColor } from '../icon-theme-keys'
import { SidebarSection } from '../primitives/sidebar-section'

type PerfectionLoopPhase =
  | 'red'
  | 'green'
  | 'audit'
  | 'self_correct'
  | 'complete'

interface LoopStep {
  phase: PerfectionLoopPhase
  label: string
  colorKey: 'error' | 'success' | 'warning' | 'primary'
}

const LOOP_STEPS: LoopStep[] = [
  { phase: 'red', label: 'RED', colorKey: 'error' },
  { phase: 'green', label: 'GREEN', colorKey: 'success' },
  { phase: 'audit', label: 'AUDIT', colorKey: 'warning' },
  { phase: 'self_correct', label: 'SELF-CORRECT', colorKey: 'warning' },
  { phase: 'complete', label: 'COMPLETE', colorKey: 'primary' },
]

const STATUS_TO_PHASE: Record<string, PerfectionLoopPhase> = {
  created: 'red',
  analyzed: 'green',
  fixed: 'audit',
  verified: 'self_correct',
  closed: 'complete',
}

/**
 * Derive the current Perfection Loop phase from active FID data.
 *
 * The loop phase is the most advanced phase among all active FIDs. If there
 * are no active FIDs, the loop is complete/idle.
 */
function deriveLoopPhase(activeFids: { status: string }[]): PerfectionLoopPhase {
  if (activeFids.length === 0) return 'complete'

  const phaseIndex = (phase: PerfectionLoopPhase) =>
    LOOP_STEPS.findIndex((step) => step.phase === phase)

  let mostAdvanced: PerfectionLoopPhase = 'red'
  for (const fid of activeFids) {
    const phase = STATUS_TO_PHASE[fid.status] ?? 'red'
    if (phaseIndex(phase) > phaseIndex(mostAdvanced)) {
      mostAdvanced = phase
    }
  }

  return mostAdvanced
}

/**
 * Perfection Loop — ECHO FID-bound progress display.
 *
 * Reads the active FIDs from `dev/fids/` and visualizes the current position
 * in the RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE cycle.
 */
export const PerfectionLoop: React.FC = () => {
  const theme = useTheme()
  const { fids } = useFids()

  const currentPhase = deriveLoopPhase(fids)
  const currentIndex = LOOP_STEPS.findIndex(
    (step) => step.phase === currentPhase,
  )
  const hasActiveFids = fids.length > 0

  return (
    <SidebarSection title="Perfection Loop">
      {!hasActiveFids && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`${glyph('phaseIdle')} IDLE`}
        </text>
      )}
      {hasActiveFids &&
        LOOP_STEPS.map((step, index) => {
          const isDone = index < currentIndex
          const isActive = index === currentIndex
          const color = isDone
            ? theme.success
            : isActive
              ? resolveThemeColor(theme, step.colorKey)
              : theme.muted
          const icon = isDone
            ? glyph('phaseComplete')
            : isActive
              ? glyph('phaseActive')
              : glyph('phaseIdle')

          return (
            <text
              key={step.phase}
              fg={color}
              attributes={
                isActive
                  ? TextAttributes.BOLD
                  : isDone
                    ? undefined
                    : TextAttributes.DIM
              }
              wrapMode="none"
              selectable={false}
            >
              {`${icon} ${step.label}`}
            </text>
          )
        })}
    </SidebarSection>
  )
}
