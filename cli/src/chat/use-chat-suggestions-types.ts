import type { OnSubmitPrompt } from './types'
import type { CommandResult } from '../commands/command-registry'
import type { SuggestionItem } from '../components/suggestion-menu'
import type {
  MatchedAgentInfo,
  MatchedFileInfo,
  MatchedSlashCommand,
  TriggerContext,
} from '../hooks/use-suggestion-engine'
import type { InputValue } from '../types/store'
import type { AgentMode } from '../utils/constants'
import type { InputMode } from '../utils/input-modes'
import type { LocalAgentInfo } from '../utils/local-agent-registry'
import type { FileTreeNode } from '@savant-code/common/util/file'

export interface UseChatSuggestionsArgs {
  inputValue: string
  cursorPosition: number
  inputMode: InputMode
  agentMode: AgentMode
  fileTree: FileTreeNode[]
  localAgents: LocalAgentInfo[]
  adsEnabled: boolean
  hasSubscription: boolean
  setInputValue: (
    value: InputValue | ((prev: InputValue) => InputValue),
  ) => void
  slashSelectedIndex: number
  setSlashSelectedIndex: (value: number | ((prev: number) => number)) => void
  agentSelectedIndex: number
  setAgentSelectedIndex: (value: number | ((prev: number) => number)) => void
  onSubmitPrompt: OnSubmitPrompt
  handleCommandResult: (result?: CommandResult) => void
}

export interface UseChatSuggestionsReturn {
  slashContext: TriggerContext
  mentionContext: TriggerContext
  slashMatches: MatchedSlashCommand[]
  agentMatches: MatchedAgentInfo[]
  fileMatches: MatchedFileInfo[]
  slashSuggestionItems: SuggestionItem[]
  agentSuggestionItems: SuggestionItem[]
  fileSuggestionItems: SuggestionItem[]
  openFileMenuWithTab: () => boolean
  handleMentionItemClick: (index: number) => void
  handleSlashItemClick: (index: number) => void
  executeSlashCommand: (
    selected: MatchedSlashCommand | undefined,
  ) => Promise<void>
  applySlashInsertText: (selected: MatchedSlashCommand) => boolean
  selectMentionAt: (index: number) => boolean
}
