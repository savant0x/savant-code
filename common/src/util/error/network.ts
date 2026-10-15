import { getApiErrorCandidates } from './api-details'

/**
 * Detects the runtime's fetch inactivity timeout (a DOMException named
 * "TimeoutError"). Bun hardcodes this to fire after 5 minutes without
 * receiving any bytes on a fetch response — there is no way to see it as
 * anything but a dead connection, since the server heartbeats every 30s
 * during streaming. Walks AI SDK RetryError wrappers and cause chains.
 */
export function isFetchIdleTimeoutError(error: unknown): boolean {
  for (const candidate of getApiErrorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue
    const { name, message } = candidate as { name?: unknown; message?: unknown }
    if (
      name === 'TimeoutError' ||
      (typeof message === 'string' &&
        message.toLowerCase().includes('the operation timed out'))
    ) {
      return true
    }
  }
  return false
}

/**
 * User-facing explanation for the fetch idle timeout. The raw runtime message
 * ("The operation timed out.") reads like a server failure; in practice it
 * means no bytes reached this machine for 5 minutes, which points at the
 * network path, since the server heartbeats every 30 seconds.
 */
export const FETCH_IDLE_TIMEOUT_USER_MESSAGE =
  'Connection timed out: no data was received from the server for 5 minutes, so the request was aborted.\n\n' +
  'The server sends a heartbeat every 30 seconds while responses stream, so this usually means the connection was silently dropped in transit (VPN, proxy, firewall, or flaky network) rather than a server outage.\n\n' +
  'Things to try: retry your message, check your network/VPN/proxy, or switch networks if it keeps happening.'

/**
 * Substrings of error messages that indicate the TCP connection died in
 * transit (as opposed to the server returning an error response). Bun's fetch
 * throws a plain Error with "The socket connection was closed unexpectedly..."
 * and code ECONNRESET/ConnectionClosed; undici throws TypeError "fetch failed".
 */
const TRANSIENT_NETWORK_ERROR_MESSAGE_PATTERNS = [
  'socket connection was closed unexpectedly',
  'fetch failed',
  'failed to fetch',
  'network connection was lost',
]

const TRANSIENT_NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'EPIPE',
  'ETIMEDOUT',
  // Bun-specific fetch error codes
  'ConnectionClosed',
  'ConnectionRefused',
  'FailedToOpenSocket',
])

/**
 * Detects transient connection-level failures (socket closed/reset, connection
 * refused, etc.) where no HTTP response was received. These are safe to retry
 * and should be shown to the user as a connectivity problem instead of a raw
 * runtime error with a stack trace. Walks AI SDK RetryError wrappers and
 * cause chains.
 */
export function isTransientNetworkError(error: unknown): boolean {
  for (const candidate of getApiErrorCandidates(error)) {
    if (!candidate || typeof candidate !== 'object') continue
    const { message, code } = candidate as {
      message?: unknown
      code?: unknown
    }
    if (typeof code === 'string' && TRANSIENT_NETWORK_ERROR_CODES.has(code)) {
      return true
    }
    if (typeof message === 'string') {
      const lower = message.toLowerCase()
      if (
        TRANSIENT_NETWORK_ERROR_MESSAGE_PATTERNS.some((pattern) =>
          lower.includes(pattern),
        )
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * User-facing explanation for a dropped connection. The raw runtime message
 * ("The socket connection was closed unexpectedly. For more information, pass
 * `verbose: true`...") plus a stack trace reads like a crash; in practice the
 * connection to the server was cut mid-request, which is transient and safe
 * to retry.
 */
export const TRANSIENT_NETWORK_ERROR_USER_MESSAGE =
  'Connection interrupted: the connection to the server was closed unexpectedly, even after retrying.\n\n' +
  'This is usually a transient issue — a flaky network, VPN/proxy, or the server briefly under heavy load.\n\n' +
  'Your progress is saved. Please try sending your message again.'
