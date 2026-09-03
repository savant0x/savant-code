import { TextAttributes } from '@opentui/core'
import React from 'react'

import { CopyableBlock } from './blocks/copyable-block'
import { Button } from './button'
import { CollapseButton } from './collapse-button'
import { TrafficLightPanel } from './traffic-light-panel'

import type { CompactionSummaryContentBlock } from '../types/chat'

/**
 * FID-2026-0828-001: the post-compaction summary as a first-class transcript
 * entry. The runtime emits a `compaction_summary` PrintModeEvent at the
 * pruner completion boundary (before the run resolves, so manual /compact's
 * compact-and-stop output carries it); this block renders the pruner's
 * summary of the window through the shared TrafficLightPanel chrome.
 *
 * Operator directive 2026-08-28: COLLAPSED BY DEFAULT. The block is the
 * turn's only visible output for manual /compact, so it must be a one-line
 * confirmation — header + first line — not a full-expanded wall that forces
 * several scrolls just to confirm compaction worked. The FULL summary stays
 * in the block; the fold toggle (onToggleCollapsed) reveals it on demand.
 * Nothing is destroyed or hidden from state — only folded in the viewport.
 *
 * Design tokens follow compaction-signal.tsx (savant-cyberpunk contract):
 * success=#39ff14 · muted=#8f8f99 — explicit literals so the EHEL
 * design-contract scanner can map every fg deterministically. Render-only:
 * subscribes to nothing, never mutates chat history, never dispatches tools.
 */
export const CompactionSummaryBlock = React.memo(
  function CompactionSummaryBlock({
    block,
    onToggleCollapsed,
  }: {
    block: CompactionSummaryContentBlock
    onToggleCollapsed?: (id: string) => void
  }) {
    const metrics: string[] = [
      `removed ${String(block.removedMessages)} messages`,
    ]
    if (block.tokensSaved != null) {
      metrics.push(`−${String(block.tokensSaved)} tokens`)
    }
    if (block.percentUsed != null) {
      metrics.push(`${String(Math.round(block.percentUsed))}% of window`)
    }
    const summary = block.summary.trim()
    // Collapsed by default: only the first non-empty line of the summary is
    // shown, the rest folds behind the toggle banner. Expanded shows it all.
    const firstLine =
      summary
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line) ?? ''
    const isCollapsed = block.isCollapsed ?? true

    const header = `${metrics.join(' · ')}`
    const previewLine = isCollapsed && firstLine ? firstLine : ''
    const foldLabel = isCollapsed ? ' ▾ expand' : ' ▴ collapse'
    // Copy captures the WHOLE block: a self-explanatory header plus the full
    // readable summary (no wire tags — those were stripped at runtime).
    const copyText = `✓ Compaction summary — ${header}\n\n${summary}`

    return (
      <box selectable={false} style={{ width: '100%' }}>
        <TrafficLightPanel>
          <CopyableBlock getCopyText={() => copyText}>
            <box style={{ flexDirection: 'column' }}>
              <Button
                style={{ justifyContent: 'flex-start', width: '100%' }}
                onClick={() => onToggleCollapsed?.(block.id)}
              >
                <text attributes={TextAttributes.BOLD} fg="#39ff14">
                  {`✓ Compaction summary — ${header}${foldLabel}`}
                </text>
              </Button>
              {!isCollapsed ? (
                // Expanded: the full summary, nothing hidden.
                <box style={{ flexDirection: 'column' }}>
                  <text fg="#8f8f99">{summary}</text>
                  {/* Operator directive 2026-08-28: an always-visible fold-back
                      right after the content, so re-collapsing doesn't require
                      scrolling back up to the header {CollapseButton} is the
                      same shared control tool/agent blocks use. */}
                  <CollapseButton
                    onClick={() => onToggleCollapsed?.(block.id)}
                  />
                </box>
              ) : previewLine ? (
                // Collapsed: the single first line so the confirmation reads
                // in one row.
                <text fg="#8f8f99">{previewLine}</text>
              ) : null}
            </box>
          </CopyableBlock>
        </TrafficLightPanel>
      </box>
    )
  },
)
