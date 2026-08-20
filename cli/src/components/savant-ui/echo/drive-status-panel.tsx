import { useTheme } from '../../../hooks/use-theme'
import { useChatStore } from '../../../state/chat-store'
import { KeyValueRow } from '../../savant-ui/primitives/key-value-row'
import { SidebarSection } from '../../savant-ui/primitives/sidebar-section'

import type { DriveStatusRecord } from '@savant-code/common/types/auto-drive'

/**
 * FID-2026-0818-007 step 2: the sidebar's live Auto Drive surface.
 *
 * Reads the observable `DriveStatusRecord` mirrored from the runtime session
 * snapshot (the driver derives it; this component is read-only) and renders:
 * goal one-liner, active FID, phase chip, open count, the queue-growth trend
 * (the runaway-discovery signal), and the Run Log event count. When no drive
 * is running the section renders empty — no confirmation, ever.
 */
export function DriveStatusPanel() {
  const theme = useTheme()
  const status = useChatStore(
    (s) =>
      s.runState?.sessionState?.mainAgentState?.driveStatus as
        DriveStatusRecord | undefined,
  )

  if (!status) return null

  const trendLabel =
    status.queueTrend > 0
      ? `+${status.queueTrend}`
      : status.queueTrend < 0
        ? `${status.queueTrend}`
        : '0'
  const trendColor =
    status.queueTrend > 0
      ? theme.warning
      : status.queueTrend < 0
        ? theme.success
        : theme.muted

  const phase = status.phase ? status.phase.toUpperCase() : '—'

  return (
    <SidebarSection title="Auto Drive" defaultExpanded>
      <KeyValueRow
        label="Goal"
        value={
          <text fg={theme.foreground} wrapMode="word" selectable={false}>
            {status.goal.slice(0, 60)}
          </text>
        }
      />
      <KeyValueRow label="Active FID" value={status.activeFid ?? '(none)'} />
      <KeyValueRow label="Phase" value={phase} />
      <KeyValueRow label="Open FIDs" value={status.openCount.toString()} />
      <KeyValueRow
        label="Growth"
        value={
          <text fg={trendColor} selectable={false}>
            {trendLabel}
          </text>
        }
      />
      <KeyValueRow label="Run Log" value={status.runLogCount.toString()} />
    </SidebarSection>
  )
}
