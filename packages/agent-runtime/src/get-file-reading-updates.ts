import { uniq } from 'lodash'

import type { RequestFilesFn } from '@savant-code/common/types/contracts/client'

export async function getFileReadingUpdates(params: {
  requestFiles: RequestFilesFn
  requestedFiles: string[]
  /**
   * LF-001 (FID-2026-1012-007): 1-indexed line window, forwarded verbatim to
   * the fetch boundary so the responder selects the lines while the content
   * is still complete. Omitted → whole file.
   */
  offset?: number
  limit?: number
}): Promise<
  {
    path: string
    content: string
  }[]
> {
  const { requestFiles, requestedFiles, offset, limit } = params

  const allFilePaths = uniq(requestedFiles)
  const loadedFiles = await requestFiles({
    filePaths: allFilePaths,
    offset,
    limit,
  })

  const addedFiles = Object.entries(loadedFiles)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([path, content]) => ({
      path,
      content,
    }))

  return addedFiles
}
