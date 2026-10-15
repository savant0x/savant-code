import { useMemo } from 'react'

import { useInputHistory } from '../hooks/use-input-history'
import { useChatStore } from '../state/chat-store'
import { loadLocalAgents } from '../utils/local-agent-registry'

import type { InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'

export type UseChatInteractionStateArgs = {
  agentMode: AgentMode
  inputValue: string
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
}

export function useChatInteractionState({
  agentMode,
  inputValue,
  setInputValue,
}: UseChatInteractionStateArgs) {
  const localAgents = useMemo(() => loadLocalAgents(agentMode), [agentMode])
  const inputMode = useChatStore((state) => state.inputMode)
  const setInputMode = useChatStore((state) => state.setInputMode)
  const askUserState = useChatStore((state) => state.askUserState)
  const adsEnabled = useChatStore((state) => state.adsEnabled)
  const driveMode = useChatStore((state) => state.driveMode)
  const drivePaused = useChatStore((state) => state.drivePaused)

  const history = useInputHistory(inputValue, setInputValue, {
    inputMode,
    setInputMode,
  })

  return {
    localAgents,
    inputMode,
    setInputMode,
    askUserState,
    adsEnabled,
    driveMode,
    drivePaused,
    ...history,
  }
}
