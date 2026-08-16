import { KNOWLEDGE_FILE_NAMES_LOWERCASE } from '@savant-code/common/constants/knowledge'
import { formatCurrentDateTime } from '@savant-code/common/util/dates'
import { escapeString } from '@savant-code/common/util/string'
import { z } from 'zod/v4'

import { getAgentTemplate } from './agent-registry'
import { buildFullSpawnableAgentsSpec } from './prompts'
import { PLACEHOLDER, placeholderValues } from './types'
import {
  getGitChangesPrompt,
  getProjectFileTreePrompt,
  getSystemInfoPrompt,
} from '../system-prompt/prompts'
import { getToolCallFormatInstructions } from '../tools/prompts'
import { getCavemanRulesBlockForAgent } from '../util/caveman-rules'
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
import type {
  AgentState,
  AgentTemplateType,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'

export function formatFallbackModelInfo(modelId?: string): string {
  if (!modelId) {
    return `# Model Information

You are running on an unknown model.`
  }
  return `# Model Information

You are running on **${modelId}**.

Full metadata unavailable; the model was not found in the cached OpenRouter catalog.`
}

export async function formatPrompt(
  params: {
    prompt: string
    fileContext: ProjectFileContext
    agentState: AgentState
    tools: readonly string[]
    spawnableAgents: AgentTemplateType[]
    agentTemplates: Record<string, AgentTemplate>
    intitialAgentPrompt?: string
    modelInfoText?: string
    additionalToolDefinitions: () => Promise<
      ProjectFileContext['customToolDefinitions']
    >
    logger: Logger
  } & ParamsExcluding<
    typeof getAgentTemplate,
    'agentId' | 'localAgentTemplates'
  >,
): Promise<string> {
  const {
    fileContext,
    agentState,
    tools: _tools,
    spawnableAgents: _spawnableAgents,
    agentTemplates,
    intitialAgentPrompt,
    modelInfoText,
    additionalToolDefinitions: _additionalToolDefinitions,
    logger,
  } = params
  let { prompt } = params

  const { messageHistory } = agentState
  function isUserInputMessage(message: Message): message is UserMessage & {
    content: [TextPart, ...Array<TextPart | ImagePart>]
  } {
    return (
      message.role === 'user' &&
      message.content[0].type === 'text' &&
      parseUserMessage(message.content[0].text) !== undefined
    )
  }
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
          ...params,
          agentId: agentState.agentType,
          localAgentTemplates: agentTemplates,
        })
      : null
    return cachedStateAgentTemplate
  }

  const toInject: Record<PlaceholderValue, () => string | Promise<string>> = {
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

  // Only compute a placeholder's value when the prompt actually references it.
  // replaceAll is a no-op for an absent needle, so skipping the provider is
  // behavior-preserving while avoiding the expensive file-tree/git/system-info
  // builds on prompts (notably the per-step stepPrompt) that never use them.
  for (const varName of placeholderValues) {
    if (!prompt.includes(varName)) continue
    const valueProvider = toInject[varName] ?? (() => '')
    const value = await valueProvider()
    prompt = prompt.replaceAll(varName, value)
  }
  return prompt
}
type StringField = 'systemPrompt' | 'instructionsPrompt' | 'stepPrompt'

export async function getAgentPrompt<T extends StringField>(
  params: {
    agentTemplate: AgentTemplate
    promptType: { type: T }
    fileContext: ProjectFileContext
    agentState: AgentState
    agentTemplates: Record<string, AgentTemplate>
    additionalToolDefinitions: () => Promise<CustomToolDefinitions>
    logger: Logger
    useParentTools?: boolean
  } & ParamsExcluding<
    typeof formatPrompt,
    'prompt' | 'tools' | 'spawnableAgents'
  > &
    ParamsExcluding<
      typeof buildFullSpawnableAgentsSpec,
      'spawnableAgents' | 'agentTemplates'
    >,
): Promise<string | undefined> {
  const {
    agentTemplate,
    promptType,
    agentState,
    agentTemplates,
    additionalToolDefinitions: _additionalToolDefinitions,
    useParentTools,
  } = params

  const { toolNames, spawnableAgents, outputSchema } = agentTemplate
  const promptValue = agentTemplate[promptType.type]

  let prompt = await formatPrompt({
    ...params,
    prompt: promptValue,
    tools: toolNames,
    spawnableAgents,
  })

  let addendum = ''

  if (promptType.type === 'stepPrompt' && agentState.agentType && prompt) {
    // Put step prompt within a system_reminder tag so agent doesn't think the
    // user just spoke again. FID-2026-0815-010: refresh the current date/time
    // every step so a long session never relies on the stale session-start
    // system-prompt value — the model always sees a fresh timestamp.
    prompt = `<system_reminder>Current date and time: ${formatCurrentDateTime()}.\n\n${prompt}</system_reminder>`
  }

  // Add tool instructions, spawnable agents, and output schema prompts to instructionsPrompt
  if (promptType.type === 'instructionsPrompt' && agentState.agentType) {
    // Add subagent tools message when using parent's tools for prompt caching
    if (useParentTools) {
      addendum += `\n\nYou are a subagent that only has access to the following tools: ${toolNames.length > 0 ? toolNames.join(', ') : 'none'}. Previously referenced tools in the conversation may have only been available to the parent agent. Do not attempt to use any other tools besides these listed here. You will only get tool errors if you do.`
      addendum += `\n\n## Tool-Call Protocol\n\n${getToolCallFormatInstructions()}`

      // For subagents with inheritSystemPrompt, include full spawnable agents spec
      // since the parent's system prompt may not have these agents listed
      if (spawnableAgents.length > 0) {
        const spawnableAgentsSpec = await buildFullSpawnableAgentsSpec({
          ...params,
          spawnableAgents,
          agentTemplates,
        })
        addendum += `\n\n${spawnableAgentsSpec}`
      }
    } else if (spawnableAgents.length > 0) {
      // For non-inherited tools, agents are already defined as tools with full schemas,
      // so we add the spawnerPrompt for each agent
      const agentDescriptions = await Promise.all(
        spawnableAgents.map(async (agentType) => {
          const template = await getAgentTemplate({
            ...params,
            agentId: agentType,
            localAgentTemplates: agentTemplates,
          })
          if (template?.spawnerPrompt) {
            return `- ${agentType}: ${template.spawnerPrompt}`
          }
          return `- ${agentType}`
        }),
      )
      addendum += `\n\nYou can spawn the following agents:\n\n${agentDescriptions.join('\n')}`
    }

    // Add output schema information if defined. FID-2026-0802-005 H6: the
    // set_output directive is only valid when the agent actually has the
    // set_output tool. Structured-output agents like the Thinker (no
    // set_output in toolNames; runtime convergence gate builds the result)
    // must NOT be told to call set_output — their own instructions already
    // forbid it, and the contradictory addendum caused model confusion.
    if (outputSchema && toolNames.includes('set_output')) {
      addendum += '\n\n## Output Schema\n\n'
      addendum +=
        'When using the set_output tool, your output must conform to this schema. You may pass the fields either directly as top-level parameters or inside a `data` field — both are accepted.\n\n'
      addendum += '```json\n'
      try {
        // Convert Zod schema to JSON schema for display
        const jsonSchema = z.toJSONSchema(outputSchema, {
          io: 'input',
        })
        delete jsonSchema['$schema'] // Remove the $schema field for cleaner display
        addendum += JSON.stringify(jsonSchema, null, 2)
      } catch {
        // Fallback to a simple description
        addendum += JSON.stringify(
          { type: 'object', description: 'Output schema validation enabled' },
          null,
          2,
        )
      }
      addendum += '\n```'
    }

    // P5f (FID-2026-0806-003) — Caveman telegraphic output rules (opt-in).
    // Applied at the runtime boundary for the Orchestrator/Detective/Scribe
    // when protocol.config.yaml `caveman.enabled: true`, so the compressed
    // style cannot be lost to prompt staleness and stays config-gated.
    const cavemanBlock = getCavemanRulesBlockForAgent(
      agentTemplate.id,
      params.fileContext.projectRoot,
    )
    if (cavemanBlock) {
      addendum += `\n\n${cavemanBlock}`
    }
  }

  if (
    promptType.type === 'systemPrompt' &&
    params.fileContext.designSystemContext
  ) {
    addendum += `\n\n${params.fileContext.designSystemContext}`
  }

  const combinedPrompt = (prompt + addendum).trim()
  if (combinedPrompt === '') {
    return undefined
  }

  return combinedPrompt
}
