import { jsonToolResult } from '@savant-code/common/util/messages'

import { callGravityIndexAPI } from '../../../llm-api/savant-code-web-api'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
import type {
  SavantCodeToolCall,
  SavantCodeToolOutput,
} from '@savant-code/common/tools/list'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { ClientEnv, CiEnv } from '@savant-code/common/types/contracts/env'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { JSONObject, JSONValue } from '@savant-code/common/types/json'

const omitUndefined = (value: Record<string, JSONValue | undefined>) => {
  const result: JSONObject = {}
  for (const [key, field] of Object.entries(value)) {
    if (field !== undefined) {
      result[key] = field
    }
  }
  return result
}

const isJSONObject = (value: JSONValue | undefined): value is JSONObject =>
  !!value && typeof value === 'object' && !Array.isArray(value)

/** Gravity attribution surface, so clicks/conversions are attributable to the
 *  product the request came from rather than all reading as CLI traffic. */
const gravitySurface = (agentTemplate: { id: string }): string => {
  if (agentTemplate.id === 'base-chat') return 'freebuff_chat'
  // SavantFree Web project agents are the `savant-free*` family.
  if (agentTemplate.id.startsWith('savant-free')) return 'freebuff_web'
  return 'savant_code_cli'
}

/** Surfaces that run under a shared service-account API key. For these we must
 *  send a per-end-user identifier so Gravity attributes conversions to the real
 *  user instead of collapsing every request onto the service account. */
const isServiceAccountSurface = (surface: string): boolean =>
  surface === 'freebuff_chat' || surface === 'freebuff_web'

export const handleGravityIndex = (async (params: {
  previousToolCallFinished: Promise<void>
  toolCall: SavantCodeToolCall<'gravity_index'>
  agentTemplate: AgentTemplate
  logger: Logger
  apiKey: string

  agentStepId: string
  clientSessionId: string
  fingerprintId: string
  repoId: string | undefined
  userInputId: string
  userId: string | undefined

  fetch: typeof globalThis.fetch
  clientEnv: ClientEnv
  ciEnv: CiEnv
}): Promise<{
  output: SavantCodeToolOutput<'gravity_index'>
  creditsUsed: number
}> => {
  const {
    previousToolCallFinished,
    toolCall,
    agentTemplate,
    agentStepId,
    apiKey,
    clientSessionId,
    fingerprintId,
    logger,
    repoId,
    userId,
    userInputId,
    fetch,
    clientEnv,
    ciEnv,
  } = params
  const { action } = toolCall.input

  const startedAt = Date.now()
  const gravityContext = {
    toolCallId: toolCall.toolCallId,
    action,
    userId,
    agentStepId,
    clientSessionId,
    fingerprintId,
    userInputId,
    repoId,
  }

  await previousToolCallFinished

  let creditsUsed = 0
  try {
    const existingInput = toolCall.input as JSONObject
    const existingMetadata = isJSONObject(existingInput.metadata)
      ? existingInput.metadata
      : {}
    const surface = gravitySurface(agentTemplate)
    const metadata = {
      ...existingMetadata,
      ...omitUndefined({
        surface,
        tool_call_id: toolCall.toolCallId,
        agent_step_id: agentStepId,
        fingerprint_id: fingerprintId,
        user_input_id: userInputId,
        repo_id: repoId,
      }),
    }
    const input = {
      ...existingInput,
      external_session_id: clientSessionId,
      // Shared service-account surfaces (SavantFree Web) authenticate the web API
      // with one account key, so the API-key owner can't identify the end user.
      // `fingerprintId` is the stable per-end-user/per-project signal there
      // (e.g. `savant-free-chat-<userId>` or the project id), so forward it as the
      // external user id; the web API hashes it before sending to Gravity. CLI
      // traffic omits it and falls back to the real API-key owner server-side.
      ...(isServiceAccountSurface(surface)
        ? { external_user_id: fingerprintId }
        : {}),
      metadata,
    } satisfies JSONObject

    const webApi = await callGravityIndexAPI({
      input,
      fetch,
      logger,
      apiKey,
      env: { clientEnv, ciEnv },
    })

    if (webApi.error || !webApi.result) {
      logger.warn(
        {
          ...gravityContext,
          durationMs: Date.now() - startedAt,
          success: false,
          error: webApi.error,
        },
        'Gravity Index returned error',
      )

    const rawError = (() => {
      if (typeof webApi.error === 'string') return webApi.error
      if (webApi.error == null) return 'Invalid Gravity Index response'
      try {
        return JSON.stringify(webApi.error)
      } catch {
        return 'Gravity Index returned a non-serializable error'
      }
    })()
    const lower = rawError.toLowerCase()

      let errorMessage: string
      if (lower.includes('base url') || lower.includes('missing savantcode')) {
        errorMessage = `[CONFIG_ERROR] Gravity Index failed: ${rawError}. Verify the SavantCode app URL is configured and the SAVANT_CODE_API_KEY is set.`
      } else if (lower.includes('api key') || lower.includes('authorization') || lower.includes('unauthorized')) {
        errorMessage = `[CREDENTIALS_ERROR] Gravity Index failed: ${rawError}. Verify the SAVANT_CODE_API_KEY is set and valid.`
      } else if (lower.includes('network error') || lower.includes('fetch') || lower.includes('enetunreach') || lower.includes('econnrefused')) {
        errorMessage = `[NETWORK_ERROR] Gravity Index failed: ${rawError}. Check that the SavantCode web API is reachable from this environment.`
      } else if (lower.includes('timeout')) {
        errorMessage = `[TIMEOUT_ERROR] Gravity Index timed out. Retry or check the SavantCode web API health.`
      } else {
        errorMessage = `[API_ERROR] Gravity Index failed: ${rawError}. If this persists, check the SavantCode web API logs or contact support.`
      }

      return {
        output: jsonToolResult({ errorMessage }),
        creditsUsed,
      }
    }

    if (typeof webApi.creditsUsed === 'number') {
      creditsUsed = webApi.creditsUsed
    }

    logger.info(
      {
        ...gravityContext,
        durationMs: Date.now() - startedAt,
        recommendation:
          typeof webApi.result.recommendation === 'object'
            ? webApi.result.recommendation
            : undefined,
        creditsUsed,
        success: true,
      },
      'Gravity Index request completed via web API',
    )

    return {
      output: jsonToolResult(webApi.result),
      creditsUsed,
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorMessage = `[RUNTIME_ERROR] Gravity Index action "${action}" threw an exception: ${rawMessage}. This is not a network issue. Check the SavantCode web API configuration and server health.`
    logger.error(
      {
        ...gravityContext,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : error,
        durationMs: Date.now() - startedAt,
        success: false,
      },
      'Gravity Index request failed with error',
    )
    return { output: jsonToolResult({ errorMessage }), creditsUsed }
  }
}) satisfies SavantCodeToolHandlerFunction<'gravity_index'>
