import type { SavantCodeClientOptions } from './types'
import type { ServerAction } from '@savant-code/common/actions'

/**
 * Builds the stream-chunk dispatch handlers for a run. Both handlers forward
 * chunks to the host's handleStreamChunk / handleEvent callbacks, expanding
 * reasoning deltas and subagent chunks into their host-facing shapes.
 */
export function createStreamChunkHandlers(params: {
  signal?: AbortSignal
  handleEvent?: SavantCodeClientOptions['handleEvent']
  handleStreamChunk?: SavantCodeClientOptions['handleStreamChunk']
  safeDispatch: (fn: () => void | Promise<void>) => Promise<void>
}): {
  onResponseChunk: (action: ServerAction<'response-chunk'>) => Promise<void>
  onSubagentResponseChunk: (
    action: ServerAction<'subagent-response-chunk'>,
  ) => Promise<void>
} {
  const { signal, handleEvent, handleStreamChunk, safeDispatch } = params

  const onResponseChunk = async (
    action: ServerAction<'response-chunk'>,
  ): Promise<void> => {
    if (signal?.aborted) {
      return
    }
    const { chunk } = action

    if (typeof chunk !== 'string') {
      if (chunk.type === 'reasoning_delta') {
        await safeDispatch(() =>
          handleStreamChunk?.({
            type: 'reasoning_chunk',
            chunk: chunk.text,
            // The agent's stable id (matches subagent_start/subagent_chunk), so
            // subagent reasoning attributes to the right agent. (Previously this
            // forwarded runId, which no consumer's agent map is keyed by.)
            agentId: chunk.agentId,
            ancestorRunIds: chunk.ancestorRunIds,
          }),
        )
      } else {
        await safeDispatch(() => handleEvent?.(chunk))
      }
      return
    }

    if (handleStreamChunk) {
      await safeDispatch(() => handleStreamChunk(chunk))
    }
  }
  const onSubagentResponseChunk = async (
    action: ServerAction<'subagent-response-chunk'>,
  ) => {
    if (signal?.aborted) {
      return
    }
    const { agentId, agentType, chunk } = action

    if (handleStreamChunk && chunk) {
      await safeDispatch(() =>
        handleStreamChunk({
          type: 'subagent_chunk',
          agentId,
          agentType,
          chunk,
        }),
      )
    }
  }

  return { onResponseChunk, onSubagentResponseChunk }
}
