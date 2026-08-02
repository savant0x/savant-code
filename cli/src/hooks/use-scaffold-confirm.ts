import { useCallback, useState } from 'react'

import { loadSettings, saveSettings } from '../utils/settings'

import type { AgentMode } from '../utils/constants'

export type ScaffoldConfirmState =
  { kind: 'idle' } | { kind: 'pending'; targetMode: AgentMode }

/**
 * Manages the first-click confirmation for SCAFFOLD mode.
 * The warning is shown once and then persisted via settings.
 */
export function useScaffoldConfirm() {
  const [isAcknowledged, setIsAcknowledged] = useState(
    () => loadSettings().scaffoldAcknowledged === true,
  )
  const [confirmState, setConfirmState] = useState<ScaffoldConfirmState>({
    kind: 'idle',
  })

  /**
   * Requests entry into SCAFFOLD mode.
   * @returns `true` if the caller should proceed with the mode switch
   *          (already acknowledged or not SCAFFOLD).
   *          `false` if a confirmation UI was shown and the caller must wait.
   */
  const requestScaffoldMode = useCallback(
    (targetMode: AgentMode) => {
      if (targetMode !== 'SCAFFOLD') {
        setConfirmState({ kind: 'idle' })
        return true
      }

      if (isAcknowledged) {
        return true
      }

      setConfirmState({ kind: 'pending', targetMode })
      return false
    },
    [isAcknowledged],
  )

  const confirm = useCallback(() => {
    saveSettings({ scaffoldAcknowledged: true })
    setIsAcknowledged(true)
    setConfirmState({ kind: 'idle' })
  }, [])

  const cancel = useCallback(() => {
    setConfirmState({ kind: 'idle' })
  }, [])

  return {
    confirmState,
    requestScaffoldMode,
    confirm,
    cancel,
    isAcknowledged,
  }
}
