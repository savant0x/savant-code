import { isRetryableStatusCode, getErrorStatusCode } from '@savant-code/sdk'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { Chat } from './chat'
import { AppShell } from './components/app-shell'
import { ChatHistoryScreen } from './components/chat-history-screen'
import { LoginModal } from './components/login-modal'
import { ProjectPickerScreen } from './components/project-picker-screen'
import { SavantFreeLandingScreen } from './components/savant-free-landing-screen'
import { SavantFreeSupersededScreen } from './components/savant-free-superseded-screen'
import {
  EasterEggOverlays,
  EasterEggProvider,
} from './components/savant-ui/easter-egg-logo'
import { ToastContainer } from './components/toast'
import { useAuthQuery } from './hooks/use-auth-query'
import { useAuthState } from './hooks/use-auth-state'
import { useSavantFreeSession } from './hooks/use-savant-free-session'
import { useTerminalFocus } from './hooks/use-terminal-focus'
import { useTheme } from './hooks/use-theme'
import { getProjectRoot, startNewChat } from './project-files'
import { useChatHistoryStore } from './state/chat-history-store'
import { useChatStore } from './state/chat-store'
import { abortActiveRun } from './utils/active-run'
import { IS_SAVANT_FREE } from './utils/constants'
import { findGitRoot } from './utils/git'

import type { MultilineInputHandle } from './components/multiline-input'
import type { TopBannerType } from './types/store'
import type { User } from './utils/auth'
import type { AgentMode } from './utils/constants'
import type { PermissionMode } from './utils/settings'
import type { AuthStatus } from './utils/status-indicator-state'
import type { FileTreeNode } from '@savant-code/common/util/file'

interface AppProps {
  initialPrompt: string | null
  agentId?: string
  requireAuth: boolean | null
  hasInvalidCredentials: boolean
  fileTree: FileTreeNode[]
  continueChat: boolean
  continueChatId?: string
  initialMode?: AgentMode
  initialPermissionMode?: PermissionMode
  showProjectPicker: boolean
  onProjectChange: (projectPath: string) => void
}

export const App = ({
  initialPrompt,
  agentId,
  requireAuth,
  hasInvalidCredentials,
  fileTree,
  continueChat,
  continueChatId,
  initialMode,
  initialPermissionMode,
  showProjectPicker,
  onProjectChange,
}: AppProps) => {
  const theme = useTheme()
  const inputRef = useRef<MultilineInputHandle | null>(null)
  const {
    setInputFocused,
    setIsFocusSupported,
    resetChatStore,
    activeTopBanner,
    setActiveTopBanner,
    closeTopBanner,
  } = useChatStore(
    useShallow((store) => ({
      setInputFocused: store.setInputFocused,
      setIsFocusSupported: store.setIsFocusSupported,
      resetChatStore: store.reset,
      activeTopBanner: store.activeTopBanner,
      setActiveTopBanner: store.setActiveTopBanner,
      closeTopBanner: store.closeTopBanner,
    })),
  )

  const handleSupportDetected = useCallback(() => {
    setIsFocusSupported(true)
  }, [setIsFocusSupported])

  useTerminalFocus({
    onFocusChange: setInputFocused,
    onSupportDetected: handleSupportDetected,
  })

  const authQuery = useAuthQuery()
  const {
    isAuthenticated,
    setIsAuthenticated,
    setUser,
    handleLoginSuccess,
    logoutMutation,
  } = useAuthState({
    requireAuth,
    inputRef,
    setInputFocused,
    resetChatStore,
  })

  const projectRoot = getProjectRoot()
  const gitRoot = useMemo(
    () => findGitRoot({ cwd: projectRoot }),
    [projectRoot],
  )
  const showGitRootBanner = Boolean(gitRoot && gitRoot !== projectRoot)
  const [gitRootBannerDismissed, setGitRootBannerDismissed] = useState(false)
  const prevTopBannerRef = useRef<TopBannerType | null>(null)

  useEffect(() => {
    setGitRootBannerDismissed(false)
  }, [projectRoot])

  useEffect(() => {
    const prevBanner = prevTopBannerRef.current
    if (
      prevBanner === 'gitRoot' &&
      activeTopBanner === null &&
      showGitRootBanner
    ) {
      setGitRootBannerDismissed(true)
    }
    prevTopBannerRef.current = activeTopBanner
  }, [activeTopBanner, showGitRootBanner])

  useEffect(() => {
    if (!showGitRootBanner) {
      if (activeTopBanner === 'gitRoot') closeTopBanner()
      return
    }
    if (!gitRootBannerDismissed && activeTopBanner === null) {
      setActiveTopBanner('gitRoot')
    }
  }, [
    activeTopBanner,
    closeTopBanner,
    gitRootBannerDismissed,
    setActiveTopBanner,
    showGitRootBanner,
  ])

  const handleSwitchToGitRoot = useCallback(() => {
    if (gitRoot) onProjectChange(gitRoot)
  }, [gitRoot, onProjectChange])

  const { showChatHistory, closeChatHistory } = useChatHistoryStore()
  const [resumeChatId, setResumeChatId] = useState<string | null>(null)

  const handleResumeChat = useCallback(
    (chatId: string) => {
      abortActiveRun()
      closeChatHistory()
      resetChatStore()
      setResumeChatId(chatId)
    },
    [closeChatHistory, resetChatStore],
  )

  const handleNewChat = useCallback(() => {
    abortActiveRun()
    closeChatHistory()
    resetChatStore()
    startNewChat()
    setResumeChatId(null)
  }, [closeChatHistory, resetChatStore])

  const effectiveContinueChat = continueChat || resumeChatId !== null
  const effectiveContinueChatId = resumeChatId ?? continueChatId

  const authError = authQuery.error
  const authErrorStatusCode = authError
    ? getErrorStatusCode(authError)
    : undefined

  let authStatus: AuthStatus = 'ok'
  if (authQuery.isError && authErrorStatusCode !== undefined) {
    if (isRetryableStatusCode(authErrorStatusCode)) {
      authStatus = 'retrying'
    } else if (authErrorStatusCode >= 500) {
      authStatus = 'unreachable'
    }
  }

  if (showProjectPicker) {
    return (
      <AppShell backgroundColor={theme.background}>
        <ProjectPickerScreen
          onSelectProject={onProjectChange}
          initialPath={projectRoot}
        />
      </AppShell>
    )
  }

  if (
    requireAuth !== null &&
    isAuthenticated === false &&
    authStatus === 'ok'
  ) {
    return (
      <AppShell backgroundColor={theme.background}>
        <LoginModal
          onLoginSuccess={handleLoginSuccess}
          hasInvalidCredentials={hasInvalidCredentials}
        />
      </AppShell>
    )
  }

  const chatKey = resumeChatId ?? 'current'

  return (
    <EasterEggProvider>
      <AppShell backgroundColor={theme.background}>
        <AuthedSurface
          chatKey={chatKey}
          initialPrompt={initialPrompt}
          agentId={agentId}
          fileTree={fileTree}
          inputRef={inputRef}
          setIsAuthenticated={setIsAuthenticated}
          setUser={setUser}
          logoutMutation={logoutMutation}
          continueChat={effectiveContinueChat}
          continueChatId={effectiveContinueChatId}
          authStatus={authStatus}
          initialMode={initialMode}
          initialPermissionMode={initialPermissionMode}
          gitRoot={gitRoot}
          onSwitchToGitRoot={handleSwitchToGitRoot}
          showChatHistory={showChatHistory}
          onSelectChat={handleResumeChat}
          onCancelChatHistory={closeChatHistory}
          onNewChat={handleNewChat}
        />
      </AppShell>
      <EasterEggOverlays />
      <ToastContainer />
    </EasterEggProvider>
  )
}

interface AuthedSurfaceProps {
  chatKey: string
  initialPrompt: string | null
  agentId?: string
  fileTree: FileTreeNode[]
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  setIsAuthenticated: React.Dispatch<React.SetStateAction<boolean | null>>
  setUser: React.Dispatch<React.SetStateAction<User | null>>
  logoutMutation: ReturnType<typeof useAuthState>['logoutMutation']
  continueChat: boolean
  continueChatId: string | undefined
  authStatus: AuthStatus
  initialMode: AgentMode | undefined
  initialPermissionMode?: PermissionMode
  gitRoot: string | null | undefined
  onSwitchToGitRoot: () => void
  showChatHistory: boolean
  onSelectChat: (chatId: string) => void
  onCancelChatHistory: () => void
  onNewChat: () => void
}

const AuthedSurface = ({
  chatKey,
  initialPrompt,
  agentId,
  fileTree,
  inputRef,
  setIsAuthenticated,
  setUser,
  logoutMutation,
  continueChat,
  continueChatId,
  authStatus,
  initialMode,
  initialPermissionMode,
  gitRoot,
  onSwitchToGitRoot,
  showChatHistory,
  onSelectChat,
  onCancelChatHistory,
  onNewChat,
}: AuthedSurfaceProps) => {
  const { session, error: sessionError } = useSavantFreeSession()

  if (IS_SAVANT_FREE && session?.status === 'superseded') {
    return <SavantFreeSupersededScreen />
  }

  if (
    IS_SAVANT_FREE &&
    (session === null ||
      session.status === 'none' ||
      session.status === 'country_blocked' ||
      session.status === 'banned' ||
      session.status === 'rate_limited' ||
      session.status === 'takeover_prompt')
  ) {
    return <SavantFreeLandingScreen session={session} error={sessionError} />
  }

  if (showChatHistory) {
    return (
      <ChatHistoryScreen
        onSelectChat={onSelectChat}
        onCancel={onCancelChatHistory}
        onNewChat={onNewChat}
      />
    )
  }

  return (
    <Chat
      key={chatKey}
      initialPrompt={initialPrompt}
      agentId={agentId}
      fileTree={fileTree}
      inputRef={inputRef}
      setIsAuthenticated={setIsAuthenticated}
      setUser={setUser}
      logoutMutation={logoutMutation}
      continueChat={continueChat}
      continueChatId={continueChatId}
      authStatus={authStatus}
      initialMode={initialMode}
      initialPermissionMode={initialPermissionMode}
      gitRoot={gitRoot}
      onSwitchToGitRoot={onSwitchToGitRoot}
      savantFreeSession={session}
    />
  )
}
