import { resolveAndContain } from '@savant-code/common/util/paths'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export const handleApplyPatch = (async ({
  previousToolCallFinished,
  toolCall,
  fileContext,
  requestClientToolCall,
}) => {
  // Validate the canonical tool shape before doing path safety. The schema
  // expects { operation: { type, path, diff } }, but agents sometimes pass
  // { path, diff } at the top level. Give them a clear, actionable error so
  // they do not waste credits guessing.
  const input = toolCall.input as {
    operation?: { type?: string; path?: string }
  }
  if (!input || typeof input !== 'object' || !input.operation) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            errorMessage:
              'apply_patch requires an `operation` object. Expected shape: { operation: { type: "create_file" | "update_file" | "delete_file", path: "...", diff: "..." } }',
          },
        },
      ],
    }
  }

  const validTypes = ['create_file', 'update_file', 'delete_file']
  if (
    typeof input.operation.type !== 'string' ||
    !validTypes.includes(input.operation.type)
  ) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            errorMessage: `apply_patch operation.type must be one of ${validTypes.join(', ')}. Received: ${String(input.operation.type)}`,
          },
        },
      ],
    }
  }

  if (
    typeof input.operation.path !== 'string' ||
    input.operation.path.length === 0
  ) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            errorMessage:
              'apply_patch operation.path must be a non-empty string. Example: { operation: { type: "update_file", path: "src/index.ts", diff: "@@\\n- old\\n+ new\\n" } }',
          },
        },
      ],
    }
  }

  const filePath = input.operation.path

  if (
    (input.operation.type === 'create_file' ||
      input.operation.type === 'update_file') &&
    (typeof (input.operation as { diff?: unknown }).diff !== 'string' ||
      (input.operation as { diff?: string }).diff?.length === 0)
  ) {
    return {
      output: [
        {
          type: 'json' as const,
          value: {
            errorMessage:
              'apply_patch create_file/update_file operations require a non-empty `diff` string. Example: { operation: { type: "update_file", path: "src/index.ts", diff: "@@\\n- old\\n+ new\\n" } }',
          },
        },
      ],
    }
  }

  // FID-013 v3 — defense-in-depth at handler top (R2 from v2 verification:
  // apply-patch was a 17-line thin wrapper with NO path safety check).
  // The gate at tool-executor.ts already runs resolveAndContain, but a
  // hostile or buggy caller that bypassed the gate (e.g. via direct tool
  // dispatch) would still be caught here. Catches paths mutated by
  // intermediate code. Per Q12: even thin wrappers deserve defense.
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
}) satisfies SavantCodeToolHandlerFunction<'apply_patch'>
