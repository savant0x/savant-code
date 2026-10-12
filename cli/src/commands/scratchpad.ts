import {
  formatScratchpadReport,
  manageScratchpad,
} from '@savant-code/common/util/scratchpad'

import { getProjectRoot } from '../project-files'
import { clearInput, resetUiToIdleAfterSlashCommand } from './command-shared'
import { getSystemMessage } from '../utils/message-history'

import type { RouterParams } from './command-shared'

export async function handleScratchpadCommand(
  params: RouterParams,
  args: string,
): Promise<void> {
  const action = args.trim().toLowerCase() || 'status'
  const text = ['status', 'clean'].includes(action)
    ? formatScratchpadReport(
        await manageScratchpad(getProjectRoot(), { clean: action === 'clean' }),
      )
    : 'Usage: /scratchpad status | clean. Clean expires temporary files and obeys live-run protection.'
  params.setMessages((previous) => [...previous, getSystemMessage(text)])
  params.saveToHistory(params.inputValue.trim())
  clearInput(params)
  resetUiToIdleAfterSlashCommand()
}
