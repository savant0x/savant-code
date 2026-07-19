import { resolveAndContain } from '@codebuff/common/util/paths'

import type { CodebuffToolHandlerFunction } from '../handler-function-type'
import type { ProjectFileContext } from '@codebuff/common/util/file'

export const handleApplyPatch = (async ({
  previousToolCallFinished,
  toolCall,
  fileContext,
  requestClientToolCall,
}) => {
  // FID-013 v3 — defense-in-depth at handler top (R2 from v2 verification:
  // apply-patch was a 17-line thin wrapper with NO path safety check).
  // The gate at tool-executor.ts already runs resolveAndContain, but a
  // hostile or buggy caller that bypassed the gate (e.g. via direct tool
  // dispatch) would still be caught here. Catches paths mutated by
  // intermediate code. Per Q12: even thin wrappers deserve defense.
  const filePath = (toolCall.input as { path?: string })?.path ?? ''
  const pathCheck = resolveAndContain(filePath, {
    projectRoot: (fileContext as ProjectFileContext | undefined)?.projectRoot,
  })
  if (pathCheck.kind === 'reject') {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            file: filePath,
            errorMessage: `apply_patch: ${pathCheck.reason}`,
          },
        },
      ],
    }
  }

  await previousToolCallFinished
  const clientToolCall = {
    toolCallId: toolCall.toolCallId,
    toolName: 'apply_patch' as const,
    input: toolCall.input,
  }
  return {
    output: await requestClientToolCall(clientToolCall),
  }
}) satisfies CodebuffToolHandlerFunction<'apply_patch'>
