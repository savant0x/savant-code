import { useMutation, useQueryClient } from '@tanstack/react-query'

import { logoutUser as logoutUserUtil } from '../utils/auth'
import { logger as defaultLogger, loggerContext } from '../utils/logger'
import { resetSavantCodeClient } from '../utils/savant-code-client'

import type { Logger } from '@savant-code/common/types/contracts/logger'

// FID-2026-0929-005 (gut the backend): the auth-validation query and the
// getUserInfoFromApiKey dependency are deleted — there is no backend to
// validate a key against. What survives is the logout mutation (clearing
// stored credentials is still meaningful) and the query keys the logout
// cache-clearing shares with other hooks.

export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
}

export interface UseLogoutMutationDeps {
  logoutUser?: () => Promise<boolean>
  logger?: Logger
}

/**
 * Hook for logout mutation
 *
 * Accepts optional dependencies for testing via dependency injection
 */
export function useLogoutMutation(deps: UseLogoutMutationDeps = {}) {
  const queryClient = useQueryClient()
  const { logoutUser = logoutUserUtil, logger = defaultLogger } = deps

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Reset the SDK client after logout
      resetSavantCodeClient()
      // Clear all auth-related cache
      queryClient.removeQueries({ queryKey: authQueryKeys.all })
      // Clear logger context
      delete loggerContext.userId
      delete loggerContext.userEmail
    },
    onError: (error) => {
      logger.error(error, 'Logout failed')
    },
  })
}
