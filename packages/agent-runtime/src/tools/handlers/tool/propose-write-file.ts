import { toolArgumentBudget } from '@savant-code/common/util/tool-argument-budget'
import { createPatch } from 'diff'

import {
  assembleStagedWrite,
  contentRevision,
  stageBoundedWrite,
} from './chunked-write'
import {
  getProposedContent,
  setProposedContent,
} from './proposed-content-store'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { RequestOptionalFileFn } from '@savant-code/common/types/contracts/client'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'

/**
 * Proposes writing a file without actually applying the changes.
 * Simply overwrites the file exactly with the given content (creating if it doesn't exist).
 * Returns a unified diff of the changes for review.
 */
export const handleProposeWriteFile = (async (
  params: {
    previousToolCallFinished: Promise<void>
    toolCall: SavantCodeToolCall<'propose_write_file'>

    logger: Logger
    runId: string

    requestOptionalFile: RequestOptionalFileFn
  } & ParamsExcluding<RequestOptionalFileFn, 'filePath'>,
): Promise<{ output: SavantCodeToolOutput<'propose_write_file'> }> => {
  const {
    previousToolCallFinished,
    toolCall,
    logger: _logger,
    runId,
    requestOptionalFile,
  } = params
  const { path, content } = toolCall.input

  // Get content from proposed state first (by runId), then fall back to disk
  const getProposedOrDiskContent = async (): Promise<string | null> => {
    const proposedContent = getProposedContent(runId, path)
    if (proposedContent !== undefined) {
      return proposedContent
    }
    return requestOptionalFile({ ...params, filePath: path })
  }

  const initialContent = await getProposedOrDiskContent()

  // Normalize content (remove leading newline if present)
  const newContent = content.startsWith('\n') ? content.slice(1) : content

  // FID-2026-1012-017: a bulk write is staged as bounded chunks under a revision
  // guard (the chunk size is the tool's own argument budget and the refusal
  // point is the shared argument ceiling) so an oversized payload is refused up
  // front and a write authored against content that has since changed is not
  // applied over it. Nothing is exposed until the staging reassembles to the
  // exact staged revision.
  const staged = stageBoundedWrite({
    runId,
    path,
    content: newContent,
    baseRevision: contentRevision(initialContent ?? ''),
    maxChunkChars: toolArgumentBudget({ toolName: 'propose_write_file' })
      .maxArgumentChars,
  })
  if (!staged.ok) {
    return {
      output: [
        {
          type: 'json',
          value: { file: path, errorMessage: staged.errorMessage },
        },
      ],
    }
  }
  const assembled = assembleStagedWrite({
    runId,
    path,
    currentContent: initialContent ?? '',
  })
  if (!assembled.ok) {
    return {
      output: [
        {
          type: 'json',
          value: { file: path, errorMessage: assembled.errorMessage },
        },
      ],
    }
  }

  // Store the proposed content for future propose calls on the same file (by runId)
  setProposedContent(runId, path, Promise.resolve(assembled.content))

  await previousToolCallFinished

  // Generate unified diff
  const oldContent = initialContent ?? ''
  let patch = createPatch(path, oldContent, assembled.content)

  // Strip the header lines, keep only from @@ onwards
  const lines = patch.split('\n')
  const hunkStartIndex = lines.findIndex((line) => line.startsWith('@@'))
  if (hunkStartIndex !== -1) {
    patch = lines.slice(hunkStartIndex).join('\n')
  }

  const isNewFile = initialContent === null
  const message = isNewFile
    ? `Proposed new file ${path}`
    : `Proposed changes to ${path}`

  return {
    output: [
      {
        type: 'json',
        value: {
          file: path,
          message,
          unifiedDiff: patch,
        },
      },
    ],
  }
}) as SavantCodeToolHandlerFunction<'propose_write_file'>
