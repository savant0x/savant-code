import { MAX_SUBAGENT_FAN_OUT } from '@savant-code/common/constants/agents'
import { jsonToolResult } from '@savant-code/common/util/messages'
import { safeToJSONValue } from '@savant-code/common/util/type-narrowing'

import { checkRecorderOutcome } from './recorder-stall-check'
import { runSingleSubagent } from './spawn-agents-child-run'
import { setActivity } from '../../../util/activity-tracking'

import type { SavantCodeToolHandlerFunction } from '../handler-function-type'
export type {
  SendSubagentChunk,
  SpawnAgentsToolName,
} from './spawn-agents-child-types'
import type {
  SpawnAgentsToolName,
  SpawnAgentsParams,
} from './spawn-agents-child-types'
import type { SavantCodeToolOutput } from '@savant-code/common/tools/list'

export const handleSpawnAgents = (async (
  params: SpawnAgentsParams,
): Promise<{ output: SavantCodeToolOutput<SpawnAgentsToolName> }> => {
  const {
    previousToolCallFinished,
    toolCall,

    agentState: parentAgentState,
    agentTemplate: parentAgentTemplate,
    fingerprintId,
    system: parentSystemPrompt,
    tools: parentTools = {},
    userInputId,
    sendSubagentChunk,
    writeToClient,
  } = params
  const { agents } = toolCall.input
  const { logger } = params

  await previousToolCallFinished

  if (
    !Array.isArray(agents) ||
    agents.some(
      (agent) =>
        !agent ||
        typeof agent !== 'object' ||
        typeof agent.agent_type !== 'string',
    )
  ) {
    throw new Error(
      'Invalid spawn_agents input: agents must be an array of entries with string agent_type values.',
    )
  }
  if (agents.length > MAX_SUBAGENT_FAN_OUT) {
    throw new Error(
      `Subagent fan-out limit exceeded (maximum ${MAX_SUBAGENT_FAN_OUT} children per spawn).`,
    )
  }

  // FID-2026-0718-009 M3: surface sub-agent activity on parent.
  // Sub-agent work begins; parent UI shows 'subagent' state.

  const results = await Promise.allSettled(
    agents.map(({ agent_type: agentTypeStr, prompt, params: spawnParams }) =>
      runSingleSubagent({
        params,
        parentAgentState,
        parentAgentTemplate,
        fingerprintId,
        parentSystemPrompt,
        parentTools,
        userInputId,
        sendSubagentChunk,
        writeToClient,
        isOnlyChild: agents.length === 1,
        agentTypeStr,
        prompt,
        spawnParams,
      }),
    ),
  )

  // FID-2026-0718-009 M8: After sub-agent work resolves, parent resumes
  // 'thinking' so the sidebar reflects parent awaiting next sub-agent or
  // the model step. Single setActivity after all sub-agents resolve.
  // P19: carry the parent's effective model id (parity with step.ts).
  setActivity(
    parentAgentState,
    {
      kind: 'thinking',
      startedAt: Date.now(),
      model: parentAgentTemplate.model,
    },
    writeToClient,
  )

  const reports = await Promise.all(
    results.map(async (result, index) => {
      if (result.status === 'fulfilled') {
        const { output, agentType, agentName } = result.value
        // FID-2026-0823-008: write-required relay guard — a recorder run that
        // ended without a successful FID/CHANGELOG write and without
        // set_output must not relay as a silent pass (read-but-no-write
        // stall). The errorMessage surfaces in the CLI agent block and lets
        // the Orchestrator re-spawn instead of trusting a no-op "done".
        if (agentType === 'recorder') {
          const outcome = checkRecorderOutcome(
            result.value.agentState.messageHistory,
          )
          if (!outcome.ok) {
            return {
              agentName,
              agentType,
              value: { errorMessage: outcome.reason },
            }
          }
        }
        return {
          agentName,
          agentType,
          value: safeToJSONValue(output),
        }
      } else {
        const agentTypeStr = agents[index].agent_type
        return {
          agentType: agentTypeStr,
          agentName: agentTypeStr,
          value: { errorMessage: `Error spawning agent: ${result.reason}` },
        }
      }
    }),
  )

  // Aggregate costs from subagents
  results.forEach((result, index) => {
    const agentInfo = agents[index]
    let subAgentCredits = 0

    if (result.status === 'fulfilled') {
      subAgentCredits = result.value.agentState.creditsUsed || 0
      // Note (James): intentionally no per-agent success log — narrow debugging value.
    } else if (result.reason?.agentState?.creditsUsed) {
      // Even failed agents may have incurred partial costs
      subAgentCredits = result.reason.agentState.creditsUsed || 0
      logger.debug(
        {
          parentAgentId: parentAgentState.agentId,
          subAgentType: agentInfo.agent_type,
          subAgentCredits,
        },
        'Aggregating failed subagent partial cost',
      )
    }

    if (subAgentCredits > 0) {
      parentAgentState.creditsUsed += subAgentCredits
      // Note (James): intentionally no aggregate log — narrow debugging value.
    }
  })

  return { output: jsonToolResult(reports) }
}) satisfies SavantCodeToolHandlerFunction<SpawnAgentsToolName>
