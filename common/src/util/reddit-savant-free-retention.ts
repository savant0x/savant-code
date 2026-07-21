const DAY_MS = 24 * 60 * 60 * 1000

/** PostHog-style retention windows to mirror in Reddit CAPI custom events. */
export const SAVANT_FREE_REDDIT_RETENTION_MILESTONE_DAYS = [1, 7, 24] as const

export type RedditRetentionMilestone =
  (typeof SAVANT_FREE_REDDIT_RETENTION_MILESTONE_DAYS)[number]

export type RedditRetentionConfig = {
  fireFirstPrompt: boolean
  retentionMilestones: RedditRetentionMilestone[]
}

function daysBetween(fromDateKey: string, toDateKey: string): number {
  const from = new Date(`${fromDateKey}T00:00:00.000Z`).getTime()
  const to = new Date(`${toDateKey}T00:00:00.000Z`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) {
    throw new Error(`Invalid date key range: ${fromDateKey} -> ${toDateKey}`)
  }
  return Math.round((to - from) / DAY_MS)
}

/** First successful savant-free prompt = first-ever usage day recorded. */
export function isFirstSavantFreePrompt(params: {
  previousUsageDays: readonly string[]
  newUsageDayRecorded: boolean
}): boolean {
  return params.newUsageDayRecorded && params.previousUsageDays.length === 0
}

/** Milestones that newly cross on this usage day (each fires at most once). */
export function getSavantFreeRetentionMilestonesToFire(params: {
  previousUsageDays: readonly string[]
  todayDateKey: string
  newUsageDayRecorded: boolean
}): RedditRetentionMilestone[] {
  if (!params.newUsageDayRecorded) {
    return []
  }

  const firstDay = [...params.previousUsageDays, params.todayDateKey].reduce(
    (min, dateKey) => (dateKey < min ? dateKey : min),
  )
  const daysSinceFirstToday = daysBetween(firstDay, params.todayDateKey)
  const maxPreviousDaysSinceFirst =
    params.previousUsageDays.length === 0
      ? -1
      : Math.max(
          ...params.previousUsageDays.map((dateKey) =>
            daysBetween(firstDay, dateKey),
          ),
        )

  return SAVANT_FREE_REDDIT_RETENTION_MILESTONE_DAYS.filter(
    (milestone) =>
      daysSinceFirstToday >= milestone &&
      maxPreviousDaysSinceFirst < milestone,
  )
}

export function planSavantFreeRedditConversionEvents(params: {
  previousUsageDays: readonly string[]
  todayDateKey: string
  newUsageDayRecorded: boolean
}): RedditRetentionConfig {
  return {
    fireFirstPrompt: isFirstSavantFreePrompt(params),
    retentionMilestones: getSavantFreeRetentionMilestonesToFire(params),
  }
}
