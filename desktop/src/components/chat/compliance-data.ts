import type { TelemetryAggregates } from '../../lib/gateway-protocol'

export type ComplianceWindow = '7d' | '30d' | 'all'
export type ComplianceApi = {
  getTelemetryAggregates(
    window: ComplianceWindow,
  ): Promise<{ window: string; aggregates: TelemetryAggregates }>
}
export type ComplianceState =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'error'; message: string }
  | { status: 'ready'; aggregates: TelemetryAggregates }

/** One cancelable refresh owner per mounted window; no overlapping polls. */
export function createComplianceRefresh(
  api: ComplianceApi,
  window: ComplianceWindow,
  publish: (state: ComplianceState) => void,
): { refresh(): Promise<void>; dispose(): void } {
  let active = true
  let busy = false
  return {
    async refresh(): Promise<void> {
      if (!active || busy) return
      busy = true
      try {
        const result = await api.getTelemetryAggregates(window)
        if (result.window !== window)
          throw new Error('Telemetry window mismatch')
        if (active) publish({ status: 'ready', aggregates: result.aggregates })
      } catch {
        if (active)
          publish({
            status: 'error',
            message:
              'Compliance data could not be loaded. Retry when connected.',
          })
      } finally {
        busy = false
      }
    },
    dispose(): void {
      active = false
    },
  }
}

export function rankCounts(
  counts: Record<string, number>,
): Array<[string, number]> {
  return Object.entries(counts).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
}

export function trendPoints(
  series: TelemetryAggregates['trendSeries'],
): string {
  const max = Math.max(1, ...series.map((item) => item.count))
  return series
    .map(
      (item, index) =>
        `${series.length < 2 ? 50 : (index * 100) / (series.length - 1)},${28 - (item.count / max) * 24}`,
    )
    .join(' ')
}
