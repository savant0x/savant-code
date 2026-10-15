import { promises as fs } from 'node:fs'
import path from 'node:path'

export function scratchpadPaths(projectRoot: string) {
  const project = path.resolve(projectRoot)
  return {
    project,
    scratch: path.join(project, 'dev', 'scratchpad'),
    control: path.join(project, '.savant', 'scratchpad-lifecycle'),
  }
}

/** Validate every existing ancestor; junctions are links on Windows too. */
export async function assertPlainPath(
  project: string,
  target: string,
): Promise<void> {
  const relative = path.relative(project, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Scratchpad path escapes project')
  }
  let current = project
  for (const part of ['', ...relative.split(path.sep).filter(Boolean)]) {
    current = part ? path.join(current, part) : current
    try {
      if ((await fs.lstat(current)).isSymbolicLink()) {
        throw new Error('Scratchpad lifecycle refuses linked paths')
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return
    }
  }
}

export function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}
