import fs from 'fs'
import os from 'os'
import path from 'path'

import { AnalyticsEvent } from '@savant-code/common/constants/analytics-events'
import { getProjectFileTree } from '@savant-code/common/project-file-tree'
import React from 'react'

import { App } from '../app'
import { setProjectRoot } from '../project-files'
import { trackEvent } from '../utils/analytics'
import { getAuthTokenDetails } from '../utils/auth'
import { saveRecentProject } from '../utils/recent-projects'
import { resetSavantCodeClient } from '../utils/savant-code-client'

import type { FileTreeNode } from '@savant-code/common/util/file'

interface AppWithAsyncAuthProps {
  initialPrompt: React.ComponentProps<typeof App>['initialPrompt']
  agentId: React.ComponentProps<typeof App>['agentId']
  continueChat: React.ComponentProps<typeof App>['continueChat']
  continueChatId: React.ComponentProps<typeof App>['continueChatId']
  initialMode: React.ComponentProps<typeof App>['initialMode']
  initialPermissionMode: React.ComponentProps<
    typeof App
  >['initialPermissionMode']
  projectRoot: string
  showProjectPicker: boolean
}

/**
 * Async auth gate around the app root (FID-2026-0819-005 Loop 133). Moved
 * verbatim from the CLI entrypoint: resolves backend vs direct-provider
 * auth state on mount, loads the project file tree for the @ menu, and
 * handles project switches from the picker. Prop values are identical to
 * the closure values the inline component captured.
 */
export const AppWithAsyncAuth = (props: AppWithAsyncAuthProps) => {
  const {
    initialPrompt,
    agentId,
    continueChat,
    continueChatId,
    initialMode,
    initialPermissionMode,
    projectRoot,
    showProjectPicker,
  } = props
  const [requireAuth, setRequireAuth] = React.useState<boolean | null>(null)
  const [hasInvalidCredentials, setHasInvalidCredentials] =
    React.useState(false)
  const [fileTree, setFileTree] = React.useState<FileTreeNode[]>([])
  const [currentProjectRoot, setCurrentProjectRoot] =
    React.useState(projectRoot)
  const [showProjectPickerScreen, setShowProjectPickerScreen] =
    React.useState(showProjectPicker)

  React.useEffect(() => {
    // In direct-provider mode (DIRECT_PROVIDER set + gateway keys), the CLI
    // does not use the SavantCode backend for inference, so backend auth
    // validation is unnecessary and would fail with a stub/dev token.
    // Inline the check to avoid importing the env helper before dotenv is
    // loaded in this early boot module.
    if (process.env.DIRECT_PROVIDER?.trim().length) {
      setRequireAuth(false)
      setHasInvalidCredentials(false)
      return
    }

    const apiKey = getAuthTokenDetails().token ?? ''

    if (!apiKey) {
      setRequireAuth(true)
      setHasInvalidCredentials(false)
      return
    }

    // A token is present in backend mode; show the invalid-credentials
    // banner optimistically. It will be cleared once useAuthQuery succeeds.
    setHasInvalidCredentials(true)
    setRequireAuth(false)
  }, [])

  const loadFileTree = React.useCallback(async (root: string) => {
    try {
      if (root) {
        const tree = await getProjectFileTree({
          projectRoot: root,
          fs: fs.promises,
        })
        setFileTree(tree)
      }
    } catch (error) {
      // Silently fail - fileTree is optional for @ menu
    }
  }, [])

  React.useEffect(() => {
    loadFileTree(currentProjectRoot)
  }, [currentProjectRoot, loadFileTree])

  // Callback for when user selects a new project from the picker
  const handleProjectChange = React.useCallback(
    async (newProjectPath: string) => {
      // Change process working directory
      process.chdir(newProjectPath)

      // Track directory change (avoid logging full paths for privacy)
      const isGitRepo = fs.existsSync(path.join(newProjectPath, '.git'))
      const pathDepth = newProjectPath.split(path.sep).filter(Boolean).length
      trackEvent(AnalyticsEvent.CHANGE_DIRECTORY, {
        isGitRepo,
        pathDepth,
        isHomeDir: newProjectPath === os.homedir(),
      })
      // Update the project root in the module state
      setProjectRoot(newProjectPath)
      // Reset client to ensure tools use the updated project root
      resetSavantCodeClient()
      // Save to recent projects list
      saveRecentProject(newProjectPath)
      // Update local state
      setCurrentProjectRoot(newProjectPath)
      // Reset file tree state to trigger reload
      setFileTree([])
      // Hide the picker and show the chat
      setShowProjectPickerScreen(false)
    },
    [],
  )

  return (
    <App
      initialPrompt={initialPrompt}
      agentId={agentId}
      requireAuth={requireAuth}
      hasInvalidCredentials={hasInvalidCredentials}
      fileTree={fileTree}
      continueChat={continueChat}
      continueChatId={continueChatId}
      initialMode={initialMode}
      initialPermissionMode={initialPermissionMode}
      showProjectPicker={showProjectPickerScreen}
      onProjectChange={handleProjectChange}
    />
  )
}
