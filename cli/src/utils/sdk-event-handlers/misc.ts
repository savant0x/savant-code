import { appendTextToRootStream } from '../block-operations'
import { resetUiToIdle } from '../finish-logic'

import type { EventHandlerState } from './types'
import type {
  PrintModeEvent as SDKEvent,
  PrintModeFinish,
} from '@savant-code/common/types/print-mode'

/**
 * FID-2026-0804-009: render a harness ECHO compliance receipt as a muted
 * transcript line. Non-blocking by design — the receipt informs, it never
 * blocks the stream or opens a modal. The runtime also injects corrective
 * steering into the agent's own context, so the model sees the same notice.
 */
const COMPLIANCE_LABELS: Record<string, string> = {
  law1: 'ECHO Law 1 (read-before-write)',
  law3: 'ECHO Law 3 (verify-before-proceed)',
  law7: 'ECHO Law 7 (search-before-create)',
  law8: 'ECHO Law 8 (intent-before-coding)',
  verifier_criteria: 'ECHO Verifier trigger',
  fid: 'ECHO active-FID review',
}
export const handleComplianceWarning = (
  state: EventHandlerState,
  event: Extract<SDKEvent, { type: 'compliance_warning' }>,
) => {
  const label = COMPLIANCE_LABELS[event.law] ?? 'ECHO compliance'
  const marker = event.severity === 'info' ? 'ℹ️' : '⚖️'
  const line = `\n${marker} **${label}:** ${event.message}${event.path ? ` \`${event.path}\`` : ''}`
  state.logger.warn(
    { law: event.law, severity: event.severity, path: event.path },
    `[${label}] ${event.message}`,
  )
  state.message.updater.updateAiMessageBlocks((blocks) =>
    appendTextToRootStream(blocks, { type: 'text', text: line }),
  )
}
/**
 * FID-2026-0828-001: append the post-compaction summary as a dedicated
 * transcript block (rendered through TrafficLightPanel). Non-blocking by
 * design — mirrors the compliance-receipt append pattern: the event informs
 * the transcript, it never blocks the stream. The runtime emits it once per
 * real compaction at the pruner completion boundary, strictly before the run
 * resolves, so compact-and-stop turns carry it as their visible output.
 */
export const handleCompactionSummary = (
  state: EventHandlerState,
  event: Extract<SDKEvent, { type: 'compaction_summary' }>,
) => {
  state.logger.info(
    {
      removedMessages: event.removedMessages,
      tokensSaved: event.tokensSaved,
      percentUsed: event.percentUsed,
      summaryChars: event.summary.length,
    },
    '[compaction] summary block appended to transcript',
  )
  // Stable per-block id for the collapse toggle. Derived from a module-local
  // counter so each appended summary gets a distinct identity even when events
  // arrive in the same burst (auto-compact + manual in one run).
  const blockId = `compaction-summary-${++compactionSummarySeq}`
  state.message.updater.updateAiMessageBlocks((blocks) => [
    ...blocks,
    {
      type: 'compaction-summary',
      // Collapsed by default (operator directive 2026-08-28): the summary is
      // the turn's visible output, so it must be a one-line confirmation, not
      // a full-expanded wall that forces many scrolls. The FULL content stays
      // in the block and behind the fold toggle.
      id: blockId,
      isCollapsed: true,
      summary: event.summary,
      removedMessages: event.removedMessages,
      ...(event.tokensSaved !== undefined
        ? { tokensSaved: event.tokensSaved }
        : {}),
      ...(event.percentUsed !== undefined
        ? { percentUsed: event.percentUsed }
        : {}),
    },
  ])
}

let compactionSummarySeq = 0
export const handleFinish = (
  state: EventHandlerState,
  event: PrintModeFinish,
) => {
  if (typeof event.totalCost === 'number' && state.onTotalCost) {
    state.onTotalCost(event.totalCost)
  }
  // FID-2026-0718-010 (F2 backstop, D5): if finish arrives, ensure UI is
  // reset to idle. Some runs don't fire subagent_finish for the parent
  // until after onStreamEnded. Treat `finish` as a strong backstop.
  resetUiToIdle('finish')
}
