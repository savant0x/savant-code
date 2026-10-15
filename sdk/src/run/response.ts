import { AgentOutputSchema } from '@savant-code/common/types/session-state'
import {
  FETCH_IDLE_TIMEOUT_USER_MESSAGE,
  TRANSIENT_NETWORK_ERROR_USER_MESSAGE,
  extractApiErrorDetails,
  isFetchIdleTimeoutError,
  isTransientNetworkError,
} from '@savant-code/common/util/error'

import { getErrorStatusCode } from '../error-utils'
import { extractStatusCodeFromMessage } from './status-code'

import type { RunReturnType } from './types'
import type { ServerAction } from '@savant-code/common/actions'
import type { SessionState } from '@savant-code/common/types/session-state'

export async function handlePromptResponse({
  action,
  resolve,
  onError,
  initialSessionState,
  traceSessionId,
}: {
  action: ServerAction<'prompt-response'> | ServerAction<'prompt-error'>
  resolve: (value: RunReturnType) => void
  onError: (error: { message: string }) => void
  initialSessionState: SessionState
  traceSessionId: string
}) {
  if (action.type === 'prompt-error') {
    onError({ message: action.message })

    const statusCode = extractStatusCodeFromMessage(action.message)
    resolve({
      schemaVersion: 1,
      sessionState: initialSessionState,
      traceSessionId,
      output: {
        type: 'error',
        message: action.message,
        ...(statusCode !== undefined && { statusCode }),
      },
    })
  } else if (action.type === 'prompt-response') {
    // Stop enforcing session state schema! It's a black box we will pass back to the server.
    // Only check the output schema.
    const parsedOutput = AgentOutputSchema.safeParse(action.output)
    if (!parsedOutput.success) {
      const message = [
        'Received invalid prompt response from server:',
        JSON.stringify(parsedOutput.error.issues),
        'If this issues persists, please contact support@savant-code.com',
      ].join('\n')
      onError({ message })
      resolve({
        schemaVersion: 1,
        sessionState: initialSessionState,
        traceSessionId,
        output: {
          type: 'error',
          message,
        },
      })
      return
    }
    const { sessionState, output } = action

    const state: RunReturnType = {
      schemaVersion: 1,
      sessionState,
      traceSessionId,
      output: output ?? {
        type: 'error',
        message: 'No output from agent',
      },
    }
    resolve(state)
  } else {
    // FID-2026-0802-008 D4: keep the type-level exhaustiveness guard — if the
    // action union ever grows, this branch fails to compile instead of
    // silently leaving the run promise unsettled.
    action satisfies never
    throw new Error('Internal error: prompt response type not handled')
  }
}

/**
 * Maps a callMainPrompt failure into an error RunState, preserving the user's
 * progress via the cancelled-session builder and attaching any API error
 * metadata (status code, country block signals, etc.).
 */
export function buildMainPromptErrorRunState(params: {
  error: unknown
  getCancelledSessionState: (message: string) => SessionState
  traceSessionId: string
}): RunReturnType {
  const { error, getCancelledSessionState, traceSessionId } = params
  let errorMessage = isFetchIdleTimeoutError(error)
    ? FETCH_IDLE_TIMEOUT_USER_MESSAGE
    : isTransientNetworkError(error)
      ? TRANSIENT_NETWORK_ERROR_USER_MESSAGE
      : error instanceof Error
        ? error.message
        : String(error ?? '')
  const apiErrorDetails = extractApiErrorDetails(error)
  const statusCode = apiErrorDetails.statusCode ?? getErrorStatusCode(error)
  const {
    countryBlockReason,
    countryCode,
    errorCode,
    ipPrivacySignals,
    message: parsedMessage,
  } = apiErrorDetails
  if (parsedMessage) {
    errorMessage = parsedMessage
  }

  return {
    schemaVersion: 1,
    sessionState: getCancelledSessionState(errorMessage),
    traceSessionId,
    output: {
      type: 'error',
      message: errorMessage,
      ...(statusCode !== undefined && { statusCode }),
      ...(errorCode !== undefined && { error: errorCode }),
      ...(countryCode !== undefined && { countryCode }),
      ...(countryBlockReason !== undefined && { countryBlockReason }),
      ...(ipPrivacySignals !== undefined && { ipPrivacySignals }),
    },
  }
}
