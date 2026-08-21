import { useCallback, useEffect, useRef } from 'react'

import { useLoginStore } from '../state/login-store'
import { copyTextToClipboard } from '../utils/clipboard'
import { getFingerprintId } from '../utils/fingerprint'
import { logger } from '../utils/logger'

import type { useLoginMutation } from './use-auth-query'
import type { useFetchLoginUrl } from './use-fetch-login-url'
import type { User } from '../utils/auth'

/**
 * LoginModal's callbacks + ref-wiring as a hook so the component file stays
 * under the line bar (FID-2026-0819-005 quality ratchet: Loop 123).
 * Reads/writes the login store directly; behavior is identical to the
 * in-component callbacks.
 */
export function useLoginModalActions(params: {
  loginMutation: ReturnType<typeof useLoginMutation>
  fetchLoginUrlMutation: ReturnType<typeof useFetchLoginUrl>
  onLoginSuccess: (user: User) => void
}) {
  const { loginMutation, fetchLoginUrlMutation, onLoginSuccess } = params
  const store = useLoginStore()

  // Store mutation and callback in refs to prevent effect re-runs
  const loginMutationRef = useRef(loginMutation)
  const onLoginSuccessRef = useRef(onLoginSuccess)

  useEffect(() => {
    loginMutationRef.current = loginMutation
  }, [loginMutation])

  useEffect(() => {
    onLoginSuccessRef.current = onLoginSuccess
  }, [onLoginSuccess])

  // Copy to clipboard function
  const copyToClipboard = useCallback(
    async (text: string) => {
      if (!text || text.trim().length === 0) return

      store.setHasClickedLink(true)

      try {
        await copyTextToClipboard(text, {
          suppressGlobalMessage: true,
        })

        store.setJustCopied(true)
        store.setCopyMessage('✓ URL copied to clipboard!')
        setTimeout(() => {
          store.setCopyMessage(null)
          store.setJustCopied(false)
        }, 3000)
      } catch (err) {
        // Silently fail - the URL is visible for manual copying
        logger.error(err, 'Failed to copy to clipboard')
      }
    },
    [store],
  )

  // Fetch login URL and open browser using mutation
  const fetchLoginUrlAndOpenBrowser = useCallback(async () => {
    if (store.loading || store.hasOpenedBrowser) return

    store.setLoading(true)
    store.setError(null)

    // Near-instant after the prefetch in initializeApp; falls back to the
    // sync legacy fingerprint if hardware hashing fails.
    const id = await getFingerprintId()
    store.setFingerprintId(id)

    fetchLoginUrlMutation.mutate(id, {
      onSettled: () => {
        store.setLoading(false)
      },
    })
  }, [store, fetchLoginUrlMutation])

  // Handle successful login from polling
  const handleLoginSuccess = useCallback((user: User) => {
    loginMutationRef.current.mutate(user, {
      onSuccess: (validatedUser) => {
        onLoginSuccessRef.current(validatedUser)
      },
      onError: (error) => {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          '❌ Login validation failed, proceeding with raw user',
        )
        onLoginSuccessRef.current(user)
      },
    })
  }, [])

  // Handle polling timeout
  const handleTimeout = useCallback(() => {
    store.setError('Login timed out. Please try again.')
    store.setIsWaitingForEnter(false)
  }, [store])

  // Handle polling error
  const handlePollingError = useCallback(
    (pollingError: string) => {
      store.setError(pollingError)
      store.setIsWaitingForEnter(false)
    },
    [store],
  )

  return {
    copyToClipboard,
    fetchLoginUrlAndOpenBrowser,
    handleLoginSuccess,
    handleTimeout,
    handlePollingError,
  }
}
