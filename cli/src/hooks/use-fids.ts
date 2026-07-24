/**
 * useFids Hook (FID-2026-0720-033c Phase C)
 *
 * React hook that loads active FIDs from `dev/fids/` and provides a refresh
 * callback. Bridges the `loadFids()` utility to the React component tree so
 * `<FidList>` can render live FID data without callers manually passing props.
 *
 * Usage:
 *   const { fids, isLoading, refresh } = useFids()
 *   <FidList fids={fids} onSelect={...} />
 *
 * Law 14: `loadFids` never throws (returns [] on fs errors), so this hook
 * does not need a try/catch or error state — the worst case is an empty list.
 */

import { useCallback, useEffect, useState } from 'react'

import { loadFids } from '../utils/fid-loader'

import type { FidData } from '../components/savant-ui/echo/fid-list'

export interface UseFidsResult {
  fids: FidData[]
  isLoading: boolean
  refresh: () => void
}

/**
 * Load active FIDs from `dev/fids/` on mount, with a manual refresh callback.
 *
 * @param fidsDir - Optional override for the FIDs directory (used by tests
 *   to point at a fixture directory). Defaults to `cwd/dev/fids`.
 */
export function useFids(fidsDir?: string): UseFidsResult {
  const [fids, setFids] = useState<FidData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(() => {
    setFids(loadFids(fidsDir))
    setIsLoading(false)
  }, [fidsDir])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { fids, isLoading, refresh }
}
