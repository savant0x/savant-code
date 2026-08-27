import { useRenderer } from '@opentui/react'
import React, { useMemo } from 'react'

import { LoginUrlSection } from './login-url-section'
import { useLoginMutation } from '../hooks/use-auth-query'
import { useClipboard } from '../hooks/use-clipboard'
import { useFetchLoginUrl } from '../hooks/use-fetch-login-url'
import { useLoginKeyboardHandlers } from '../hooks/use-login-keyboard-handlers'
import { useLoginModalActions } from '../hooks/use-login-modal-actions'
import { useLoginPolling } from '../hooks/use-login-polling'
import { useLogo } from '../hooks/use-logo'
import { useTheme } from '../hooks/use-theme'
import { formatUrl, calculateResponsiveLayout } from '../login/utils'
import { useLoginStore } from '../state/login-store'
import { isRemoteSession } from '../utils/clipboard'

import type { User } from '../utils/auth'

interface LoginModalProps {
  onLoginSuccess: (user: User) => void
  hasInvalidCredentials?: boolean | null
}

export const LoginModal = ({
  onLoginSuccess,
  hasInvalidCredentials = false,
}: LoginModalProps) => {
  const renderer = useRenderer()
  const theme = useTheme()

  // Use zustand store for all state
  const {
    loginUrl,
    loading,
    error,
    fingerprintId,
    fingerprintHash,
    expiresAt,
    isWaitingForEnter,
    hasOpenedBrowser,
    justCopied,
    setLoginUrl,
    setError,
    setFingerprintHash,
    setExpiresAt,
    setIsWaitingForEnter,
    setHasOpenedBrowser,
  } = useLoginStore()

  // Use TanStack Query for login mutation
  const loginMutation = useLoginMutation()

  // Use custom hook for fetching login URL
  const fetchLoginUrlMutation = useFetchLoginUrl({
    setLoginUrl,
    setFingerprintHash,
    setExpiresAt,
    setIsWaitingForEnter,
    setHasOpenedBrowser,
    setError,
  })

  const {
    copyToClipboard,
    fetchLoginUrlAndOpenBrowser,
    handleLoginSuccess,
    handleTimeout,
    handlePollingError,
  } = useLoginModalActions({
    loginMutation,
    fetchLoginUrlMutation,
    onLoginSuccess,
  })

  // Use custom hook for login polling
  useLoginPolling({
    loginUrl,
    fingerprintId,
    fingerprintHash,
    expiresAt,
    isWaitingForEnter,
    onSuccess: handleLoginSuccess,
    onTimeout: handleTimeout,
    onError: handlePollingError,
  })

  // Use custom hook for keyboard handlers
  useLoginKeyboardHandlers({
    loginUrl,
    hasOpenedBrowser,
    loading,
    onFetchLoginUrl: fetchLoginUrlAndOpenBrowser,
    onCopyUrl: copyToClipboard,
  })

  // Calculate terminal width and height for responsive display
  const terminalWidth = renderer?.width || 80
  const terminalHeight = renderer?.height || 24

  // Calculate responsive layout
  const {
    isVerySmall,
    isNarrow,
    containerPadding,
    headerMarginTop,
    headerMarginBottom,
    sectionMarginBottom,
    contentMaxWidth,
    maxUrlWidth,
  } = calculateResponsiveLayout(terminalWidth, terminalHeight)

  const loginUrlLines = useMemo(
    () => (loginUrl ? formatUrl(loginUrl, maxUrlWidth) : []),
    [loginUrl, maxUrlWidth],
  )
  // A wrapped URL is a trap: terminal link detection and drag-select only
  // capture the first row, so the auth code arrives truncated.
  const loginUrlWrapped = loginUrlLines.length > 1

  // Logo colors — no sheen animation

  // Get the logo component based on available content width
  const { component: logoComponent } = useLogo({
    availableWidth: contentMaxWidth,
    // No applySheenToChar — static logo, no animation
    textColor: theme.foreground,
  })

  // Enable auto-copy when user selects text (drag to select)
  // hasSelection provides visual feedback when text is being selected
  const { hasSelection } = useClipboard()

  // Format URL for display (wrap if needed)
  return (
    <box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: theme.surface,
        padding: 0,
        flexDirection: 'column',
      }}
    >
      {/* Sticky banner at top */}
      {hasInvalidCredentials && (
        <box
          style={{
            width: '100%',
            padding: 1,
            backgroundColor: theme.surface,
            flexShrink: 0,
          }}
        >
          <text style={{ wrapMode: 'word' }}>
            <span fg={theme.secondary}>
              {isNarrow
                ? "⚠ Found API key but it's invalid. Please log in again."
                : '⚠ We found an API key but it appears to be invalid. Please log in again to continue.'}
            </span>
          </text>
        </box>
      )}

      <box
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: containerPadding,
          gap: 0,
        }}
      >
        {/* Header - Logo rendered by useLogo hook */}
        <box
          key="savant-code-logo"
          style={{
            flexDirection: 'column',
            alignItems: contentMaxWidth < 40 ? 'center' : 'flex-start',
            marginTop: headerMarginTop,
            marginBottom: headerMarginBottom,
            flexShrink: 0,
          }}
        >
          {logoComponent}
        </box>

        {/* Loading state */}
        {loading && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'none' }}>
              <span fg={theme.secondary}>Loading...</span>
            </text>
          </box>
        )}

        {/* Error state */}
        {error && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: sectionMarginBottom,
              maxWidth: contentMaxWidth,
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'word' }}>
              <span fg="red">Error: {error}</span>
            </text>
            {!isVerySmall && (
              <text style={{ wrapMode: 'word' }}>
                <span fg={theme.secondary}>
                  {isNarrow
                    ? 'Please try again'
                    : 'Please restart the CLI and try again'}
                </span>
              </text>
            )}
          </box>
        )}

        {/* Login instructions - before opening browser */}
        {!loading && !error && !hasOpenedBrowser && (
          <box
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: sectionMarginBottom,
              maxWidth: contentMaxWidth,
              flexShrink: 0,
            }}
          >
            <text style={{ wrapMode: 'word' }}>
              {/* FID-2026-0822-007: go/ready green → theme.success */}
              <span fg={theme.success}>Press ENTER to login...</span>
            </text>
          </box>
        )}

        {/* After pressing enter - show URL prominently for all users */}
        {!loading && !error && loginUrl && hasOpenedBrowser && (
          <LoginUrlSection
            loginUrl={loginUrl}
            loginUrlLines={loginUrlLines}
            loginUrlWrapped={loginUrlWrapped}
            justCopied={justCopied}
            hasSelection={hasSelection}
            isVerySmall={isVerySmall}
            isNarrow={isNarrow}
            isRemote={isRemoteSession()}
            contentMaxWidth={contentMaxWidth}
            sectionMarginBottom={sectionMarginBottom}
            theme={theme}
            onCopy={copyToClipboard}
          />
        )}
      </box>
    </box>
  )
}
