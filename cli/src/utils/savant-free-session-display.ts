export const SAVANT_FREE_COUNTDOWN_VISIBLE_MS = 5 * 60_000

export const formatSavantFreeSessionCountdown = (ms: number): string => {
  if (ms <= 0) return 'expiring…'
  const totalSeconds = Math.ceil(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const formatSavantFreeSessionRemaining = (ms: number): string => {
  if (ms <= 0) return 'expiring…'
  if (ms < SAVANT_FREE_COUNTDOWN_VISIBLE_MS) {
    return `${formatSavantFreeSessionCountdown(ms)} left`
  }
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes < 60) return `${totalMinutes}m left`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h left` : `${hours}h ${minutes}m left`
}
