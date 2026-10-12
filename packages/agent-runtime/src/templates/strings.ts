import { formatCurrentDateTime } from '@savant-code/common/util/dates'
import { z } from 'zod/v4'

import { getAgentTemplate } from './agent-registry'
import { buildPlaceholderInjectors } from './placeholder-injectors'
import { buildFullSpawnableAgentsSpec } from './prompts'
import { placeholderValues } from './types'
import { getToolCallFormatInstructions } from '../tools/prompts'
import { getCavemanRulesBlockForAgent } from '../util/caveman-rules'

import type { AgentTemplate } from './types'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { ParamsExcluding } from '@savant-code/common/types/function-params'
import type {
  AgentState,
  AgentTemplateType,
} from '@savant-code/common/types/session-state'
import type {
  CustomToolDefinitions,
  ProjectFileContext,
} from '@savant-code/common/util/file'

export { formatFallbackModelInfo } from './placeholder-injectors'

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
    agentTemplates,
    intitialAgentPrompt,
    modelInfoText,
    logger,
  } = params
  let { prompt } = params

  const toInject = buildPlaceholderInjectors({
    fileContext,
    agentState,
    agentTemplates,
    intitialAgentPrompt,
    modelInfoText,
    getAgentTemplateParams: params,
    logger,
  })

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
/**
 * FID-2026-1012-002: the phase-gating note must describe the tools THIS child
 * has, never the catalog. The previous sentence named `run_readonly_command`
 * and `read_files`/`glob`/`list_directory`/`code_search` as "available in ALL
 * phases" inside a message whose first sentence said the opposite — for the
 * Thinker (whose allowlist is `sequentialthinking`/`end_turn`) it read as an
 * invitation to call `read_files`, which is the call the recovery ladder then
 * killed the run over. Naming only the child's own tools keeps the phase
 * explanation honest.
 */
const PHASE_GATED_TOOL_NOTES: Record<string, string> = {
  write_file: 'write_file (green/self_correct)',
  str_replace: 'str_replace (green/self_correct)',
  apply_patch: 'apply_patch (green/self_correct)',
  run_terminal_command: 'run_terminal_command (green/audit/self_correct)',
  sequentialthinking: 'sequentialthinking (Thinker only)',
}

function buildPhaseAvailabilityNote(toolNames: readonly string[]): string {
  const gated = toolNames
    .map((toolName) => PHASE_GATED_TOOL_NOTES[toolName])
    .filter((note): note is string => note !== undefined)
  if (gated.length === 0) {
    return 'Phase availability: none of your tools are phase-gated — all of them are available in every phase, including idle and red.'
  }
  return `Phase availability: of the tools you have, ${gated.join(', ')} are phase-gated. Every other tool in your list is available in every phase, including idle and red.`
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
    addendum +=
      '\n\nScratchpad lifecycle: dev/scratchpad is temporary storage, including active/ and archive/. Idle cleanup expires files after 24 hours and prunes older files above 32 MiB or 1,000 files, with a one-hour grace. Promote needed reports, reusable probes and project memory to their durable project locations before ending work. Never use scratch paths as the sole evidence for an open task or as persistent memory. Live native Savant runs protect temporary files while executing; resumed runs must tolerate missing temporary artifacts.'
    // Add subagent tools message when using parent's tools for prompt caching
    if (useParentTools) {
      addendum += `\n\nYou are a subagent that only has access to the following tools: ${toolNames.length > 0 ? toolNames.join(', ') : 'none'}. Previously referenced tools in the conversation may have only been available to the parent agent. Do not attempt to use any other tools besides these listed here. You will only get tool errors if you do. Each tool's full description (params, examples, constraints) is in your tool schemas — read it before calling.\n\n${buildPhaseAvailabilityNote(toolNames)}`
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
