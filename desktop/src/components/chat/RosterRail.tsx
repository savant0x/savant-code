import { memo } from 'react'

import type { RosterEntry } from '../../state/roster'
import type { JSX } from 'react'

export const RosterRail = memo(function RosterRail({
  roster,
}: {
  roster: RosterEntry[]
}): JSX.Element {
  const activeCount = roster.filter(
    (entry) => entry.presence === 'active',
  ).length
  return (
    <aside className="roster-rail" aria-label="ECHO agent roster">
      <div className="roster-head">
        <span className="roster-title">ECHO roster</span>
        <span className="roster-count">{activeCount} active</span>
      </div>
      <div className="roster-list">
        {roster.map((entry) => (
          <div className="roster-row" key={entry.roleId}>
            <span
              className={`roster-presence roster-presence-${entry.presence}`}
              aria-hidden="true"
            />
            <span className="roster-label">{entry.label}</span>
            <span className="roster-state">{entry.presence}</span>
          </div>
        ))}
      </div>
    </aside>
  )
})
