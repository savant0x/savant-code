import React from 'react'

import { useFids } from '../../../hooks/use-fids'
import { useSidebarTheme as useTheme } from '../../right-sidebar-theme'
import { SidebarSection } from '../primitives/sidebar-section'

/** Document review states are observations, never aggregate runtime progress. */
export function PerfectionLoop({ fidsDir }: { fidsDir?: string } = {}) {
  const theme = useTheme()
  const { fids, isLoading } = useFids(fidsDir)
  return (
    <SidebarSection title="FID Perfection Loop" count={fids.length}>
      {isLoading ? (
        <text fg={theme.muted}>Loading FIDs…</text>
      ) : !fids.length ? (
        <text fg={theme.muted}>No active FID reviews</text>
      ) : (
        fids.map((fid) => (
          <text
            key={fid.id}
            fg={theme.foreground}
            wrapMode="word"
            selectable={false}
          >{`${fid.id} · ${fid.status}`}</text>
        ))
      )}
    </SidebarSection>
  )
}
