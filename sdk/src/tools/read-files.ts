import { READ_FILES_MAX_CHARS } from '@savant-code/common/constants/read-files'
import { FILE_READ_STATUS } from '@savant-code/common/old-constants'
import { isFileIgnored } from '@savant-code/common/project-file-tree'
import { extractLineWindow } from '@savant-code/common/util/read-window'

import { resolveFilePath } from './path-utils'

import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

// FID-2026-0907-002: the truncation threshold is canonical in `common` so
// the edit tool's size guidance can never silently diverge from the read
// tool's truncation point. Re-exported for SDK consumers.
export { READ_FILES_MAX_CHARS }

export type FileFilterResult = {
  status: 'blocked' | 'allow-example' | 'allow'
}

export type FileFilter = (filePath: string) => FileFilterResult

export async function getFiles(params: {
  filePaths: string[]
  cwd: string
  fs: SavantCodeFileSystem
  /**
   * Filter to classify files before reading.
   * If provided, the caller takes full control of filtering (no gitignore check).
   * If not provided, the SDK applies gitignore checking automatically.
   */
  fileFilter?: FileFilter
  /**
   * LF-001 (FID-2026-1012-007): 1-indexed line window, selected at THIS
   * boundary so it is applied to the complete file rather than to the
   * already-truncated prefix. Omitted → whole file (previous behavior).
   */
  offset?: number
  limit?: number
}) {
  const { filePaths, cwd, fs, fileFilter, offset, limit } = params
  // A requested window is served from the complete content; the response is
  // still capped afterwards, so a page of a huge file stays bounded.
  const windowRequested = offset !== undefined || limit !== undefined
  // If caller provides a filter, they own all filtering decisions
  // If not, SDK applies default gitignore checking
  const hasCustomFilter = fileFilter !== undefined

  const result: Record<string, string | null> = {}
  const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB - skip reading entirely
  const MAX_CHARS = READ_FILES_MAX_CHARS // canonical constant (common)
  const numFmt = new Intl.NumberFormat('en-US')
  const fmtNum = (n: number) => numFmt.format(n)

  for (const filePath of filePaths) {
    if (!filePath) {
      continue
    }

    const { relativePath, fullPath, isWithinProject } = resolveFilePath(
      cwd,
      filePath,
    )

    // Apply file filter if provided
    const filterResult = fileFilter?.(relativePath)
    if (filterResult?.status === 'blocked') {
      result[relativePath] = FILE_READ_STATUS.IGNORED
      continue
    }
    const isExampleFile = filterResult?.status === 'allow-example'

    // If no custom filter provided, apply default gitignore checking.
    // Gitignore is project-scoped, so it only applies to files inside the
    // project (allow-example files skip it to bypass .env.* patterns).
    if (!hasCustomFilter && !isExampleFile && isWithinProject) {
      const ignored = await isFileIgnored({
        filePath: relativePath,
        projectRoot: cwd,
        fs,
      })
      if (ignored) {
        result[relativePath] = FILE_READ_STATUS.IGNORED
        continue
      }
    }

    try {
      // Safety check: skip reading files over 10MB to avoid OOM
      const stats = await fs.stat(fullPath)
      if (stats.size > MAX_FILE_BYTES) {
        result[relativePath] =
          FILE_READ_STATUS.TOO_LARGE +
          ` [${(stats.size / (1024 * 1024)).toFixed(1)}MB exceeds 10MB limit. Use code_search or glob to find specific content.]`
        continue
      }

      const content = await fs.readFile(fullPath, 'utf8')
      const selected = windowRequested
        ? extractLineWindow(content, offset, limit)
        : content

      if (selected.length > MAX_CHARS) {
        const truncated = selected.slice(0, MAX_CHARS)
        result[relativePath] =
          truncated +
          '\n\n[FILE_TOO_LARGE: This file is ' +
          fmtNum(selected.length) +
          ' chars, exceeding the ' +
          fmtNum(MAX_CHARS) +
          ' char limit. The content above has been truncated. Use other tools to read other sections of the file.]'
      } else {
        // Prepend TEMPLATE marker for example files
        result[relativePath] = isExampleFile
          ? FILE_READ_STATUS.TEMPLATE + '\n' + selected
          : selected
      }
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        result[relativePath] = FILE_READ_STATUS.DOES_NOT_EXIST
      } else {
        result[relativePath] = FILE_READ_STATUS.ERROR
      }
    }
  }
  return result
}
