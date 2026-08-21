import { KNOWLEDGE_FILE_NAMES_LOWERCASE } from '@savant-code/common/constants/knowledge'
import { formatCurrentDateTime } from '@savant-code/common/util/dates'
import { escapeString } from '@savant-code/common/util/string'

import { getAgentTemplate } from './agent-registry'
import { PLACEHOLDER } from './types'
import {
  getGitChangesPrompt,
  getProjectFileTreePrompt,
  getSystemInfoPrompt,
} from '../system-prompt/prompts'
import { parseUserMessage } from '../util/messages'

import type { AgentTemplate, PlaceholderValue } from './types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type {
  TextPart,
  ImagePart,
} from '@savant-code/common/types/messages/content-part'
import type {
  Message,
  UserMessage,
} from '@savant-code/common/types/messages/savant-code-message'
import type { AgentState } from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

export function formatFallbackModelInfo(modelId?: string): string {
  if (!modelId) {
    return `# Model Information

You are running on an unknown model.`
  }
  return `# Model Information

You are running on **${modelId}**.

Full metadata unavailable; the model was not found in the cached OpenRouter catalog.`
}

function isUserInputMessage(message: Message): message is UserMessage & {
  content: [TextPart, ...Array<TextPart | ImagePart>]
} {
  return (
    message.role === 'user' &&
    message.content[0].type === 'text' &&
    parseUserMessage(message.content[0].text) !== undefined
  )
}

export function buildPlaceholderInjectors(params: {
  fileContext: ProjectFileContext
  agentState: AgentState
  agentTemplates: Record<string, AgentTemplate>
  intitialAgentPrompt?: string
  modelInfoText?: string
  getAgentTemplateParams: ParamsExcluding<
    typeof getAgentTemplate,
    'agentId' | 'localAgentTemplates'
  >
  logger: Logger
}): Record<PlaceholderValue, () => string | Promise<string>> {
  const {
    fileContext,
    agentState,
    agentTemplates,
    intitialAgentPrompt,
    modelInfoText,
    getAgentTemplateParams,
    logger,
  } = params

  const { messageHistory } = agentState
  // The per-step stepPrompt references none of the expensive placeholders
  // (file tree, git changes, system info, knowledge files, agent name, model
  // info), yet every step rebuilt them eagerly — three file-tree truncation
  // passes plus a history scan plus a template lookup — only for replaceAll to
  // no-op on each. Resolve the last user input and the state's agent template
  // lazily so a placeholder-free prompt does none of that work.
  let cachedLastUserInput: string | undefined | null = null
  const getLastUserInput = (): string | undefined => {
    if (cachedLastUserInput !== null) return cachedLastUserInput
    const lastUserMessage = messageHistory.findLast(isUserInputMessage)
    cachedLastUserInput = lastUserMessage
      ? parseUserMessage(lastUserMessage.content[0].text)
      : undefined
    return cachedLastUserInput
  }

  let cachedStateAgentTemplate: AgentTemplate | null | undefined
  const getStateAgentTemplate = async (): Promise<AgentTemplate | null> => {
    if (cachedStateAgentTemplate !== undefined) return cachedStateAgentTemplate
    cachedStateAgentTemplate = agentState.agentType
      ? await getAgentTemplate({
          ...getAgentTemplateParams,
          agentId: agentState.agentType,
          localAgentTemplates: agentTemplates,
        })
      : null
    return cachedStateAgentTemplate
  }

  return {
    [PLACEHOLDER.AGENT_NAME]: async () => {
      const agentTemplate = await getStateAgentTemplate()
      return agentTemplate
        ? agentTemplate.displayName || 'Unknown Agent'
        : 'Savant'
    },
    [PLACEHOLDER.CURRENT_DATE]: () => formatCurrentDateTime(),
    [PLACEHOLDER.FILE_TREE_PROMPT_SMALL]: () =>
      getProjectFileTreePrompt({
        fileContext,
        fileTreeTokenBudget: 2_500,
        mode: 'agent',
        logger,
      }),
    [PLACEHOLDER.FILE_TREE_PROMPT]: () =>
      getProjectFileTreePrompt({
        fileContext,
        fileTreeTokenBudget: 10_000,
        mode: 'agent',
        logger,
      }),
    [PLACEHOLDER.FILE_TREE_PROMPT_LARGE]: () =>
      getProjectFileTreePrompt({
        fileContext,
        fileTreeTokenBudget: 190_000,
        mode: 'search',
        logger,
      }),
    [PLACEHOLDER.GIT_CHANGES_PROMPT]: () => getGitChangesPrompt(fileContext),
    [PLACEHOLDER.REMAINING_STEPS]: () => `${agentState.stepsRemaining!}`,
    [PLACEHOLDER.PROJECT_ROOT]: () => fileContext.projectRoot,
    [PLACEHOLDER.SYSTEM_INFO_PROMPT]: () => getSystemInfoPrompt(fileContext),
    [PLACEHOLDER.USER_CWD]: () => fileContext.cwd,
    [PLACEHOLDER.USER_INPUT_PROMPT]: () =>
      escapeString(getLastUserInput() ?? ''),
    [PLACEHOLDER.DESIGN_SYSTEM_CONTEXT]: () =>
      fileContext.designSystemContext ?? '',
    [PLACEHOLDER.INITIAL_AGENT_PROMPT]: () =>
      escapeString(intitialAgentPrompt ?? ''),
    [PLACEHOLDER.MODEL_INFO]: async () => {
      const agentTemplate = await getStateAgentTemplate()
      return modelInfoText ?? formatFallbackModelInfo(agentTemplate?.model)
    },
    [PLACEHOLDER.PROTOCOL_FILE]: () => {
      if (agentState.protocolVariant && !agentState.protocolFile) {
        throw new Error(
          `Boot contract for ${agentState.protocolVariant} is missing its resolved protocol file`,
        )
      }
      return agentState.protocolFile ?? 'ECHO.md'
    },
    [PLACEHOLDER.KNOWLEDGE_FILES_CONTENTS]: () =>
      Object.entries({
        ...Object.fromEntries(
          Object.entries(fileContext.knowledgeFiles)
            .filter(([filePath]) => {
              const lowerPath = filePath.toLowerCase()
              // Root-level knowledge files only (knowledge.md, AGENTS.md, CLAUDE.md)
              return KNOWLEDGE_FILE_NAMES_LOWERCASE.includes(lowerPath)
            })
            .map(([path, content]) => [path, content.trim()]),
        ),
        ...fileContext.userKnowledgeFiles,
      })
        .map(([path, content]) => {
          return `\`\`\`${path}\n${content.trim()}\n\`\`\``
        })
        .join('\n\n'),
  }
}
