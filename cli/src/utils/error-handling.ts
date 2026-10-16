import { getEffectiveProviderRegistry } from '@savant-code/common/providers/custom-providers'
import { extractApiErrorDetails } from '@savant-code/common/util/error'
import { formatSavantFreeHardBlockedPrivacySignals } from '@savant-code/common/util/savant-free-privacy'

import type { ChatMessage } from '../types/chat'
import type {
  SavantFreeBlockReason,
  SavantFreeIpPrivacySignal,
} from '@savant-code/common/types/savant-free-session'

// Normalize unknown errors to a user-facing string.
const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'string') {
    return error
  }
  if (error instanceof Error && error.message) {
    return error.message + (error.stack ? `\n\n${error.stack}` : '')
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const candidate = (error as { message: unknown }).message
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate
    }
  }
  return fallback
}

/**
 * Check if an error indicates the user is out of credits.
 * Standardized on statusCode === 402 for payment required detection.
 */
export const isOutOfCreditsError = (error: unknown): boolean => {
  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    (error as { statusCode: unknown }).statusCode === 402
  ) {
    return true
  }
  return false
}

/**
 * FID-2026-0929-002: build the direct-mode message for a provider 402.
 *
 * In direct-provider mode there is no Savant backend, so a 402 is the
 * *provider's* account state — never our billing. The message quotes the
 * provider's own payload first (it explains itself: which upstream, which
 * account), names the provider, and points at /health for the live reading.
 * Never mentions savant-code.com, never flips input mode. Fail-silent: an
 * unparseable payload falls back to a neutral generic that still names the
 * provider when its id is known.
 */
export const providerOutOfCreditsError = (
  error: unknown,
  providerId?: string | undefined,
): string => {
  const details = getCliApiErrorDetails(error)
  const providerLabel =
    (providerId && getEffectiveProviderRegistry()[providerId]?.label) ||
    'The provider'
  const bodyMessage =
    details.message && !/^payment required\.?$/i.test(details.message)
      ? details.message
      : undefined
  if (bodyMessage) {
    return `${providerLabel} returned 402 Payment Required: ${bodyMessage} Run /health for the current reading, or /provider to switch.`
  }
  return `${providerLabel} returned 402 Payment Required. Run /health for the current reading, or /provider to switch.`
}

/**
 * Check if an error indicates free mode is not available in the user's country.
 * Standardized on statusCode === 403 + error === 'free_mode_unavailable'.
 */
export const isFreeModeUnavailableError = (error: unknown): boolean => {
  const details = getCliApiErrorDetails(error)
  return (
    details.statusCode === 403 && details.errorCode === 'free_mode_unavailable'
  )
}

const getTopLevelApiErrorDetails = (
  error: unknown,
): {
  statusCode?: number
  errorCode?: string
  message?: string
  countryCode?: string
  countryBlockReason?: string
  ipPrivacySignals?: string[]
} => {
  if (!error || typeof error !== 'object') return {}
  const statusCode = (error as { statusCode?: unknown }).statusCode
  const status = (error as { status?: unknown }).status
  const errorCode = (error as { error?: unknown }).error
  const message = (error as { message?: unknown }).message
  const countryCode = (error as { countryCode?: unknown }).countryCode
  const countryBlockReason = (error as { countryBlockReason?: unknown })
    .countryBlockReason
  const ipPrivacySignals = (error as { ipPrivacySignals?: unknown })
    .ipPrivacySignals
  const resolvedStatusCode =
    typeof statusCode === 'number'
      ? statusCode
      : typeof status === 'number'
        ? status
        : undefined

  return {
    ...(resolvedStatusCode !== undefined && { statusCode: resolvedStatusCode }),
    ...(typeof errorCode === 'string' && { errorCode }),
    ...(typeof message === 'string' && message.length > 0 && { message }),
    ...(typeof countryCode === 'string' &&
      countryCode.length > 0 && { countryCode }),
    ...(typeof countryBlockReason === 'string' && { countryBlockReason }),
    ...(Array.isArray(ipPrivacySignals) && {
      ipPrivacySignals: ipPrivacySignals.filter(
        (signal): signal is string => typeof signal === 'string',
      ),
    }),
  }
}

const getCliApiErrorDetails = (error: unknown) => {
  const parsed = extractApiErrorDetails(error)
  const topLevel = getTopLevelApiErrorDetails(error)

  return {
    statusCode: topLevel.statusCode ?? parsed.statusCode,
    errorCode: topLevel.errorCode ?? parsed.errorCode,
    // Prefer responseBody messages over top-level HTTP status text.
    message: parsed.message ?? topLevel.message,
    countryCode: topLevel.countryCode ?? parsed.countryCode,
    countryBlockReason:
      topLevel.countryBlockReason ?? parsed.countryBlockReason,
    ipPrivacySignals: topLevel.ipPrivacySignals ?? parsed.ipPrivacySignals,
  }
}

export const getSavantFreeRateLimitErrorMessage = (
  error: unknown,
): string | null => {
  const details = getCliApiErrorDetails(error)
  if (details.statusCode !== 429) return null
  if (details.errorCode === 'free_mode_rate_limited') {
    // Our own rate limiter's message is already user-facing and includes the
    // retry countdown — show it verbatim.
    return details.message ?? SAVANT_FREE_RATE_LIMIT_MESSAGE
  }
  // Other 429s (e.g. relayed upstream capacity errors) keep the branded
  // message but include the server detail so users aren't left guessing.
  // Only trust messages parsed from a server response body, or the curated
  // message on an agent-run output object — top-level messages on raw thrown
  // errors are HTTP status text or retry-wrapper noise.
  const isRunOutputObject =
    !!error &&
    typeof error === 'object' &&
    (error as { type?: unknown }).type === 'error'
  const detail =
    extractApiErrorDetails(error).message ??
    (isRunOutputObject ? details.message : undefined)
  if (detail && !/^too many requests\.?$/i.test(detail)) {
    return `${SAVANT_FREE_RATE_LIMIT_MESSAGE} (${detail})`
  }
  return SAVANT_FREE_RATE_LIMIT_MESSAGE
}

export const getCountryBlockFromFreeModeError = (
  error: unknown,
): {
  countryCode: string
  countryBlockReason?: SavantFreeBlockReason
  ipPrivacySignals?: SavantFreeIpPrivacySignal[]
} | null => {
  if (!isFreeModeUnavailableError(error)) return null
  const errorDetails = getCliApiErrorDetails(error)
  const countryCode =
    typeof errorDetails.countryCode === 'string' &&
    errorDetails.countryCode.length > 0
      ? errorDetails.countryCode
      : 'UNKNOWN'

  return {
    countryCode,
    countryBlockReason:
      typeof errorDetails.countryBlockReason === 'string'
        ? (errorDetails.countryBlockReason as SavantFreeBlockReason)
        : undefined,
    ipPrivacySignals: errorDetails.ipPrivacySignals as
      SavantFreeIpPrivacySignal[] | undefined,
  }
}

export const getFreeModeUnavailableErrorMessage = (error: unknown): string => {
  const details = getCliApiErrorDetails(error)
  const block = getCountryBlockFromFreeModeError(error)
  if (block?.countryBlockReason === 'anonymous_network') {
    return `Free mode cannot be used from ${formatSavantFreeHardBlockedPrivacySignals(
      block.ipPrivacySignals,
    )} traffic. Please disable it and try again.`
  }
  return details.message ?? FREE_MODE_UNAVAILABLE_MESSAGE
}

/**
 * SavantFree session gate errors returned by /api/v1/chat/completions. The
 * error codes keep their legacy waiting-room names for wire compatibility.
 *
 * Contract (see docs/savant-free-session-admission.md):
 *   - 428 `waiting_room_required`   — no session row exists, or the request
 *                                     carried no instance id (client isn't
 *                                     holding a session); POST /session to
 *                                     start a session.
 *   - 429 `waiting_room_queued`     — transient admission race (row caught
 *                                     mid-admit); retry via the normal poll.
 *   - 409 `session_superseded`      — another CLI rotated our instance id.
 *   - 409 `session_model_mismatch`  — session tier/model no longer matches.
 *   - 410 `session_expired`         — active session's expires_at has passed.
 */
export type SavantFreeGateErrorCode =
  | 'waiting_room_required'
  | 'waiting_room_queued'
  | 'session_superseded'
  | 'session_model_mismatch'
  | 'session_expired'

const SAVANT_FREE_GATE_STATUS: Record<SavantFreeGateErrorCode, number> = {
  waiting_room_required: 428,
  waiting_room_queued: 429,
  session_superseded: 409,
  session_model_mismatch: 409,
  session_expired: 410,
}

export const getSavantFreeGateErrorKind = (
  error: unknown,
): SavantFreeGateErrorCode | null => {
  if (!error || typeof error !== 'object') return null
  const errorCode = (error as { error?: unknown }).error
  const statusCode = (error as { statusCode?: unknown }).statusCode
  if (typeof errorCode !== 'string') return null
  const expected = SAVANT_FREE_GATE_STATUS[errorCode as SavantFreeGateErrorCode]
  if (expected === undefined || statusCode !== expected) return null
  return errorCode as SavantFreeGateErrorCode
}

export const SAVANT_FREE_RATE_LIMIT_MESSAGE =
  'SavantFree is temporarily busy. Please try again in a moment.'

export const FREE_MODE_UNAVAILABLE_MESSAGE =
  'Free mode is not available in your country. You can use another mode to continue.'

export const createErrorMessage = (
  error: unknown,
  aiMessageId: string,
): Partial<ChatMessage> => {
  const message = extractErrorMessage(error, 'Unknown error occurred')

  return {
    id: aiMessageId,
    content: `**Error:** ${message}`,
    blocks: undefined,
    isComplete: true,
  }
}
