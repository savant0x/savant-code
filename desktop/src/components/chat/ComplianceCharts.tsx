import { rankCounts, trendPoints } from './compliance-data'

import type { TelemetryAggregates } from '../../lib/gateway-protocol'
import type { JSX } from 'react'

function ComplianceHeatmap({
  data,
}: {
  data: TelemetryAggregates
}): JSX.Element {
  const models = rankCounts(data.violationsByModel).map(([model]) => model)
  const laws = rankCounts(data.violationsByLaw)
  const max = Math.max(1, ...laws.map(([, count]) => count))
  return (
    <div
      className="compliance-scroll"
      tabIndex={0}
      role="region"
      aria-label="Law by model counts"
    >
      <table className="compliance-matrix">
        <caption>Law × requested model · event counts</caption>
        <thead>
          <tr>
            <th scope="col">Law</th>
            {models.map((model) => (
              <th key={model} scope="col">
                {model || 'Unattributed'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {laws.map(([law]) => (
            <tr key={law}>
              <th scope="row">{law}</th>
              {models.map((model) => {
                const count = data.lawByModel[law]?.[model] ?? 0
                return (
                  <td
                    key={model}
                    data-intensity={
                      count === 0 ? 'zero' : count / max > 0.5 ? 'high' : 'low'
                    }
                  >
                    {count}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComplianceTrend({
  series,
}: {
  series: TelemetryAggregates['trendSeries']
}): JSX.Element {
  const total = series.reduce((sum, item) => sum + item.count, 0)
  return (
    <details className="compliance-trend">
      <summary>Daily trend · {total} dated events</summary>
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily compliance events, ${total} total`}
      >
        <polyline
          points={trendPoints(series)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <ol>
        {series.map((item) => (
          <li key={item.day}>
            <time>{item.day}</time>
            <span>{item.count}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export function ComplianceCharts({
  data,
}: {
  data: TelemetryAggregates
}): JSX.Element {
  const total = Object.values(data.violationsByLaw).reduce(
    (sum, count) => sum + count,
    0,
  )
  if (total === 0)
    return (
      <p className="compliance-note">No compliance events in this window.</p>
    )
  return (
    <>
      <ol className="compliance-laws" aria-label="Most observed laws">
        {rankCounts(data.violationsByLaw)
          .slice(0, 5)
          .map(([law, count]) => (
            <li key={law}>
              <span>Law {law}</span>
              <strong>{count}</strong>
            </li>
          ))}
      </ol>
      <ComplianceHeatmap data={data} />
      <ComplianceTrend series={data.trendSeries} />
      <p className="compliance-note">
        {total} observations · counts, not violation rates.
      </p>
      {data.meta.skippedLines > 0 && (
        <p className="compliance-note">
          {data.meta.skippedLines} malformed ledger lines skipped.
        </p>
      )}
    </>
  )
}
