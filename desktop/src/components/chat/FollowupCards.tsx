// FID-2026-0901-006 — clickable suggested-followup cards (CLI parity).
//
// The CLI renders a `suggest_followups` tool result as clickable cards that
// send the followup prompt as a user message. The desktop shows the raw tool
// JSON, which reads as a collapsed dropdown. This parses the tool input's
// `followups` array (the exact shape the CLI consumes) and renders the same
// clickable cards — clicking one sends the prompt through the same path as a
// typed message.

import { memo } from 'react'

import type { JSX } from 'react'

interface SuggestedFollowup {
  /** Shown as the clickable label. */
  readonly prompt: string
  /** Optional short line displayed under the prompt. */
  readonly label?: string
}

export function parseFollowups(inputJson: string | null): SuggestedFollowup[] {
  if (inputJson === null) return []
  try {
    const parsed = JSON.parse(inputJson) as { followups?: unknown }
    const raw = parsed.followups
    if (!Array.isArray(raw)) return []
    return raw.filter(
      (entry): entry is SuggestedFollowup =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as SuggestedFollowup).prompt === 'string',
    )
  } catch {
    return []
  }
}

export const FollowupCards = memo(function FollowupCards({
  inputJson,
  onSend,
}: {
  readonly inputJson: string | null
  readonly onSend: (prompt: string) => void
}): JSX.Element | null {
  const followups = parseFollowups(inputJson)
  if (followups.length === 0) return null
  // P23 (operator: "it has 2 title bars, only keep the one with the traffic
  // lights"): FollowupCards renders INSIDE the tool card whose head (lights
  // + "Suggest Followups") is the title bar — the extra `tool-label` strip
  // is gone.
  return (
    <div className="followup-list">
      {followups.map((followup, index) => (
        <button
          key={`${followup.prompt}-${index}`}
          type="button"
          className="followup-card"
          /* P24/P25 (operator: "there are no tooltips when hovering the
               suggest followups items"): WebView2 suppresses/slow-paints
               native `title` tooltips, so the prompt rides in a `data-tip`
               attribute rendered as a real CSS tooltip (::after) on
               hover/focus — deterministic, styled, always surfaces. */
          data-tip={followup.prompt}
          onClick={() => {
            onSend(followup.prompt)
          }}
        >
          <span className="followup-card-label">
            {followup.label ?? followup.prompt}
          </span>
          {followup.label !== undefined ? (
            <span className="followup-card-prompt">{followup.prompt}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
})
