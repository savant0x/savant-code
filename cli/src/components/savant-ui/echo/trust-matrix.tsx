import { TextAttributes } from '@opentui/core'
import React, { useMemo } from 'react'

import { useTheme } from '../../../hooks/use-theme'

import type { PrintModeProvenanceReceipt } from '@savant-code/common/types/print-mode'

export type TrustMatrixTone = 'amber' | 'green' | 'neutral'

export type TrustMatrixRow = {
  seq: number
  path: string
  fidId: string | null
  phase: PrintModeProvenanceReceipt['phase']
  status: PrintModeProvenanceReceipt['status']
  tone: TrustMatrixTone
  verdictText: string
  signed: true
}

export type TrustMatrixState = {
  rows: TrustMatrixRow[]
  dropped: number
}

/**
 * Pure event reducer for the trust matrix (FID-2026-0813-009).
 *
 * A row is renderable only when the event carries a receipt with a matching
 * session/sequence, a writer signature, and `signed: true`. Synthetic UI
 * events, unsigned/off-mode events, and mismatched sequence events are dropped
 * rather than rendered. This is the fidelity warranty, not a cosmetic guard.
 */
export function reduceTrustMatrixEvents(
  events: readonly PrintModeProvenanceReceipt[],
): TrustMatrixState {
  const rows = new Map<number, TrustMatrixRow>()
  let dropped = 0

  for (const event of events) {
    const receipt = event.receipt
    if (
      !event.signed ||
      !receipt ||
      receipt.sessionId !== event.sessionId ||
      receipt.seq !== event.seq ||
      receipt.signatures.length === 0
    ) {
      dropped++
      continue
    }

    const verdictText =
      event.verdictText ??
      receipt.verdicts.find((verdict) => verdict.phase === event.phase)
        ?.verdictText ??
      (event.phase === 'write'
        ? 'Signed write receipt'
        : 'Signed verdict event')
    rows.set(event.seq, {
      seq: event.seq,
      path: receipt.path,
      fidId: receipt.fidId,
      phase: event.phase,
      status: event.status,
      // FID-2026-0814-005: the terminal `no_verdict` state renders neutral —
      // the close annotation is an absence marker (audit-phase by schema) and
      // must never read as an adversarial verdict via tone.
      tone:
        event.status === 'no_verdict'
          ? 'neutral'
          : classifyTone(event.phase, verdictText),
      verdictText,
      signed: true,
    })
  }

  return {
    rows: [...rows.values()].sort((a, b) => a.seq - b.seq),
    dropped,
  }
}

/** Conservative display classification; integrity remains the signature. */
export function classifyTone(
  phase: PrintModeProvenanceReceipt['phase'],
  verdictText: string,
): TrustMatrixTone {
  if (phase === 'audit') return 'amber'
  if (
    phase === 'adversarial' &&
    /^(REFUTED|ADJUSTED)\b/i.test(verdictText.trim())
  ) {
    return 'green'
  }
  return 'neutral'
}

/**
 * FID-2026-0814-005: display label for the receipt status. `pending` reads as
 * "awaiting audit" while the session is live; `no_verdict` is the honest
 * terminal (session closed without an independent verdict); `complete` stays
 * as-is. The label never implies an audit happened when one did not.
 */
export function statusLabel(
  status: PrintModeProvenanceReceipt['status'],
): string {
  if (status === 'pending') return 'awaiting audit'
  if (status === 'no_verdict') return 'no independent verdict'
  if (status === 'complete') return 'complete'
  return status
}

export type TrustMatrixProps = {
  events: readonly PrintModeProvenanceReceipt[]
}

/**
 * Read-only OpenTUI rendering. There are intentionally no action handlers,
 * tool imports, or control callbacks in this component (FID-2026-0813-010).
 */
export const TrustMatrix = React.memo(function TrustMatrix({
  events,
}: TrustMatrixProps) {
  const theme = useTheme()
  const state = useMemo(() => reduceTrustMatrixEvents(events), [events])

  // FID-2026-0813-023 (DET-004): render an explicit placeholder instead of
  // null so an all-unsigned stream never shows a blank titled panel, and
  // surface the dropped-event disclosure which was previously unreachable.
  if (state.rows.length === 0) {
    return (
      <box flexDirection="column" gap={1} focusable={false} selectable={false}>
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          No signed provenance events yet — signed writes and verdicts appear
          here live.
        </text>
        {/* FID-2026-0814-001: live session signal — the count updates as
            events stream, so a static panel is legible (0 = no new writes),
            never "frozen". */}
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`${state.rows.length} signed event(s) this session`}
        </text>
        {state.dropped > 0 && (
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            {`${state.dropped} unsigned/unmatched event(s) hidden`}
          </text>
        )}
      </box>
    )
  }

  return (
    <box flexDirection="column" gap={1} focusable={false} selectable={false}>
      <text
        fg={theme.primary}
        attributes={TextAttributes.BOLD}
        wrapMode="none"
        selectable={false}
      >
        TRUST MATRIX · SIGNED EVENTS
      </text>
      {state.rows.map((row) => (
        <box
          key={row.seq}
          flexDirection="column"
          focusable={false}
          selectable={false}
        >
          <text
            fg={toneColor(theme, row.tone)}
            wrapMode="none"
            selectable={false}
          >
            {`${toneGlyph(row.tone)} #${row.seq} ${row.phase.toUpperCase()} · ${statusLabel(row.status)}`}
          </text>
          <text fg={theme.muted} wrapMode="none" selectable={false}>
            {`  ${row.path}${row.fidId ? ` · ${row.fidId}` : ''}`}
          </text>
          <text fg={theme.foreground} selectable={false}>
            {`  ${row.verdictText}`}
          </text>
        </box>
      ))}
      {state.dropped > 0 && (
        <text fg={theme.muted} wrapMode="none" selectable={false}>
          {`  ${state.dropped} unsigned/unmatched event(s) hidden`}
        </text>
      )}
      {/* FID-2026-0814-001: live session signal — reactive count of signed
          events this session; updates as receipts stream in. */}
      <text fg={theme.muted} wrapMode="none" selectable={false}>
        {`${state.rows.length} signed event(s) this session — live via write/verdict stream`}
      </text>
    </box>
  )
})

function toneGlyph(tone: TrustMatrixTone): string {
  if (tone === 'amber') return '⚠'
  if (tone === 'green') return '✓'
  return '•'
}

function toneColor(
  theme: ReturnType<typeof useTheme>,
  tone: TrustMatrixTone,
): string {
  if (tone === 'amber') return theme.warning
  if (tone === 'green') return theme.success
  return theme.muted
}
