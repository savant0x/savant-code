import { TextAttributes } from '@opentui/core'
import React from 'react'

import { Button } from './button'
import { CollapseButton } from './collapse-button'
import { TrafficLightPanel } from './traffic-light-panel'
import { useChatStore } from '../state/chat-store'

import type { LastCompactionReport } from '../state/chat-store/chat-store-common-types'

/**
 * FID-2026-0916-008: chars of the report excerpt shown in the collapsed header
 * row before the `…` truncation marker. Bounded well under the terminal width
 * so the `▾ expand` affordance stays on screen.
 */
const REPORT_EXCERPT_PREVIEW_CHARS = 160
/**
 * FID-2026-0821-001 P1-1/P1-2: in-stream compaction lifecycle panel,
 * restyled after the TerminalCommandDisplay chrome — rounded border on the
 * surface color with the right-aligned TrafficLights title bar (FID-2026-
 * 0817-001 glow cycle; the animation budget suspends the dots off-screen).
 * FID-2026-0822-006: the chrome recipe itself is owned by the shared
 * TrafficLightPanel primitive (Law 13) — no hand-rolled copy remains.
 *
 * Phases rendered, highest priority first:
 *   compacting → ⚙ in-flight line (glowing title bar)
 *   blocked    → ⛔ reasoned block line (P0-1: WHY nothing happened)
 *   compacted  → ✓ micro-compact completion line (FID-2026-0824-023)
 *   warning    → one-shot threshold warning with the live window percent
 *   otherwise  → most recent terminal lifecycle event
 *                (✓ pruned / ⚙ micro-compacted / ⚠ ineffective)
 *
 * Render-only by design: subscribes to store selectors, never mutates chat
 * history (ECHO compliance accounting untouched), never dispatches tools.
 */
// Design tokens (savant-cyberpunk contract): warning=#ff9500
// error=#ff2d55 · success=#39ff14 · muted=#8f8f99 — explicit literals so the
// EHEL design-contract scanner can map every fg deterministically.
export const CompactionSignal = React.memo(function CompactionSignal() {
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const compactionEvents = useChatStore((s) => s.compactionEvents)
  const lastCompactionReport = useChatStore((s) => s.lastCompactionReport)
  // FID-2026-0916-008: local fold state for the report excerpt. The panel is
  // render-only — this is viewport state, never chat history.
  const [reportExpanded, setReportExpanded] = React.useState(false)
  const phase = compactionStatus?.phase
  const body = (() => {
    if (phase === 'compacting') {
      return (
        <text attributes={TextAttributes.BOLD} fg="#ff9500">
          ⚙ Compacting context…
        </text>
      )
    }
    if (phase === 'blocked') {
      return (
        <text attributes={TextAttributes.BOLD} fg="#ff2d55">
          ⛔ Auto-compact blocked ({compactionStatus?.blockReason ?? 'unknown'})
        </text>
      )
    }
    if (phase === 'compacted') {
      // FID-2026-0824-023: Layer-2 micro-compact outcomes are visible — data
      // destruction is never silent.
      const saved = compactionStatus?.tokensSaved
      return (
        <text attributes={TextAttributes.BOLD} fg="#39ff14">
          ✓ Micro-compacted{saved ? ` (−${String(saved)} tokens)` : ''} — stale
          tool results cleared
        </text>
      )
    }
    if (phase === 'warning') {
      const pct = compactionStatus?.percentUsed
      return (
        <text attributes={TextAttributes.BOLD} fg="#ff9500">
          ⚠ Context at {pct != null ? `${pct}%` : 'high'} of window —
          auto-compact armed
        </text>
      )
    }
    const last = compactionEvents[compactionEvents.length - 1]
    if (!last) return null
    if (last.outcome === 'pruned') {
      return (
        <text>
          <span fg="#39ff14" attributes={TextAttributes.BOLD}>
            ✓ Compaction complete
            {last.tokensSaved ? ` (−${String(last.tokensSaved)} tokens)` : ''}
          </span>
          {last.percentUsed != null && (
            <span fg="#8f8f99">{` — ${last.percentUsed}% of window`}</span>
          )}
        </text>
      )
    }
    if (last.outcome === 'compacted') {
      // FID-2026-0824-023: micro-compact events render distinctly — never
      // mislabeled as an ineffective full compaction.
      return (
        <text fg="#8f8f99">
          {`⚙ Micro-compaction −${String(last.tokensSaved ?? 0)} tokens`}
        </text>
      )
    }
    return (
      <text attributes={TextAttributes.BOLD} fg="#ff9500">
        ⚠ Compaction ineffective — context still over the pruner trigger
      </text>
    )
  })()

  if (!body) return null

  // FID-2026-0822-006: chrome comes from the shared TrafficLightPanel
  // primitive. The thin wrapper preserves the previous selectable={false}
  // behavior without extending the primitive's API.
  return (
    <box selectable={false} style={{ width: '100%' }}>
      <TrafficLightPanel>
        <box style={{ flexDirection: 'column' }}>
          {body}
          {lastCompactionReport ? (
            <CompactionReportExcerpt
              report={lastCompactionReport}
              reportExpanded={reportExpanded}
              onToggleExpanded={() => setReportExpanded((v) => !v)}
            />
          ) : null}
        </box>
      </TrafficLightPanel>
    </box>
  )
})

/**
 * FID-2026-0916-008: the post-compaction report excerpt, folded behind the
 * same toggle CompactionSummaryBlock uses (Law 11). Collapsed by default —
 * the header + a 160-char preview render in one row; the full excerpt
 * reveals on demand. This replaces the old always-visible dump, which could
 * not be folded.
 *
 * Extracted as a prop-driven presentational sub-component (the same shape
 * as CompactionSummaryBlock's `isCollapsed` prop) so BOTH fold states are
 * statically testable under react-dom/server — the harness cannot simulate
 * clicks, so the toggle state must be injectable rather than internal.
 */
export function CompactionReportExcerpt({
  report,
  reportExpanded,
  onToggleExpanded,
}: {
  report: LastCompactionReport
  reportExpanded: boolean
  onToggleExpanded: () => void
}) {
  const excerpt = report.summaryExcerpt.trim()
  return (
    <box style={{ flexDirection: 'column' }}>
      <Button
        style={{ justifyContent: 'flex-start', width: '100%' }}
        onClick={onToggleExpanded}
      >
        <text fg="#8f8f99">
          {`▸ removed ${String(report.removedMessages)} messages · summary: ${excerpt.slice(
            0,
            REPORT_EXCERPT_PREVIEW_CHARS,
          )}${excerpt.length > REPORT_EXCERPT_PREVIEW_CHARS ? '…' : ''} ${reportExpanded ? '▴ collapse' : '▾ expand'}`}
        </text>
      </Button>
      {reportExpanded ? (
        <box style={{ flexDirection: 'column' }}>
          <text fg="#8f8f99">{excerpt}</text>
          {/* Re-collapse without scrolling back up to the header (same
              shared control as CompactionSummaryBlock). */}
          <CollapseButton onClick={onToggleExpanded} />
        </box>
      ) : null}
    </box>
  )
}
