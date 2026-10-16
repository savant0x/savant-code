import { useEffect, useState } from 'react'

import { useLogoutMutation } from './use-auth-query'
import { identifyUser } from '../utils/analytics'
import { getUserCredentials } from '../utils/auth'
import { loggerContext } from '../utils/logger'

import type { MultilineInputHandle } from '../components/multiline-input'
import type { User } from '../utils/auth'

const setAuthLoggerContext = (params: { userId: string; email: string }) => {
  loggerContext.userId = params.userId
  loggerContext.userEmail = params.email
  identifyUser(params.userId, {
    email: params.email,
  })
}

const clearAuthLoggerContext = () => {
  delete loggerContext.userId
  delete loggerContext.userEmail
}

interface UseAuthStateOptions {
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  setInputFocused: (focused: boolean) => void
  resetChatStore: () => void
}

/**
 * FID-2026-0929-005 (gut the backend): the useAuthQuery validation stage is
 * deleted — there is no backend to validate a credential against, so the app
 * is authenticated immediately on mount. Stored credentials.json identity is
 * inert residue that still feeds analytics/logger context (analytics identity
 * is out of this FID's deletion scope); logout keeps clearing it via
 * useLogoutMutation.
 */
export const useAuthState = ({
  inputRef,
  setInputFocused,
  resetChatStore,
}: UseAuthStateOptions) => {
  const logoutMutation = useLogoutMutation()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(true)
  const [user, setUser] = useState<User | null>(() => getUserCredentials())

  // Hydrate the logger/analytics context from stored credentials once.
  useEffect(() => {
    if (user) {
      setAuthLoggerContext({
        userId: user.id || 'local',
        email: user.email,
      })
    } else {
      clearAuthLoggerContext()
    }
  }, [user])

  // Auto-focus input after authentication
  useEffect(() => {
    if (isAuthenticated !== true) return

    setInputFocused(true)

    const focusNow = () => {
      const handle = inputRef.current
      if (handle && typeof handle.focus === 'function') {
        handle.focus()
      }
    }

    focusNow()
    const timeoutId = setTimeout(focusNow, 0)

    return () => clearTimeout(timeoutId)
  }, [isAuthenticated, setInputFocused, inputRef])

  return {
    isAuthenticated,
    setIsAuthenticated,
    user,
    setUser,
    logoutMutation,
  }
}
