import { useLoopSchedule } from '../../../hooks/use-loop-scheduler'
import { useTheme } from '../../../hooks/use-theme'
import { useChatStore } from '../../../state/chat-store'
import { KeyValueRow } from '../../savant-ui/primitives/key-value-row'
import { SidebarSection } from '../../savant-ui/primitives/sidebar-section'

import type { GoalRecord } from '@savant-code/common/types/session-state'

/**
 * LoopStatusPanel — shows active loop status in the right sidebar.
 *
 * Reads from the module-level schedule managed by use-loop-scheduler.ts.
 * Shows cadence, goal condition (if set), next run time, and iteration count.
 */
export function LoopStatusPanel() {
  const theme = useTheme()
  const schedule = useLoopSchedule()
  // FID-2026-0814-002: durable goal record mirrored from the runtime session
  // snapshot (the runtime owns the record; this is read-only).
  const goal = useChatStore(
    (s) =>
      s.runState?.sessionState?.mainAgentState?.goal as GoalRecord | undefined,
  )

  if (!schedule && !goal) {
    return (
      <SidebarSection title="Loop">
        <text fg={theme.muted} selectable={false}>
          No active loop
        </text>
      </SidebarSection>
    )
  }

  const timeUntilNext = schedule
    ? Math.max(0, schedule.nextRunAt - Date.now())
    : 0
  const minutes = Math.floor(timeUntilNext / 60_000)
  const seconds = Math.floor((timeUntilNext % 60_000) / 1000)
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

  const goalColor =
    goal?.status === 'blocked'
      ? theme.error
      : goal?.status === 'paused'
        ? theme.warning
        : theme.success

  return (
    <SidebarSection title="Loop">
      <KeyValueRow
        label="Status"
        value={
          <text fg={theme.success} selectable={false}>
            🔄 Active
          </text>
        }
      />
      {schedule && (
        <>
          <KeyValueRow label="Cadence" value={schedule.cadenceLabel} />
          <KeyValueRow label="Next run" value={`in ${timeStr}`} />
          <KeyValueRow
            label="Iterations"
            value={schedule.runCount.toString()}
          />
        </>
      )}
      {goal && (
        <KeyValueRow
          label="Goal"
          value={
            <text fg={goalColor} selectable={false}>
              {goal.status === 'active'
                ? `🔄 ${goal.objective.slice(0, 60)}`
                : `${goal.status === 'paused' ? '⏸' : '⛔'} ${goal.objective.slice(0, 60)}`}
            </text>
          }
        />
      )}
      {goal && (
        <KeyValueRow
          label="Goal usage"
          value={`${goal.turnsUsed}t / ${goal.tokensUsed} tok / ${Math.round(goal.wallClockMs / 1000)}s`}
        />
      )}
      {schedule?.goalCondition && (
        <KeyValueRow
          label="Legacy goal"
          value={<text fg={theme.foreground}>{schedule.goalCondition}</text>}
        />
      )}
      {schedule?.lastRunAt && (
        <KeyValueRow
          label="Last run"
          value={
            schedule.lastRunSuccess
              ? '✅ success'
              : schedule.lastRunFailed
                ? '❌ failed'
                : '⏳ pending'
          }
        />
      )}
    </SidebarSection>
  )
}
