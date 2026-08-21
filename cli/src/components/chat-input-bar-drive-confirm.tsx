import { DriveModeConfirmation } from './drive-mode/confirmation'
import {
  buildDriveLockMessage,
  buildReviseMessage,
} from '../commands/auto-drive'
import { useChatStore } from '../state/chat-store'

import type { OnSubmitPrompt } from '../chat/types'

interface ChatInputDriveConfirmationProps {
  plan: React.ComponentProps<typeof DriveModeConfirmation>['plan']
  onSubmitPrompt: OnSubmitPrompt
}

/**
 * The drive-confirmation branch of the chat input bar: presents the pre-build
 * plan for the operator's single Law 2 approval (FID-2026-0818-002). Confirm
 * locks drive mode; Revise re-plans; Cancel exits.
 */
export const ChatInputDriveConfirmation = ({
  plan,
  onSubmitPrompt,
}: ChatInputDriveConfirmationProps) => {
  const activeAutoRunId = useChatStore((state) => state.activeAutoRunId)

  return (
    <DriveModeConfirmation
      plan={plan}
      onConfirm={(editedPlan) => {
        useChatStore.getState().setDriveState('driving')
        useChatStore.getState().setDrivePlanDraft(null)
        void onSubmitPrompt(
          buildDriveLockMessage({ ...plan, plan: editedPlan }, activeAutoRunId),
          'STRICT',
        )
          .then(() => useChatStore.getState().setDriveMode(true))
          .catch(() => {
            useChatStore.getState().setDriveMode(false)
            useChatStore.getState().setDriveState('planning')
          })
      }}
      onRevise={(notes) => {
        useChatStore.getState().setDriveState('planning')
        useChatStore.getState().setDrivePlanDraft(null)
        void onSubmitPrompt(buildReviseMessage(notes), 'STRICT').catch(() => {})
      }}
      onCancel={() => {
        useChatStore.getState().setDriveMode(false)
        useChatStore.getState().setDriveState('planning')
        useChatStore.getState().setDrivePlanDraft(null)
        useChatStore.getState().setActiveAutoRunId(null)
      }}
    />
  )
}
