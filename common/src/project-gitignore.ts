import path from 'path'

import * as ignore from 'ignore'

import { fileExists } from './util/file'

import type { SavantCodeFileSystem } from './types/filesystem'

/**
 * Logs file tree errors in debug mode only.
 * Errors are logged but not thrown to preserve tree-building behavior.
 *
 * File tree operations commonly encounter expected errors (permissions,
 * deleted files) that are not fatal. We only log in debug mode to avoid
 * noisy output during normal operation.
 */
export function logFileTreeError(
  operation: string,
  filePath: string,
  error: Error,
): void {
  // Only log in debug mode to avoid noisy output
  if (!process.env.DEBUG && !process.env.SAVANT_CODE_DEBUG) {
    return
  }

  const code = hasErrnoCode(error) ? error.code : undefined
  const errorMessage = error.message

  // eslint-disable-next-line no-console -- controlled debug logging for file tree operations
  console.debug(
    `[FileTree] ${operation} failed for "${filePath}"${
      code ? ` (${code})` : ''
    }: ${errorMessage}`,
  )
}

function hasErrnoCode(error: Error): error is Error & { code?: string } {
  return 'code' in error
}

function rebaseGitignorePattern(
  rawPattern: string,
  relativeDirPath: string,
): string {
  // Preserve negation and directory-only flags
  const isNegated = rawPattern.startsWith('!')
  let pattern = isNegated ? rawPattern.slice(1) : rawPattern

  const dirOnly = pattern.endsWith('/')
  // Strip the trailing slash for slash-detection only
  const core = dirOnly ? pattern.slice(0, -1) : pattern

  const anchored = core.startsWith('/') // anchored to .gitignore dir
  // Detect if the "meaningful" part (minus optional leading '/' and trailing '/')
  // contains a slash. If not, git treats it as recursive.
  const coreNoLead = anchored ? core.slice(1) : core
  const hasSlash = coreNoLead.includes('/')

  // Build the base (where this .gitignore lives relative to projectRoot)
  const base = relativeDirPath.replace(/\\/g, '/') // normalize

  let rebased: string
  if (anchored) {
    // "/foo" from evals/.gitignore -> "evals/foo"
    rebased = base ? `${base}/${coreNoLead}` : coreNoLead
  } else if (!hasSlash) {
    // "logs" or "logs/" should recurse from evals/: "evals/**/logs[/]"
    if (base) {
      rebased = `${base}/**/${coreNoLead}`
    } else {
      // At project root already; "logs" stays "logs" to keep recursive semantics
      rebased = coreNoLead
    }
  } else {
    // "foo/bar" relative to evals/: "evals/foo/bar"
    rebased = base ? `${base}/${coreNoLead}` : coreNoLead
  }

  if (dirOnly && !rebased.endsWith('/')) {
    rebased += '/'
  }

  // Normalize to forward slashes
  rebased = rebased.replace(/\\/g, '/')

  return isNegated ? `!${rebased}` : rebased
}

export async function parseGitignore(params: {
  fullDirPath: string
  projectRoot: string
  fs: SavantCodeFileSystem
}): Promise<ignore.Ignore> {
  const { fullDirPath, projectRoot, fs } = params

  const ig = ignore.default()
  const relativeDirPath = path.relative(projectRoot, fullDirPath)
  const ignoreFiles = [
    path.join(fullDirPath, '.gitignore'),
    path.join(fullDirPath, '.savantignore'),
    path.join(fullDirPath, '.manicodeignore'), // Legacy support
  ]

  for (const ignoreFilePath of ignoreFiles) {
    const ignoreFileExists = await fileExists({ filePath: ignoreFilePath, fs })
    if (!ignoreFileExists) continue

    let ignoreContent: string
    try {
      ignoreContent = await fs.readFile(ignoreFilePath, 'utf8')
    } catch (error) {
      // Ignore file may be inaccessible or deleted after existence check.
      // Log with context for debugging, but continue without these ignore rules.
      logFileTreeError(
        'fs.readFile (ignore file)',
        ignoreFilePath,
        error instanceof Error ? error : new Error(String(error)),
      )
      continue
    }
    const lines = ignoreContent.split('\n')
    for (let line of lines) {
      line = line.trim()
      if (line === '' || line.startsWith('#')) continue

      const finalPattern = rebaseGitignorePattern(line, relativeDirPath)

      ig.add(finalPattern)
    }
  }

  return ig
}
