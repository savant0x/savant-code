import { promises as nativeFs } from 'node:fs'

import {
  acquireScratchpadLease,
  manageScratchpad,
} from '@savant-code/common/util/scratchpad'

import type { RunExecutionOptions } from '../types'

/** Resolve the supplied fs once; virtual hosts never mutate native disk. */
export async function withRunScratchpad<T>(
  options: RunExecutionOptions,
  operation: (options: RunExecutionOptions) => Promise<T>,
): Promise<T> {
  const source = options.fsSource ?? nativeFs
  const fs = await (typeof source === 'function' ? source() : source)
  const resolved = { ...options, fsSource: fs }
  if (fs !== nativeFs || !options.cwd) return operation(resolved)

  const cwd = options.cwd
  const before = await manageScratchpad(cwd, { clean: true })
  if (before.warning) options.logger?.warn(before.warning)
  let release: (() => Promise<void>) | undefined
  try {
    release = await acquireScratchpadLease(cwd)
  } catch (error) {
    options.logger?.warn(
      'Scratchpad live-run protection unavailable',
      String(error),
    )
  }
  try {
    return await operation(resolved)
  } finally {
    if (release) {
      try {
        await release()
        const after = await manageScratchpad(cwd, { clean: true })
        if (after.warning) options.logger?.warn(after.warning)
      } catch (error) {
        options.logger?.warn('Scratchpad housekeeping failed', String(error))
      }
    }
  }
}
