import path from 'path'

export type ResolvedProjectPath = {
  fullPath: string
  relativePath: string
}

export type ResolvedFilePath = ResolvedProjectPath & {
  /** Whether the resolved path lives inside `projectRoot`. */
  isWithinProject: boolean
}

/**
 * FID-2026-0718-015: Normalize a path to POSIX-style for cross-platform
 * consistency. Strips Windows drive-letter prefix (`C:`) and converts
 * backslashes to forward slashes. On POSIX systems this is effectively a
 * no-op for paths that don't contain backslashes.
 *
 * Rationale: SDK tool tests use POSIX-style keys (e.g., `/repo/src/file.ts`)
 * for the mock fs. The mock fs is keyed by literal strings. Without
 * normalization, `path.resolve('/repo', 'src/file.ts')` on Windows returns
 * `C:\repo\src\file.ts` (backslash + drive), which doesn't match the test
 * keys. Normalizing to POSIX here makes the SDK's output match the test
 * fixture format on both platforms.
 *
 * Production impact: Node.js `fs.writeFile` accepts POSIX paths on Windows
 * (interprets them as root-relative to current drive). Production Linux
 * behavior unchanged (POSIX paths are already the native format).
 */
function toPosix(p: string): string {
  return p.replace(/^[A-Z]:/i, '').replace(/\\/g, '/')
}

function escapesProject(relativePath: string): boolean {
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  )
}

export function resolveFilePathWithinProject(
  projectRoot: string,
  filePath: string,
): ResolvedProjectPath | null {
  const resolvedRoot = path.resolve(projectRoot)
  const fullPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(resolvedRoot, filePath)
  const relativePath = path.relative(resolvedRoot, fullPath)

  if (relativePath === '' || escapesProject(relativePath)) {
    return null
  }

  return {
    fullPath: toPosix(fullPath),
    relativePath: toPosix(relativePath),
  }
}

/**
 * Resolves a file path against the project root without restricting it to the
 * project directory. Absolute paths are honored as-is and relative paths are
 * resolved against the project root, so callers can operate on any file on the
 * system. `relativePath` is a friendly display value: the project-relative path
 * when the target is inside the project, otherwise the absolute path.
 * `isWithinProject` lets callers skip project-scoped logic (e.g. gitignore) for
 * files that live outside the project.
 *
 * FID-2026-0718-015: Return values are POSIX-normalized (no drive letter,
 * forward-slash). See `toPosix` for rationale.
 */
export function resolveFilePath(
  projectRoot: string,
  filePath: string,
): ResolvedFilePath {
  const resolvedRoot = path.resolve(projectRoot)
  const fullPath = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(resolvedRoot, filePath)
  const relativePath = path.relative(resolvedRoot, fullPath)
  const isWithinProject = relativePath !== '' && !escapesProject(relativePath)
  const displayPath = isWithinProject ? relativePath : fullPath

  return {
    fullPath: toPosix(fullPath),
    relativePath: toPosix(displayPath),
    isWithinProject,
  }
}

export function getProjectPathLookupKeys(
  projectRoot: string,
  filePath: string,
): string[] {
  const resolvedPath = resolveFilePathWithinProject(projectRoot, filePath)
  const keys = resolvedPath ? [resolvedPath.relativePath, filePath] : [filePath]

  return [...new Set(keys)]
}
