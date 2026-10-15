import { assistantMessage } from '@savant-code/common/util/messages'

import { INCLUDE_REASONING_IN_MESSAGE_HISTORY } from '../../constants'
import { isAgentGrounded } from '../../echo/grounding'
import { createYagniCheckStreamStripper } from '../../util/think-tags'

import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { PrintModeEvent } from '@savant-code/common/types/print-mode'
import type { AgentState } from '@savant-code/common/types/session-state'

/**
 * Grounding-gated output stager (FID-2026-0819-005 Loop 299: extracted
 * verbatim from `tools/stream-parser.ts`).
 *
 * Owns the RAW response accumulator (`fullResponseSoFar`), the chunk list
 * kept for the final return, the <yagni_check> stream stripper, and the
 * staged output buffer held while the grounding gate can still block.
 */
export function createGroundingStager(params: {
  agentState: AgentState
  fullResponse: string
  assistantMessages: Message[]
  onResponseChunk: (chunk: string | PrintModeEvent) => void
  ancestorRunIds: string[]
  runId: string
}) {
  const {
    agentState,
    fullResponse,
    assistantMessages,
    onResponseChunk,
    ancestorRunIds,
    runId,
  } = params

  const fullResponseChunks: string[] = [fullResponse]
  // FID-2026-0802-005 H1: incremental accumulator — the previous
  // `fullResponseChunks.join('')` on every tool call was O(k·L) copying for
  // tool-dense responses. The chunks array is kept only for the final return.
  let fullResponseSoFar = fullResponse
  // FID-2026-0822-004: the Forge emits a <yagni_check> JSON block at the top
  // of its response. This streaming stripper removes the block (and truncated
  // fragments) from what persists/renders — assistantMessages and
  // onResponseChunk — while `fullResponseSoFar` below keeps the RAW text so
  // the enforcement gate's assistant-text channel can still parse the block
  // (gate read is non-destructive; strip is emit-time only).
  const yagniStripper = createYagniCheckStreamStripper()
  // FID-2026-0812-005: stage all main-agent assistant output until the
  // grounding checkpoint is complete. The completion gate runs after stream
  // consumption, so forwarding text or reasoning immediately would let an
  // ungrounded first response flash in the host UI. Staged output is flushed
  // only after successful grounding reads settle; otherwise it is discarded.
  const pendingGroundingOutput: Array<{
    kind: 'text' | 'reasoning'
    text: string
  }> = []

  // Match the enforcement factory's arming predicate rather than the optional
  // protocolVariant field. Legacy/SDK states may have a protocol file without
  // a variant; those sessions are still gated and must stage output.
  const groundingGateArmed =
    !agentState.parentId && Boolean(agentState.protocolFile)
  // FID-2026-0822-003 (stager contract): the completion gate's blocking is
  // BOUNDED — after COMPLETION_GATE_MAX_RETRIES blocked turn-ends it
  // surrenders and "proceed without the boot reads" becomes the ratified
  // outcome (FID-2026-0810-002 disarm notice: "proceeding without the boot
  // reads"). The stager must honor that same boundary: once the retry
  // budget is spent or the gate is disarmed, further discards would turn a
  // bounded escape hatch into a permanent output shredder (the exact
  // failure that emitted "No response from agent" for fully-answered
  // headless runs). Staging stays active only while the gate can still
  // legitimately block.
  const COMPLETION_GATE_MAX_RETRIES = 3
  const isCompletionGateSpent = (): boolean => {
    const checkpoint = agentState.groundingCheckpoint
    if (!checkpoint) return false
    if (checkpoint.completionGateDisarmed) return true
    return checkpoint.completionGateRetries >= COMPLETION_GATE_MAX_RETRIES
  }
  const shouldStageOutput = (): boolean =>
    groundingGateArmed &&
    !isAgentGrounded(agentState) &&
    !isCompletionGateSpent()

  const emitCommittedText = (text: string): void => {
    if (!text) return
    // fullResponseSoFar keeps the RAW text (FID-2026-0822-004): the YAGNI
    // gate's assistant-text channel reads it at beforeToolCall time and must
    // see the <yagni_check> block the model emitted. Only the user-visible
    // channel below (assistantMessages + onResponseChunk) is stripped — the
    // block never reaches the transcript or the relayed message history.
    fullResponseSoFar += text
    if (fullResponseChunks[0] === fullResponse) {
      fullResponseChunks[0] = fullResponse + text
    } else {
      fullResponseChunks.push(text)
    }
    // FID-2026-0822-004: strip <yagni_check> scaffolding from the
    // user-visible + persisted channels. A block may span chunks, so the
    // stateful stripper holds text from an unclosed opener until its closer
    // arrives (or the stream ends via flush).
    const cleaned = yagniStripper.push(text)
    if (cleaned.length === 0) return
    assistantMessages.push(assistantMessage(cleaned))
    onResponseChunk(cleaned)
  }
  const emitCommittedReasoning = (text: string): void => {
    if (!text) return
    if (INCLUDE_REASONING_IN_MESSAGE_HISTORY) {
      const last = assistantMessages[assistantMessages.length - 1]
      const lastPart =
        last?.role === 'assistant' && Array.isArray(last.content)
          ? last.content[last.content.length - 1]
          : undefined
      if (lastPart?.type === 'reasoning') {
        lastPart.text += text
      } else {
        assistantMessages.push(assistantMessage({ type: 'reasoning', text }))
      }
    }
    onResponseChunk({
      type: 'reasoning_delta',
      text,
      ancestorRunIds,
      runId,
      agentId: agentState.agentId,
    })
  }
  const emitGroundedText = (text: string): void => {
    if (!text) return
    if (shouldStageOutput()) {
      pendingGroundingOutput.push({ kind: 'text', text })
      return
    }
    emitCommittedText(text)
  }
  const emitGroundedReasoning = (text: string): void => {
    if (!text) return
    if (shouldStageOutput()) {
      pendingGroundingOutput.push({ kind: 'reasoning', text })
      return
    }
    emitCommittedReasoning(text)
  }
  const flushGroundingOutput = (): void => {
    if (shouldStageOutput()) {
      pendingGroundingOutput.length = 0
      return
    }
    // FID-2026-0822-003 (stager contract): a spent gate means output commits —
    // bounded blocking must never degrade into a permanent discard.
    const staged = pendingGroundingOutput.splice(0)
    for (const output of staged) {
      if (output.kind === 'text') emitCommittedText(output.text)
      else emitCommittedReasoning(output.text)
    }
  }

  return {
    fullResponseChunks,
    get fullResponseSoFar() {
      return fullResponseSoFar
    },
    yagniStripper,
    emitGroundedText,
    emitGroundedReasoning,
    flushGroundingOutput,
  }
}

export type GroundingStager = ReturnType<typeof createGroundingStager>

/** Narrow shape the tool-execution factory reads from the stager. */
export type GroundingStagerView = {
  get fullResponseSoFar(): string
}
