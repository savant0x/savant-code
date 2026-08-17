import { partitionEmbeddedGroundingReads } from '@savant-code/common/util/embedded-protocol'
import { jsonToolResult } from '@savant-code/common/util/messages'

import { getFileReadingUpdates } from '../../../get-file-reading-updates'
import { renderReadFilesResult } from '../../../util/render-read-files-result'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

type ToolName = 'read_files'

/**
 * FID-2026-0817-002 B2: slice file content to a 1-indexed line window.
 * `offset` defaults to line 1; `limit` defaults to the end of the file.
 * Reading past EOF yields an empty string (no fabricated lines).
 */
export function sliceLines(
  content: string,
  offset: number | undefined,
  limit: number | undefined,
): string {
  if (offset === undefined && limit === undefined) return content
  const lines = content.split('\n')
  const start = (offset ?? 1) - 1
  const end = limit === undefined ? lines.length : start + limit
  return lines.slice(start, end).join('\n')
}

export const handleReadFiles = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<ToolName>

    agentState: AgentState
    fileContext: ProjectFileContext
  } & ParamsExcluding<typeof getFileReadingUpdates, 'requestedFiles'>,
): Promise<{ output: SavantCodeToolOutput<ToolName> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState,
    fileContext,
  } = params
  const { paths, offset, limit } = toolCall.input

  await previousToolCallFinished

  // FID-2026-0810-002 Change 2: synthetic read — when the boot contract
  // resolved from the embedded bundle (npm install, no local protocol files),
  // grounding-set paths are served from the bundle through the SAME read
  // path; everything else reads from the filesystem as usual. Local mode
  // never consults the bundle (project files win).
  const { embedded, remaining } = partitionEmbeddedGroundingReads({
    protocolSource: agentState.protocolSource,
    requestedFiles: paths,
  })

  let addedFiles: { path: string; content: string }[] = embedded
  if (remaining.length > 0) {
    const fromFs = await getFileReadingUpdates({
      ...params,
      requestedFiles: remaining,
    })
    addedFiles = [...embedded, ...fromFs]
  }

  if (offset !== undefined || limit !== undefined) {
    addedFiles = addedFiles.map((file) => ({
      ...file,
      content: sliceLines(file.content, offset, limit),
    }))
  }

  return {
    output: jsonToolResult(
      renderReadFilesResult(addedFiles, fileContext.tokenCallers ?? {}),
    ),
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
