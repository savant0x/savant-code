import { useProviderInboxStore } from '../../state/provider-inbox-store'
import { clearInput, defineCommand } from '../command-shared'
export const NOTIFICATION_COMMANDS = [
  defineCommand({
    name: 'notifications',
    handler: (params) => {
      clearInput(params)
      useProviderInboxStore.getState().setOpen(true)
    },
  }),
]
