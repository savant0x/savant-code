// P21 (operator: "maybe use the traffic lights, like we do w/ the cli"). The
// CLI trends a three-dot TrafficLights bar (green/yellow/red, breathing glow)
// as the header chrome of every surfaced panel. The desktop cards now echo
// that design language — a compact static traffic-light row, decorative only.
// Pure presentational; no state.
//
// P22: dot order matches the CLI contract pinned by
// `TRAFFIC_LIGHT_COLOR_KEYS = ['success', 'warning', 'error']` ("dots are
// ordered green → yellow → red") and the colors use the shared theme tokens
// (--success/--warning/--error) instead of ad-hoc hexes.
//
// P23 (operator: "the traffic lights are dimmed, and not the correct/bright
// values"): the dim state is REMOVED — the CLI never dims its lights, they
// always breathe at full brightness. The desktop lights now do exactly the
// same, unconditionally.

import { memo } from 'react'

import type { JSX } from 'react'

const DOTS = [
  { color: 'var(--success)', glow: 'rgba(57, 255, 20, 0.45)' }, // green
  { color: 'var(--warning)', glow: 'rgba(255, 149, 0, 0.45)' }, // yellow
  { color: 'var(--error)', glow: 'rgba(255, 45, 85, 0.45)' }, // red
] as const

export const TrafficLights = memo(function TrafficLights(): JSX.Element {
  return (
    <span className="traffic-lights" aria-hidden="true">
      {DOTS.map((dot, index) => (
        <span
          key={index}
          className="traffic-light-dot"
          style={{
            background: dot.color,
            boxShadow: `0 0 6px ${dot.glow}`,
          }}
        />
      ))}
    </span>
  )
})
