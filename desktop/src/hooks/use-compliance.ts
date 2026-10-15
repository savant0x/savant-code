import { useEffect, useState } from 'react'

import { createComplianceRefresh } from '../components/chat/compliance-data'

import type {
  ComplianceApi,
  ComplianceState,
  ComplianceWindow,
} from '../components/chat/compliance-data'

export function useCompliance(
  api: ComplianceApi,
  window: ComplianceWindow,
  enabled: boolean,
): {
  state: ComplianceState
  retry(): void
} {
  const [state, setState] = useState<ComplianceState>({ status: 'loading' })
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setState({ status: 'offline' })
      return
    }
    setState({ status: 'loading' })
    const owner = createComplianceRefresh(api, window, setState)
    void owner.refresh()
    const interval = setInterval(() => void owner.refresh(), 30_000)
    return () => {
      owner.dispose()
      clearInterval(interval)
    }
  }, [api, window, enabled, revision])
  return { state, retry: () => setRevision((value) => value + 1) }
}
