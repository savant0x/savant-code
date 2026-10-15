import { requireCwd } from './require-cwd'
import { getFiles } from '../tools/read-files'

import type { SavantCodeClientOptions } from './types'
import type { FileFilter } from '../tools/read-files'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

/**
 * `read_files` for the SDK dispatch path. Extracted from `tool-call.ts` so the
 * dispatcher stays inside the 300-line quality ceiling (the same extraction
 * pattern as `stream-error-chunk.ts`); `tool-call.ts` re-exports it, so existing
 * importers keep working unchanged.
 */
export async function readFiles({
  filePaths,
  offset,
  limit,
  override,
  fileFilter,
  cwd,
  fs,
}: {
  filePaths: string[]
  /** LF-001 (FID-2026-1012-007): the requested 1-indexed line window. */
  offset?: number
  limit?: number
  override?: NonNullable<
    Required<SavantCodeClientOptions>['overrideTools']['read_files']
  >
  fileFilter?: FileFilter
  cwd?: string
  fs: SavantCodeFileSystem
}) {
  if (override) {
    // An override replaces this tool wholesale: it receives the window in its
    // input and owns the result. The production path (no override) windows at
    // the fetch boundary in getFiles.
    return await override({ filePaths, offset, limit })
  }
  return getFiles({
    filePaths,
    offset,
    limit,
    cwd: requireCwd(cwd, 'read_files'),
    fs,
    fileFilter,
  })
}
