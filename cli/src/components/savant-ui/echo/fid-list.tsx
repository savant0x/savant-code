import React from 'react'

import { FidCard } from './fid-card'
import { useTheme } from '../../../hooks/use-theme'

export interface FidData {
  id: string
  status: string
  severity: string
  summary: string
  parentId?: string
  /** Absolute file path (populated by the loader; FID-2026-0804-009 harness uses it). */
  path?: string
}

export interface FidListProps {
  fids: FidData[]
  filter?: string
  sortBy?: 'id' | 'severity' | 'status'
  onSelect?: (fid: FidData) => void
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export function FidList({
  fids,
  filter,
  sortBy = 'severity',
  onSelect,
}: FidListProps) {
  const theme = useTheme()

  let filtered = fids
  if (filter) {
    filtered = fids.filter((f) => f.status === filter || f.severity === filter)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'severity') {
      return (
        (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99)
      )
    }
    if (sortBy === 'status') return a.status.localeCompare(b.status)
    return a.id.localeCompare(b.id)
  })

  if (sorted.length === 0) {
    return <text fg={theme.muted}>No FIDs found</text>
  }

  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      {sorted.map((fid) => (
        <FidCard
          key={fid.id}
          id={fid.id}
          status={fid.status}
          severity={fid.severity}
          summary={fid.summary}
          onClick={() => onSelect?.(fid)}
        />
      ))}
    </box>
  )
}
