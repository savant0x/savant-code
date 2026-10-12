import { partitionEmbeddedGroundingReads } from '@savant-code/common/util/embedded-protocol'
import { jsonToolResult } from '@savant-code/common/util/messages'
import { extractLineWindow } from '@savant-code/common/util/read-window'

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
 * FID-2026-0817-002 B2, shared since LF-001 (FID-2026-1012-007): the
 * 1-indexed line window. One implementation now serves this handler's
 * embedded-bundle reads and the SDK's fetch boundary, so the two ends can
 * never slice differently. `offset` defaults to line 1; `limit` defaults to
 * the end of the file; reading past EOF yields an empty string (no
 * fabricated lines); a window that ends before EOF keeps its separator so
 * consecutive pages concatenate back to the original file.
 */
export const sliceLines = extractLineWindow

export const handleReadFiles = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<ToolName>

    agentState: AgentState
    fileContext: ProjectFileContext
  } & ParamsExcluding<
    typeof getFileReadingUpdates,
    // LF-001 (FID-2026-1012-007): the window is a property of THIS call's
    // input, not of the run's params — the request path carries it explicitly.
    'requestedFiles' | 'offset' | 'limit'
  >,
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

  // LF-001 (FID-2026-1012-007): the window is applied where the content is
  // still complete. Filesystem reads carry it into the request (the fetch
  // boundary slices before it caps at READ_FILES_MAX_CHARS, which is the only
  // place a window past that cap can still be served), and a responder owns
  // what it returns — re-slicing a windowed response here would silently
  // drop lines. Embedded grounding reads never cross that boundary, so they
  // are windowed here with the same shared function.
  const windowRequested = offset !== undefined || limit !== undefined
  const embeddedFiles = windowRequested
    ? embedded.map((file) => ({
        ...file,
        content: sliceLines(file.content, offset, limit),
      }))
    : embedded

  let addedFiles: { path: string; content: string }[] = embeddedFiles
  if (remaining.length > 0) {
    const fromFs = await getFileReadingUpdates({
      ...params,
      requestedFiles: remaining,
      offset,
      limit,
    })
    addedFiles = [...embeddedFiles, ...fromFs]
  }

  return {
    output: jsonToolResult(
      renderReadFilesResult(addedFiles, fileContext.tokenCallers ?? {}),
    ),
  }
}) satisfies SavantCodeToolHandlerFunction<ToolName>
