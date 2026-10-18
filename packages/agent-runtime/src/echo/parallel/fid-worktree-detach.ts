import { existsSync, lstatSync, readdirSync, unlinkSync } from 'node:fs'
import path from 'node:path'

/** Never hand Git a tree containing junctions: Windows Git follows targets. */
export function detachWorktreeLinks(root: string): boolean {
  if (!existsSync(root)) return true
  try {
    const pending = [root]
    while (pending.length > 0) {
      const target = pending.pop()
      if (target === undefined) break
      const stat = lstatSync(target)
      if (stat.isSymbolicLink()) {
        // unlink removes the junction itself; recursive deletion can follow it.
        unlinkSync(target)
      } else if (stat.isDirectory()) {
        for (const name of readdirSync(target))
          pending.push(path.join(target, name))
      }
    }
    return true
  } catch {
    // The caller retains the lane and record and reports the refused teardown.
    return false
  }
}
