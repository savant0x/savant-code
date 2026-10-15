/**
 * Extracts an HTTP status code from an error message string.
 * Parses common error patterns to identify the underlying status code.
 * Returns the status code if found, undefined otherwise.
 */
export const extractStatusCodeFromMessage = (
  errorMessage: string,
): number | undefined => {
  const lowerMessage = errorMessage.toLowerCase()

  // AI SDK's built-in retry error (e.g., "Failed after 4 attempts. Last error: Service Unavailable")
  // The AI SDK already retried 4 times, but we still want our SDK wrapper to retry 3 more times
  if (
    lowerMessage.includes('failed after') &&
    lowerMessage.includes('attempts')
  ) {
    // Extract the underlying error type from the message
    if (lowerMessage.includes('service unavailable')) {
      return 503
    }
    if (lowerMessage.includes('timeout')) {
      return 408
    }
    if (lowerMessage.includes('connection refused')) {
      return 503
    }
    // Default to 500 for other AI SDK retry failures
    return 500
  }

  if (
    errorMessage.includes('503') ||
    lowerMessage.includes('service unavailable')
  ) {
    return 503
  }
  if (errorMessage.includes('504')) {
    return 504
  }
  if (errorMessage.includes('502')) {
    return 502
  }
  if (lowerMessage.includes('timeout') || errorMessage.includes('408')) {
    return 408
  }
  if (
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('connection refused')
  ) {
    return 503
  }
  if (lowerMessage.includes('dns') || lowerMessage.includes('enotfound')) {
    return 503
  }
  if (lowerMessage.includes('server error') || errorMessage.includes('500')) {
    return 500
  }
  if (errorMessage.includes('429') || lowerMessage.includes('rate limit')) {
    return 429
  }
  if (
    lowerMessage.includes('network error') ||
    lowerMessage.includes('fetch failed')
  ) {
    return 503
  }

  return undefined
}
