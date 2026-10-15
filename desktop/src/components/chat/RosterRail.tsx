import { memo } from 'react'

import { rosterIcon } from '../icon-names'
import { SavantIcon } from '../SavantIcon'

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
        {roster.map((entry) => {
          // FID-2026-1009-004 Phase 3: each roster row carries the family's
          // echo-agent mark (savant = identity logo). Rows with no mapping
          // keep the presence dot.
          const mark = rosterIcon(entry.roleId)
          return (
            <div className="roster-row" key={entry.roleId}>
              {mark ? (
                <SavantIcon
                  name={mark}
                  className={`roster-icon roster-icon-${entry.presence}`}
                />
              ) : (
                <span
                  className={`roster-presence roster-presence-${entry.presence}`}
                  aria-hidden="true"
                />
              )}
              <span className="roster-label">{entry.label}</span>
              {/* P23: the presence word carries the same color as the presence
                  dot — active glows green, standby stays muted. */}
              <span className={`roster-state roster-state-${entry.presence}`}>
                {entry.presence}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
})
