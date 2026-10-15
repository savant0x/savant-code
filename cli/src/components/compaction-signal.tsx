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
 * FID-2026-0821-001 P1-1/P1-2: in-stream compaction lifecycle signal.
 * FID-2026-0919-017: this component is IN-FLIGHT ONLY — it renders nothing
 * unless the pruner is actively running (`phase === 'compacting'`). It is
 * mounted as the last child of the sticky-bottom chat scrollbox (panels.tsx),
 * so anything it paints becomes a fake last message: later turns render
 * ABOVE it and a stale panel pins above the input until restart. Terminal
 * outcomes live in CompactionSummaryBlock (a real transcript message);
 * warning/blocked/ineffective live in the right sidebar's Context row
 * (formatCompactionStatus). Retirement of the in-flight slot on a new user
 * message still disarms via the store's compaction-signal retirement.
 *
 * Render-only by design: subscribes to store selectors, never mutates chat
 * history (ECHO compliance accounting untouched), never dispatches tools.
 */
// Design tokens (savant-cyberpunk contract): warning=#ff9500 — explicit
// literals so the EHEL design-contract scanner can map every fg
// deterministically.
export const CompactionSignal = React.memo(function CompactionSignal() {
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  // FID-2026-0919-017: the trailing scrollbox slot is reserved for the
  // in-flight phase only. Every other phase (terminal or advisory) renders
  // through its owning surface: CompactionSummaryBlock (terminal transcript
  // message), formatCompactionStatus (sidebar warning/blocked/ineffective
  // row). Nothing else may re-occupy this slot — see panels.tsx.
  if (compactionStatus?.phase !== 'compacting') return null
  // FID-2026-0822-006: chrome comes from the shared TrafficLightPanel
  // primitive. The thin wrapper preserves the previous selectable={false}
  // behavior without extending the primitive's API.
  return (
    <box selectable={false} style={{ width: '100%' }}>
      <TrafficLightPanel>
        <text attributes={TextAttributes.BOLD} fg="#ff9500">
          ⚙ Compacting context…
        </text>
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
