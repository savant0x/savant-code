import React from 'react'

import { useTheme } from '../../../hooks/use-theme'
import { tokens } from '../theme'

export interface PhaseIndicatorProps {
  phase: string
  showLabel?: boolean
}

const PHASE_INFO: Record<string, { fg: string; label: string; icon: string }> = {
  idle: { fg: '#6b7280', label: 'IDLE', icon: '○' },
  red: { fg: '#ef4444', label: 'RED', icon: '●' },
  green: { fg: '#22c55e', label: 'GREEN', icon: '●' },
  audit: { fg: '#eab308', label: 'AUDIT', icon: '●' },
  self_correct: { fg: '#f97316', label: 'FIX', icon: '●' },
  complete: { fg: '#06b6d4', label: 'DONE', icon: '●' },
}

export function PhaseIndicator({ phase, showLabel = true }: PhaseIndicatorProps) {
  const info = PHASE_INFO[phase] ?? PHASE_INFO.idle

  return (
    <text fg={info.fg}>
      {info.icon} {showLabel ? info.label : phase}
    </text>
  )
}
