import { useLoopSchedule } from '../../../hooks/use-loop-scheduler'
import { useTheme } from '../../../hooks/use-theme'
import { KeyValueRow } from '../../savant-ui/primitives/key-value-row'
import { SidebarSection } from '../../savant-ui/primitives/sidebar-section'

/**
 * LoopStatusPanel — shows active loop status in the right sidebar.
 *
 * Reads from the module-level schedule managed by use-loop-scheduler.ts.
 * Shows cadence, goal condition (if set), next run time, and iteration count.
 */
export function LoopStatusPanel() {
  const theme = useTheme()
  const schedule = useLoopSchedule()

  if (!schedule) {
    return (
      <SidebarSection title="Loop">
        <text fg={theme.muted} selectable={false}>
          No active loop
        </text>
      </SidebarSection>
    )
  }

  const timeUntilNext = Math.max(0, schedule.nextRunAt - Date.now())
  const minutes = Math.floor(timeUntilNext / 60_000)
  const seconds = Math.floor((timeUntilNext % 60_000) / 1000)
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`

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
      <KeyValueRow label="Cadence" value={schedule.cadenceLabel} />
      <KeyValueRow label="Next run" value={`in ${timeStr}`} />
      <KeyValueRow label="Iterations" value={schedule.runCount.toString()} />
      {schedule.goalCondition && (
        <KeyValueRow
          label="Goal"
          value={<text fg={theme.foreground}>{schedule.goalCondition}</text>}
        />
      )}
      {schedule.lastRunAt && (
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
