// FID-2026-0820-010 Step 5 — Perfection Loop phase stepper. The active phase
// comes from the transcript store's `fsmPhase`, derived exclusively from
// transition_phase tool_result payloads (the same G2 interim rule the command
// deck uses — no scraping, no invented state). Absent/unparseable renders a
// muted idle chip, never a guess.
//
// P17 (CLI parity): on a normal chat run the Perfection Loop never fires, so
// the FSM chips stay dark and the rail reads as dead. The CLI's AgentStatus
// shows the live runtime activity beside the phase, so we surface the current
// activity as an active chip too — real signal, never an invented FSM phase.
//
// P20 (operator: "the phases are still not lighting up, such as 'idle, red,
// green, etc. Those should always be active, esp 'idle'"): `idle` is the
// system's real resting state — when no FSM phase is engaged the idle chip
// lights (its truthful rendering), so the stepper is never fully dark. A live
// runtime activity additionally shows as its own distinct activity chip.

import { memo } from 'react'

import type { CurrentActivity } from '../../state/transcript-store'
import type { JSX } from 'react'

const PHASES = [
  'idle',
  'red',
  'green',
  'audit',
  'adversarial',
  'self_correct',
  'complete',
] as const

export const PhaseStepper = memo(function PhaseStepper({
  phase,
  activity,
}: {
  phase: string | null
  /** P17: live runtime activity, shown when no FSM phase is engaged. */
  activity?: CurrentActivity | null
}): JSX.Element {
  // Live activity label (CLI AgentStatus mirror) — only shown while a real
  // activity is in flight and no FSM phase has taken over the rail.
  const activityLabel =
    activity !== undefined && activity !== null
      ? activity.kind === 'tool'
        ? `tool: ${activity.toolName}`
        : activity.kind === 'subagent'
          ? `subagent: ${activity.agentType}`
          : activity.kind === 'researching'
            ? `researching: ${activity.query}`
            : 'thinking'
      : null

  const isKnownPhase =
    phase !== null && PHASES.includes(phase as (typeof PHASES)[number])
  // P20: no FSM phase engaged → the system is at rest → `idle` is lit.
  const idleLit = phase === 'idle' || phase === null

  return (
    <div
      className="fsm-stepper"
      role="status"
      aria-label="Perfection Loop phase"
    >
      {PHASES.map((name) => {
        const lit =
          (phase === name && isKnownPhase) || (name === 'idle' && idleLit)
        // P21 (operator: "the color highlight on the selected item is too
        // dull"): each phase carries its own `fsm-<phase>` class so CSS can
        // give the ACTIVE chip a vivid, phase-coloured glow — not a faint
        // neutral tint. `fsm-active` stays adjacent to the base class for
        // the static-markup test assertions.
        return (
          <span
            key={name}
            className={`fsm-chip${lit ? ' fsm-active' : ''} fsm-${name}`}
          >
            {name}
          </span>
        )
      })}
      {phase !== null && !isKnownPhase ? (
        <span className="fsm-chip fsm-active">{phase}</span>
      ) : null}
      {/* P17: live activity chip — keeps the rail alive on non-loop runs. */}
      {activityLabel !== null && phase === null ? (
        <span className="fsm-chip fsm-active fsm-activity">
          {activityLabel}
        </span>
      ) : null}
    </div>
  )
})
