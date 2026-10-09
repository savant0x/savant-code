import { useState } from 'react'

import { ComplianceCharts } from './ComplianceCharts'
import { useCompliance } from '../../hooks/use-compliance'
import './compliance-panel.css'

import type { ComplianceApi, ComplianceWindow } from './compliance-data'
import type { JSX } from 'react'

export function CompliancePanel({
  api,
  connected,
}: {
  api: ComplianceApi
  connected: boolean
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [window, setWindow] = useState<ComplianceWindow>('7d')
  const { state, retry } = useCompliance(api, window, connected && expanded)
  return (
    <details
      className="compliance-panel"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>
        Compliance <span>Local observations</span>
      </summary>
      <div className="compliance-body">
        <div className="compliance-controls" aria-label="Compliance window">
          {(['7d', '30d', 'all'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={window === value}
              onClick={() => setWindow(value)}
            >
              {value === 'all'
                ? 'All time'
                : value === '7d'
                  ? '7 days'
                  : '30 days'}
            </button>
          ))}
          <button
            type="button"
            disabled={!connected || state.status === 'loading'}
            onClick={retry}
          >
            Refresh
          </button>
        </div>
        {!connected ? (
          <p role="status" className="compliance-note">
            Connect to load compliance data.
          </p>
        ) : state.status === 'loading' || state.status === 'offline' ? (
          <p role="status" className="compliance-note">
            Loading compliance…
          </p>
        ) : state.status === 'error' ? (
          <p role="alert" className="compliance-note">
            {state.message}
          </p>
        ) : (
          <ComplianceCharts data={state.aggregates} />
        )}
      </div>
    </details>
  )
}
