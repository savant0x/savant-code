import { Chat } from '../chat'
import { ChatHistoryScreen } from './chat-history-screen'
import { SavantFreeLandingScreen } from './savant-free-landing-screen'
import { SavantFreeSupersededScreen } from './savant-free-superseded-screen'
import { useSavantFreeSession } from '../hooks/use-savant-free-session'
import { IS_SAVANT_FREE } from '../utils/constants'

import type { MultilineInputHandle } from './multiline-input'
import type { useAuthState } from '../hooks/use-auth-state'
import type { User } from '../utils/auth'
import type { AgentMode } from '../utils/constants'
import type { PermissionMode } from '../utils/settings'
import type { AuthStatus } from '../utils/status-indicator-state'
import type { FileTreeNode } from '@savant-code/common/util/file'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

interface AuthedSurfaceProps {
  chatKey: string
  initialPrompt: string | null
  agentId?: string
  fileTree: FileTreeNode[]
  inputRef: MutableRefObject<MultilineInputHandle | null>
  setIsAuthenticated: Dispatch<SetStateAction<boolean | null>>
  setUser: Dispatch<SetStateAction<User | null>>
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

export const AuthedSurface = ({
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
