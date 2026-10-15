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

/**
 * FID-2026-1012-017 Loop 6 — the identity of one native-failure report within a
 * single stream: the tool plus the class. Two DIFFERENT tools failing, or one
 * tool failing in two classes (an unavailable name and a bad payload), are two
 * failures and stay two reports; a repeated part of the same call-out is not.
 */
export function nativeFailureKey(chunk: StreamErrorChunk): string | undefined {
  if (!('errorClass' in chunk)) return undefined
  return `${chunk.toolName ?? ''}|${chunk.errorClass}`
}

/**
 * One report per (tool, class) per stream.
 *
 * Measured 2026-10-13T05:08Z: one response emitted 20 invalid tool-call parts
 * (17 of them the same `suggest_followups` call) in 5.7 seconds, and every part
 * pushed its own `TOOL_CALL_ERROR` message into the step's history — the model
 * was told the same thing 17 times, and 17 identical paragraphs of context were
 * spent doing it. The parts are chunks of ONE call-out, so the steering is
 * stated once.
 *
 * Capture is deliberately NOT deduped by this helper: every part still reaches
 * the fail-open sink through `captureNativeFailure`, because the ledger's job is
 * fidelity and shrinking its volume is a capture-policy decision that belongs to
 * the capture lane, not to the emit path.
 */
export function createNativeFailureDeduper(): (
  chunk: StreamErrorChunk,
) => boolean {
  const seen = new Set<string>()
  return (chunk) => {
    const key = nativeFailureKey(chunk)
    if (key === undefined) return false
    if (seen.has(key)) return true
    seen.add(key)
    return false
  }
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
