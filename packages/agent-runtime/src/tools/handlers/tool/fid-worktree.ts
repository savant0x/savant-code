import { jsonToolResult } from '@savant-code/common/util/messages'

import { runFidWorktreeAction } from '../../../echo/parallel/fid-worktree-service'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { SavantCodeToolCall } from '@savant-code/common/tools/list'

export const handleFidWorktree = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'fid_worktree'>
  fileContext: { projectRoot: string }
  agentTemplate: { id: string; analyzeOnly?: boolean }
}) => {
  await params.previousToolCallFinished
  const allowed =
    /^savant(?:-(?:lite|max|fast|strict|scaffold))?$/.test(
      params.agentTemplate.id,
    ) && !params.agentTemplate.analyzeOnly
  return {
    output: jsonToolResult(
      allowed
        ? await runFidWorktreeAction(
            params.fileContext.projectRoot,
            params.toolCall.input,
          )
        : {
            ok: false,
            reason: 'forbidden-role',
            detail: 'fid_worktree is Orchestrator-only',
          },
    ),
    creditsUsed: 0,
  }
}) satisfies SavantCodeToolHandlerFunction<'fid_worktree'>
