/**
 * Chat screen entry (FID-2026-0805-003). All state wiring moved to
 * chat/use-chat-controller.ts + chat/use-chat-layout.ts; this file only
 * delegates to the composition and the presentational ChatLayout.
 */

import { ChatLayout } from './chat/panels'
import { useChatController } from './chat/use-chat-controller'
import { useChatLayout } from './chat/use-chat-layout'

import type { ChatProps } from './chat/types'

export const Chat = (props: ChatProps) => {
  const core = useChatController(props)
  const layoutProps = useChatLayout(core, props)
  return <ChatLayout {...layoutProps} />
}
