// FID-2026-0819-005 Loop 231: fs/spawn source resolution, extracted verbatim
// from execution.ts (over the 300-line ceiling). Behavior contract unchanged.

import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { Source } from '@savant-code/common/types/source'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

/** Resolves fs/spawn from their optional sources, mirroring runOnce's
 * defaults (fsSource falls back to node:fs promises, spawn to child_process). */
export async function resolveFsAndSpawn(options: {
  fsSource?: Source<SavantCodeFileSystem>
  spawnSource?: Source<SavantCodeSpawn>
}): Promise<{ fs: SavantCodeFileSystem; spawn: SavantCodeSpawn }> {
  const fsSource = options.fsSource ?? (() => require('fs').promises)
  const fsSourceValue = typeof fsSource === 'function' ? fsSource() : fsSource
  const fs = await fsSourceValue
  let spawn: SavantCodeSpawn
  if (options.spawnSource) {
    const spawnSourceValue = await options.spawnSource
    spawn = spawnSourceValue as SavantCodeSpawn
  } else {
    spawn = require('child_process').spawn as SavantCodeSpawn
  }
  return { fs, spawn }
}
