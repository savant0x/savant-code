import fs from 'node:fs'
import path from 'node:path'

import { getProjectRoot } from '../project-files'

export const DESIGN_SYSTEM_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function projectRootOrCwd(): string {
  try {
    return getProjectRoot()
  } catch {
    return process.cwd()
  }
}

export function customRoot(scope: 'project' | 'user'): string {
  if (scope === 'project') {
    return path.join(projectRootOrCwd(), '.savant', 'design-systems')
  }
  const home = process.env.HOME ?? process.env.USERPROFILE
  if (!home) throw new Error('Cannot resolve the user design-system directory.')
  return path.join(home, '.savant', 'design-systems')
}

export function canonicalExistingPath(filePath: string): string {
  const resolved = path.resolve(filePath)
  try {
    return fs.realpathSync.native(resolved)
  } catch {
    return resolved
  }
}

export function canonicalContainedPath(
  root: string,
  candidate: string,
): string {
  const canonicalRoot = canonicalExistingPath(root)
  const canonicalCandidate = canonicalExistingPath(candidate)
  const relative = path.relative(canonicalRoot, canonicalCandidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(
      `Design-system source escapes its approved root: ${candidate}`,
    )
  }
  return canonicalCandidate
}

export function ensureRegularFile(filePath: string): void {
  const stat = fs.lstatSync(filePath)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Design-system source must be a regular file: ${filePath}`)
  }
}
