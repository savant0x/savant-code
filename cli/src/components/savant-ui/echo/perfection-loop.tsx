import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { PhaseIndicator } from './phase-indicator'
import { ProgressBar } from '../feedback/progress-bar'
import { Badge } from '../data-display/badge'

export interface PerfectionLoopProps {
  phase: string
  iteration?: number
  maxIterations?: number
  fidName?: string
}

const PHASE_ORDER = ['idle', 'red', 'green', 'audit', 'self_correct', 'complete']

export function PerfectionLoop({
  phase,
  iteration = 0,
  maxIterations = 10,
  fidName,
}: PerfectionLoopProps) {
  const theme = useTheme()
  const phaseIndex = PHASE_ORDER.indexOf(phase)

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" gap={1} alignItems="center">
        {PHASE_ORDER.map((p, i) => {
          const isActive = p === phase
          const isPast = i < phaseIndex && phase !== 'idle'
          return (
            <box key={p} flexDirection="row" gap={0}>
              {i > 0 && <text fg={isPast ? theme.primary : theme.muted}> ── </text>}
              <PhaseIndicator phase={isActive ? p : isPast ? p : 'idle'} showLabel />
            </box>
          )
        })}
      </box>
      <box flexDirection="row" gap={2} alignItems="center">
        <ProgressBar
          value={iteration}
          max={maxIterations}
          width={15}
          label="iterations"
        />
        {fidName && <Badge variant="info">{fidName}</Badge>}
      </box>
    </box>
  )
}
