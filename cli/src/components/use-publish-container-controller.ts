import { useCallback, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { getAllPublishAgentIds } from './publish-confirmation'
import { useTerminalLayout } from '../hooks/use-terminal-layout'
import { useTheme } from '../hooks/use-theme'
import { useChatStore } from '../state/chat-store'
import { usePublishStore } from '../state/publish-store'
import {
  loadLocalAgents,
  loadAgentDefinitions,
} from '../utils/local-agent-registry'
import { isPlainEnterKey } from '../utils/terminal-enter-detection'

import type { MultilineInputHandle } from './multiline-input'

export interface PublishContainerControllerParams {
  inputRef: React.MutableRefObject<MultilineInputHandle | null>
  onExitPublish?: () => void
  onPublish: (agentIds: string[]) => Promise<void>
}

export function usePublishContainerController({
  inputRef,
  onExitPublish,
  onPublish,
}: PublishContainerControllerParams) {
  const theme = useTheme()
  const { width: widthLayout, height: heightLayout } = useTerminalLayout()
  const isTooSmall = widthLayout.atMost('xs') || heightLayout.atMost('xs')

  const {
    publishMode,
    selectedAgentIds,
    searchQuery,
    currentStep,
    focusedIndex,
    isPublishing,
    successResult,
    errorResult,
    includeDependents,
    toggleAgentSelection,
    setSearchQuery,
    goToConfirmation,
    goBackToSelection,
    setFocusedIndex,
    closePublish,
    setIncludeDependents,
  } = usePublishStore(
    useShallow((state) => ({
      publishMode: state.publishMode,
      selectedAgentIds: state.selectedAgentIds,
      searchQuery: state.searchQuery,
      currentStep: state.currentStep,
      focusedIndex: state.focusedIndex,
      isPublishing: state.isPublishing,
      successResult: state.successResult,
      errorResult: state.errorResult,
      includeDependents: state.includeDependents,
      toggleAgentSelection: state.toggleAgentSelection,
      setSearchQuery: state.setSearchQuery,
      goToConfirmation: state.goToConfirmation,
      goBackToSelection: state.goBackToSelection,
      setFocusedIndex: state.setFocusedIndex,
      closePublish: state.closePublish,
      setIncludeDependents: state.setIncludeDependents,
    })),
  )

  const inputFocused = useChatStore((state) => state.inputFocused)

  const agents = useMemo(
    () => loadLocalAgents().filter((agent) => !agent.isBundled),
    [],
  )
  const agentDefinitions = useMemo(() => {
    const defs = loadAgentDefinitions()
    const map = new Map<string, { spawnableAgents?: string[] }>()
    for (const def of defs) {
      map.set(def.id, { spawnableAgents: def.spawnableAgents })
    }
    return map
  }, [])

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents
    const query = searchQuery.toLowerCase()
    return agents.filter(
      (agent) =>
        agent.displayName.toLowerCase().includes(query) ||
        agent.id.toLowerCase().includes(query),
    )
  }, [agents, searchQuery])

  const selectedAgents = useMemo(
    () => agents.filter((agent) => selectedAgentIds.has(agent.id)),
    [agents, selectedAgentIds],
  )
  const canProceed = selectedAgentIds.size > 0

  const handleSearchKeyIntercept = useCallback(
    (key: {
      name?: string
      sequence?: string
      shift?: boolean
      ctrl?: boolean
      meta?: boolean
      option?: boolean
    }) => {
      if (key.name === 'escape') {
        if (searchQuery.length > 0) {
          setSearchQuery('')
        } else {
          closePublish()
          onExitPublish?.()
        }
        return true
      }
      if (key.name === 'up') {
        setFocusedIndex(Math.max(0, focusedIndex - 1))
        return true
      }
      if (key.name === 'down') {
        setFocusedIndex(Math.min(filteredAgents.length - 1, focusedIndex + 1))
        return true
      }
      if (isPlainEnterKey(key)) {
        const agent = filteredAgents[focusedIndex]
        if (agent) {
          toggleAgentSelection(agent.id)
        }
        return true
      }
      if (key.name === 'tab' && !key.shift) {
        if (canProceed) {
          goToConfirmation()
        }
        return true
      }
      return false
    },
    [
      focusedIndex,
      filteredAgents,
      canProceed,
      searchQuery,
      setFocusedIndex,
      toggleAgentSelection,
      goToConfirmation,
      setSearchQuery,
      closePublish,
      onExitPublish,
    ],
  )

  const handleCancel = useCallback(() => {
    closePublish()
    onExitPublish?.()
  }, [closePublish, onExitPublish])

  const handleNext = useCallback(() => {
    if (canProceed) {
      goToConfirmation()
    }
  }, [canProceed, goToConfirmation])

  const handleBack = useCallback(() => {
    goBackToSelection()
  }, [goBackToSelection])

  const publishAgentIds = useMemo(
    () =>
      getAllPublishAgentIds(
        selectedAgents,
        agents,
        agentDefinitions,
        includeDependents,
      ),
    [selectedAgents, agents, agentDefinitions, includeDependents],
  )

  const handlePublish = useCallback(async () => {
    await onPublish(publishAgentIds)
  }, [publishAgentIds, onPublish])

  useEffect(() => {
    if (publishMode && inputRef.current && currentStep === 'selection') {
      inputRef.current.focus()
    }
  }, [publishMode, inputRef, currentStep])

  useEffect(() => {
    if (!publishMode || currentStep === 'selection') return

    if (typeof process !== 'undefined' && process.stdin) {
      const stdin = process.stdin
      const onData = (data: Buffer) => {
        if (data[0] === 0x1b && data.length === 1) {
          handleCancel()
        }
      }
      stdin.on('data', onData)
      return () => {
        stdin.off('data', onData)
      }
    }
    return undefined
  }, [publishMode, currentStep, handleCancel])

  return {
    theme,
    isTooSmall,
    publishMode,
    selectedAgentIds,
    currentStep,
    isPublishing,
    successResult,
    errorResult,
    includeDependents,
    inputFocused,
    agents,
    filteredAgents,
    selectedAgents,
    agentDefinitions,
    focusedIndex,
    canProceed,
    searchQuery,
    publishAgentIds,
    setSearchQuery,
    toggleAgentSelection,
    setFocusedIndex,
    setIncludeDependents,
    handleSearchKeyIntercept,
    handleCancel,
    handleNext,
    handleBack,
    handlePublish,
  }
}
