import { TextAttributes } from '@opentui/core'
import React from 'react'

import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'

import type { CompactionLifecycleEvent } from '../state/chat-store/types'

/**
 * FID-2026-0814-006: in-stream compaction lifecycle signal (kimi pattern).
 *
 * Renders a compact, non-intrusive block at the bottom of the chat transcript:
 *   - `⚙ Compacting context…` while a full pruner run is in flight
 *   - `✓ Compaction complete (−N tokens)` after a successful `pruned` outcome
 *   - `⚠ Compaction ineffective` after a pruner run that removed nothing
 *
 * Render-only by design: it only subscribes to store selectors and never
 * mutates the chat history (a runtime mutation would corrupt ECHO compliance
 * accounting) and has no tool or write path. The sidebar `Compaction` row
 * keeps the live percent; this block is the one-per-lifecycle terminal
 * signal, bounded by the store's 5-event cap.
 */
export const CompactionSignal = React.memo(function CompactionSignal() {
  const theme = useTheme()
  const compactionStatus = useChatStore((s) => s.compactionStatus)
  const compactionEvents = useChatStore((s) => s.compactionEvents)

  // While a full pruner run is in flight the runtime writes `compacting` —
  // show the in-progress line regardless of any prior terminal event.
  if (compactionStatus?.phase === 'compacting') {
    return (
      <box
        selectable={false}
        style={{
          flexDirection: 'row',
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text
          attributes={TextAttributes.BOLD}
          fg={theme.warning}
          style={{ wrapMode: 'none' }}
        >
          ⚙ Compacting context…
        </text>
      </box>
    )
  }

  // Otherwise show the most recent terminal lifecycle event (one per run).
  const last = compactionEvents[compactionEvents.length - 1]
  if (!last) return null

  return <CompactionTerminalLine theme={theme} event={last} />
})

function CompactionTerminalLine({
  theme,
  event,
}: {
  theme: ReturnType<typeof useTheme>
  event: CompactionLifecycleEvent
}) {
  if (event.outcome === 'pruned') {
    const tokens = event.tokensSaved ?? 0
    return (
      <box
        selectable={false}
        style={{
          flexDirection: 'row',
          gap: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text
          attributes={TextAttributes.BOLD}
          fg={theme.success}
          style={{ wrapMode: 'none' }}
        >
          {`✓ Compaction complete (−${tokens.toLocaleString()} tokens)`}
        </text>
      </box>
    )
  }
  return (
    <box
      selectable={false}
      style={{
        flexDirection: 'row',
        gap: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text
        attributes={TextAttributes.BOLD}
        fg={theme.warning}
        style={{ wrapMode: 'none' }}
      >
        ⚠ Compaction ineffective — context still over the pruner trigger
      </text>
    </box>
  )
}
