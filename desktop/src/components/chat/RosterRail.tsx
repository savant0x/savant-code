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
    // P20 (operator: "the roster is not called 'echo roster', the system is
    // Savant"): the product name is Savant — the loop protocol (ECHO) never
    // leaks into operator-facing labels.
    <aside className="roster-rail" aria-label="Savant agent roster">
      <div className="roster-head">
        <span className="roster-title">Savant roster</span>
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
            {/* P23: the presence word carries the same color as the presence
                dot — active glows green, standby stays muted. */}
            <span className={`roster-state roster-state-${entry.presence}`}>
              {entry.presence}
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
})
