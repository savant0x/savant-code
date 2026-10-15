import type { AuxiliaryMessageData } from '../../types/messages/savant-code-message'
import type {
  AssistantModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from 'ai'

type NonStringContent<T extends { content: string | readonly object[] }> = Omit<
  T,
  'content'
> & {
  content: Exclude<T['content'], string>
}
export type SavantModelMessage = (
  | SystemModelMessage
  | NonStringContent<UserModelMessage>
  | NonStringContent<AssistantModelMessage>
  | ToolModelMessage
) &
  AuxiliaryMessageData
