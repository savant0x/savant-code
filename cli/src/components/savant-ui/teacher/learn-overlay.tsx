import { TextAttributes } from '@opentui/core'
import React, { useMemo } from 'react'

import { useTheme } from '../../../hooks/use-theme'
import {
  completionLabel,
  progressionLine,
  receiptLine,
} from '../../../teacher/render'

import type {
  AttemptEvent,
  CompetencyState,
  CompletionState,
  PublicChallenge,
  TeacherAttemptReceipt,
} from '@savant-code/common/teacher'

export type LearnPhase = AttemptEvent['type'] | 'ready'

export type LearnViewState = {
  objective: string
  prompt: string
  guidance: string
  phase: LearnPhase
  completionState: CompletionState | null
  events: readonly AttemptEvent[]
}

const MAX_RENDERED_EVENTS = 20

/**
 * Pure reducer for the `/learn` overlay (FID-2026-0813-018). Maps a public
 * challenge plus bounded lifecycle events into a renderable state. The event
 * log is capped so a long attempt cannot grow the surface unboundedly. The
 * terminal `result` event determines the completion state; unavailable and
 * cancelled are first-class outcomes, never synthesized into a pass.
 */
export function reduceLearnState(
  challenge: PublicChallenge | null,
  events: readonly AttemptEvent[],
): LearnViewState {
  const last = events[events.length - 1]
  const completionState = last?.type === 'result' ? last.state : null
  return {
    objective: challenge?.objective ?? '',
    prompt: challenge?.prompt ?? '',
    guidance: challenge?.visibleGuidance ?? '',
    phase: completionState ? 'result' : (last?.type ?? 'ready'),
    completionState,
    events: events.slice(-MAX_RENDERED_EVENTS),
  }
}

export type LearnOverlayProps = {
  challenge: PublicChallenge | null
  events: readonly AttemptEvent[]
  /** Signed attempt receipt (null → local-unverified); FID-2026-0813-022. */
  receipt?: TeacherAttemptReceipt | null
  /** Whether the attempt was persisted to the local progression store. */
  persisted?: boolean
  /** Derived competency state after a persisted attempt. */
  competencyState?: CompetencyState | null
  /**
   * FID-2026-0814-001: runtime phase forwarded by the sidebar. Authoritative
   * when provided; falls back to the event-log-derived phase.
   */
  phase?: string
  /**
   * FID-2026-0814-001: runtime completion state forwarded by the sidebar.
   * Required for terminal states that never push a `result` event (e.g.
   * `/learn cancel` sets `completionState='cancelled'` with no event).
   */
  completionState?: CompletionState | null
}

/**
 * Read-only OpenTUI rendering. There are intentionally no action handlers,
 * tool imports, or control callbacks here (FID-2026-0813-018): the overlay has
 * no tool, filesystem, corpus, grader, or progression authority.
 */
export const LearnOverlay = React.memo(function LearnOverlay({
  challenge,
  events,
  receipt,
  persisted,
  competencyState,
  phase: phaseProp,
  completionState,
}: LearnOverlayProps) {
  const theme = useTheme()
  const derived = useMemo(
    () => reduceLearnState(challenge, events),
    [challenge, events],
  )
  // FID-2026-0814-001: the runtime's phase/completionState are authoritative
  // when passed; fall back to the derived values otherwise. This closes the
  // `/learn cancel` gap (cancel sets completionState without a result event,
  // which the derived event-log state cannot observe).
  const phase = phaseProp !== undefined ? phaseProp : derived.phase
  const completion =
    completionState !== undefined ? completionState : derived.completionState

  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      <text
        fg={theme.primary}
        attributes={TextAttributes.BOLD}
        wrapMode="none"
        selectable={false}
      >
        TEACHER · EXERCISE
      </text>

      {derived.objective && (
        <box flexDirection="column" focusable={false} selectable={false}>
          <text fg={theme.foreground} selectable={false}>
            {derived.objective}
          </text>
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            {derived.prompt}
          </text>
          {derived.guidance && (
            <text fg={theme.muted} selectable={false}>
              {derived.guidance}
            </text>
          )}
        </box>
      )}

      <text
        fg={theme.muted}
        wrapMode="none"
        selectable={false}
      >{`phase: ${String(phase).toUpperCase()}`}</text>

      {/* FID-2026-0814-001: the event log is packed into one compact block
          (no per-event gap), fixing the double-spaced look versus the compact
          KeyValueRow sections elsewhere in the sidebar. */}
      {derived.events.length > 0 && (
        <box flexDirection="column" focusable={false} selectable={false}>
          {derived.events.map((event, index) => (
            <text
              key={`${event.type}-${event.timestamp}-${index}`}
              fg={theme.muted}
              wrapMode="none"
              selectable={false}
            >{`• ${event.type}`}</text>
          ))}
        </box>
      )}

      {completion && (
        <text
          fg={completionColor(theme, completion)}
          attributes={TextAttributes.BOLD}
          wrapMode="none"
          selectable={false}
        >
          {completionLabel(completion)}
        </text>
      )}

      {/* FID-2026-0813-022: terminal-only receipt + progression lines. Gated on
          a terminal result so the live exercise phase never shows misleading
          "not recorded"/"unverified" rows; undefined props render nothing. */}
      {completion && receipt !== undefined && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {receiptLine(receipt ?? null)}
        </text>
      )}
      {completion && persisted !== undefined && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {progressionLine(persisted, competencyState ?? null)}
        </text>
      )}
    </box>
  )
})

function completionColor(
  theme: ReturnType<typeof useTheme>,
  state: CompletionState,
): string {
  if (state === 'passed') return theme.success
  if (state === 'unavailable') return theme.warning
  if (state === 'cancelled') return theme.muted
  return theme.error ?? theme.warning
}
