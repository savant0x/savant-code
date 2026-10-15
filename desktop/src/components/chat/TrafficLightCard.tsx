// P21 (operator: "any chance we can use the traffic lights design for these
// content boxes?"). Mirrors the CLI's TrafficLightPanel chrome — a bordered
// surface panel with a right-aligned TrafficLights title bar — around each
// assistant-facing block (text, tool, reasoning, compaction). Presentation
// only; children are unchanged.
//
// P23: the `dim` prop is gone — CLI lights never dim (P23, TrafficLights).

import { memo } from 'react'

import { TrafficLights } from './TrafficLights'

import type { JSX } from 'react'

export const TrafficLightCard = memo(function TrafficLightCard({
  label,
  children,
  tone,
}: {
  /** Short label in the title bar, before the traffic lights. */
  label?: string
  children: JSX.Element
  /** P21: accent tint for the title bar text, e.g. 'warning' | 'error'. */
  tone?: 'warning' | 'error' | 'info'
}): JSX.Element {
  return (
    <section className={`tl-card tl-card-${tone ?? 'default'}`}>
      <div className="tl-card-bar">
        {label !== undefined ? (
          <span className="tl-card-label">{label}</span>
        ) : null}
        <TrafficLights />
      </div>
      <div className="tl-card-body">{children}</div>
    </section>
  )
})
