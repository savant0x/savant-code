/**
 * useFids Hook (FID-2026-0720-033c Phase C)
 *
 * React hook that loads the active FIDs from `dev/fids/` and keeps them live
 * via a filesystem watcher. Fully harness-driven: the panel updates as the
 * Recorder creates/archives FID files, with no agent involvement in the
 * display path.
 *
 * FID-2026-1005-002: the archived contribution is a *count* derived from
 * archive directory entries (`countArchivedFids`) instead of a full parse of
 * every archived file — the sidebar uses only `archivedCount`, so refresh
 * work is proportional to displayed information. Callers that need archived
 * metadata keep the full `loadFidInventory` contract in `fid-loader.ts`.
 *
 * Usage:
 *   const { fids, archivedCount, isLoading, refresh } = useFids()
 *   <FidList fids={fids} onSelect={...} />
 *
 * Law 14: `loadFids`/`countArchivedFids` never throw (empty list / 0 on fs
 * errors) and watcher errors are swallowed — so this hook has no error
 * state; the worst case is an empty inventory.
 */

import { join } from 'node:path'

import { useCallback, useEffect, useState } from 'react'

import { countArchivedFids, loadFids } from '../utils/fid-loader'
import { startFidWatcher } from '../utils/fid-watcher'

import type { FidData } from '../components/savant-ui/echo/fid-list'

const DEFAULT_FIDS_DIR = join('dev', 'fids')

export interface UseFidsResult {
  /** Active FIDs in `dev/fids/` (sorted by severity). */
  fids: FidData[]
  /** Archived FIDs in `dev/fids/archive/` (count only — see above). */
  archivedCount: number
  isLoading: boolean
  refresh: () => void
}

/**
 * Load the active FIDs on mount, then keep them (and the archived count)
 * live via fs.watch on `dev/fids/`, `dev/fids/archive/`, and a surviving
 * ancestor (so FID directories created mid-session are picked up).
 *
 * @param fidsDir - Optional override for the FIDs directory (used by tests
 *   to point at a fixture directory). Defaults to `cwd/dev/fids`.
 */
export function useFids(fidsDir?: string): UseFidsResult {
  const resolvedDir = fidsDir ?? join(process.cwd(), DEFAULT_FIDS_DIR)
  const [fids, setFids] = useState<FidData[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(() => {
    setFids(loadFids(resolvedDir))
    setArchivedCount(countArchivedFids(resolvedDir))
    setIsLoading(false)
  }, [resolvedDir])

  useEffect(() => {
    refresh()
    const watcher = startFidWatcher({ fidsDir: resolvedDir, onChange: refresh })
    return () => watcher.close()
  }, [refresh, resolvedDir])

  return { fids, archivedCount, isLoading, refresh }
}
