/**
 * FID-2026-1005-003 Step 4 — the traffic-light surface for skill lifecycle
 * events.
 *
 * Renders claimed events from `.savant/skill-lifecycle-events.jsonl` through
 * the same `TerminalCommandDisplay` traffic-light chrome the interactive
 * `skill_manage` tool block uses, so a background/mechanical draft carries
 * the identical operator-visible treatment. The notice text is built from
 * validated metadata fields only (`formatSkillLifecycleNoticeLine`) — never
 * raw tool-error or model prose. A green creation badge means the WRITE
 * succeeded; the trust state line always says QUARANTINED — PENDING TRUST.
 */
import {
  acknowledgeSkillLifecycleEvents,
  claimSkillLifecycleEvents,
  formatSkillLifecycleNoticeLine,
} from '@savant-code/common/util/skill-lifecycle-events'
import React from 'react'

import { TerminalCommandDisplay } from './terminal-command-display'

import type { SkillLifecycleEvent } from '@savant-code/common/util/skill-lifecycle-events'

export interface SkillLifecycleNoticeProps {
  projectRoot: string
  availableWidth?: number
  /** Called with the claimed events AFTER they are rendered, so the caller
   *  can acknowledge them once the insertion is actually visible. */
  onDisplayed?: (events: SkillLifecycleEvent[]) => void
}

/**
 * Claim, render, and (via `onDisplayed`) acknowledge unseen skill lifecycle
 * events. Read-only against the skill directories — the event log is the
 * only input, and unparseable lines are already filtered by the reader.
 */
export function SkillLifecycleNotice({
  projectRoot,
  availableWidth,
  onDisplayed,
}: SkillLifecycleNoticeProps): React.ReactNode {
  // Hooks run unconditionally; the empty state renders null AFTER them.
  const { events, remaining } = claimSkillLifecycleEvents(projectRoot, 'cli')

  // Acknowledgement happens in a fire-and-forget effect AFTER render —
  // a crash between render and ack replays the batch (at-least-once).
  React.useEffect(() => {
    if (events.length > 0) onDisplayed?.(events)
  })

  if (events.length === 0) return null

  const lines = events.map(formatSkillLifecycleNoticeLine)
  if (remaining > 0) {
    lines.push(`… ${remaining} more skill event(s) — /skills activity`)
  }
  const output = lines.map((line) => `• ${line}`).join('\n')

  return (
    <TerminalCommandDisplay
      command="skill lifecycle"
      output={output}
      expandable={events.length > 3}
      maxVisibleLines={6}
      availableWidth={availableWidth}
      exitCode={0}
    />
  )
}

/** Convenience wrapper: display then immediately acknowledge. */
export function SkillLifecycleNoticeAuto(
  props: Omit<SkillLifecycleNoticeProps, 'onDisplayed'>,
): React.ReactNode {
  return (
    <SkillLifecycleNotice
      {...props}
      onDisplayed={(events) =>
        acknowledgeSkillLifecycleEvents(props.projectRoot, 'cli', events)
      }
    />
  )
}
