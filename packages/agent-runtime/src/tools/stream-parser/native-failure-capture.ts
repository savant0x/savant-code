import { buildHookInput, getHookEngine } from '../../hooks/engine'

import type { StreamErrorChunk } from '@savant-code/common/types/contracts/llm'

/** The same classified chunk supplies steering and capture; raw arguments stay absent. */
export function buildNativeFailureInput(
  chunk: StreamErrorChunk,
  sessionId: string,
  cwd: string,
) {
  if (!('errorClass' in chunk)) return undefined
  return buildHookInput({
    event: 'PostToolUseFailure',
    sessionId,
    cwd,
    toolName: chunk.toolName,
    errorMessage: chunk.message,
    errorClass: chunk.errorClass,
    ...('argumentsTruncated' in chunk
      ? { argumentsTruncated: chunk.argumentsTruncated }
      : {}),
    ...('finishReason' in chunk ? { finishReason: chunk.finishReason } : {}),
  })
}

export function captureNativeFailure(
  chunk: StreamErrorChunk | undefined,
  sessionId: string,
  cwd: string | undefined,
): void {
  if (!chunk || !cwd) return
  const input = buildNativeFailureInput(chunk, sessionId, cwd)
  if (input) getHookEngine(cwd).fireAndForgetTrigger(input)
}
