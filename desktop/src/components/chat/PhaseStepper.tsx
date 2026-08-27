// FID-2026-0820-010 Step 5 — Perfection Loop phase stepper. The active phase
// comes from the transcript store's `fsmPhase`, derived exclusively from
// transition_phase tool_result payloads (the same G2 interim rule the command
// deck uses — no scraping, no invented state). Absent/unparseable renders a
// muted idle chip, never a guess.

import { memo } from 'react'

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
}: {
  phase: string | null
}): JSX.Element {
  return (
    <div
      className="fsm-stepper"
      role="status"
      aria-label="Perfection Loop phase"
    >
      {PHASES.map((name) => (
        <span
          key={name}
          className={`fsm-chip${phase === name ? ' fsm-active' : ''}`}
        >
          {name}
        </span>
      ))}
      {phase !== null && !PHASES.includes(phase as (typeof PHASES)[number]) ? (
        <span className="fsm-chip fsm-active">{phase}</span>
      ) : null}
    </div>
  )
})
