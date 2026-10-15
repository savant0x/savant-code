import { createSavantCodeApiClient } from './client'

import type { SavantCodeApiClient } from './types'

// ============================================================================
// Shared singleton client
// ============================================================================

let sharedClient: SavantCodeApiClient | null = null
let sharedAuthToken: string | undefined
// Track the token that was used to create the current client instance
let clientCreatedWithToken: string | undefined

/**
 * Get or create the shared API client singleton.
 * The client is lazily created and reused across the application.
 *
 * Note: Always call setApiClientAuthToken() before getApiClient() when you need
 * to ensure a specific auth token is used. The client is recreated whenever
 * the auth token changes.
 */
export function getApiClient(): SavantCodeApiClient {
  // Recreate client if it doesn't exist or if the token has changed since creation
  if (!sharedClient || clientCreatedWithToken !== sharedAuthToken) {
    sharedClient = createSavantCodeApiClient({ authToken: sharedAuthToken })
    clientCreatedWithToken = sharedAuthToken
  }
  return sharedClient
}

/**
 * Set the auth token for the shared API client.
 * This will cause the next call to getApiClient() to create a new client
 * with the updated token.
 */
export function setApiClientAuthToken(authToken: string | undefined): void {
  sharedAuthToken = authToken
  // Note: We don't eagerly invalidate the client here. Instead, getApiClient()
  // checks if the token has changed and recreates the client if needed.
  // This avoids race conditions where the client is nullified but not yet recreated.
}

/**
 * Reset the shared client (mainly for testing)
 */
export function resetApiClient(): void {
  sharedClient = null
  sharedAuthToken = undefined
  clientCreatedWithToken = undefined
}
