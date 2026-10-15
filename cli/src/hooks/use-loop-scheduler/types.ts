/**
 * Cadence specification parsed from user input.
 * Supports: Nd (daily), Nh (hourly), Nm (every N minutes), Ns (every N seconds)
 */
export interface LoopSchedule {
  /** Unique ID for this loop instance */
  id: string
  /** Cadence in milliseconds */
  cadenceMs: number
  /** Human-readable cadence label (e.g., "1h", "5m") */
  cadenceLabel: string
  /** The prompt to re-send on each cadence */
  prompt: string
  /** Whether this loop is currently active */
  isActive: boolean
  /** Timestamp of the next scheduled run */
  nextRunAt: number
  /** Total number of runs completed */
  runCount: number
  /** Timestamp of the last run */
  lastRunAt?: number
  /** Whether the last run succeeded */
  lastRunSuccess?: boolean
  /** Goal condition string, if a goal was set */
  goalCondition?: string | null
  /** Whether the last run failed with an error */
  lastRunFailed?: boolean
}

/**
 * Result from the loop scheduler hook.
 */
export interface UseLoopSchedulerReturn {
  /** The active loop schedule, or null if no loop is active */
  activeLoop: LoopSchedule | null
  /** Start a new loop with the given cadence and prompt */
  startLoop: (cadenceMs: number, cadenceLabel: string, prompt: string) => void
  /** Stop the active loop */
  stopLoop: () => void
  /** Get the current loop status for display */
  getStatus: () => LoopStatus
}

/**
 * Status information for display in /loop status command.
 */
export interface LoopStatus {
  isActive: boolean
  cadenceLabel: string
  timeUntilNextRun: string
  runCount: number
  lastRunAt?: string
  lastRunSuccess?: boolean
}

/**
 * Parse a cadence string like "30s", "1d", "1h", or "5m" into milliseconds.
 */
export function parseCadence(
  input: string,
): { intervalMs: number; label: string } | null {
  const match = input.trim().match(/^(\d+)([sdhm])$/)
  if (!match) return null

  const amount = parseInt(match[1], 10)
  const unit = match[2]
  if (amount <= 0) return null

  switch (unit) {
    case 's':
      return { intervalMs: amount * 1000, label: `${amount}s` }
    case 'd':
      return { intervalMs: amount * 24 * 60 * 60 * 1000, label: `${amount}d` }
    case 'h':
      return { intervalMs: amount * 60 * 60 * 1000, label: `${amount}h` }
    case 'm':
      return { intervalMs: amount * 60 * 1000, label: `${amount}m` }
    default:
      return null
  }
}

/**
 * Format milliseconds to a human-readable duration string.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'now'

  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${Math.ceil(ms / 1000)}s`
}

/**
 * Format a timestamp to a human-readable date string.
 */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString()
}

/**
 * Generate a unique loop ID.
 */
export function generateLoopId(): string {
  return `loop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
