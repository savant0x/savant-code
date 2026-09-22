import {
  MAX_AGENT_STEPS_DEFAULT,
  MAX_SUBAGENT_DEPTH,
} from '@savant-code/common/constants/agents'
import { generateCompactId } from '@savant-code/common/util/string'

import { inheritFromParent } from './spawn-child-fields'
import {
  buildRestoredEvidenceNote,
  spliceRawEvidence,
} from '../../../evidence/splice'
import {
  buildGraphInjectionMessage,
  buildGraphInjectionUserMessage,
} from '../../../util/graph-injection'
import {
  filterUnfinishedToolCalls,
  withSystemTags,
} from '../../../util/messages'

import type { EvidenceSpillRecord } from '../../../evidence/spill'
import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type {
  AgentState,
  Subgoal,
} from '@savant-code/common/types/session-state'

/**
 * FID-2026-0919-027 — child-state construction, extracted verbatim from
 * `spawn-agent-utils.ts` (which sat at 297/300 lines) so the run-governance
 * inheritance could be added without breaching the ceiling.
 *
 * This module owns ONE question: given a spawning agent state, what is the
 * child's initial state? Everything a child needs to act as part of the SAME
 * run rather than as a detached agent is inherited here.
 *
 * FID-2026-0919-028: subclassing that question to a hand-written field list is
 * what let the governance configuration go missing in the first place, so the
 * inherited half now comes from `inheritFromParent()` — single-sourced from the
 * field partition in `spawn-child-fields.ts`, where a compile-time gate makes an
 * unclassified `AgentState` field a build error.
 *
 * `groundingCheckpoint` is deliberately NOT inherited: `isAgentGrounded`
 * short-circuits for `parentId` states, so a child neither needs nor owns the
 * root's boot-read progress, and copying it would misreport the child as the
 * session that completed grounding.
 */

/**
 * Re-exported so the spawn toolkit keeps ONE import surface for the inherited
 * governance configuration (FID-2026-0919-027's construction point and the
 * propagation snapshot in `spawn-agent-utils.ts`).
 */
export { GOVERNANCE_FIELDS, inheritRunGovernance } from './spawn-child-fields'
export type { RunGovernance } from './spawn-child-fields'

/**
 * Creates a new agent state for spawned agents
 */
export function createAgentState(
  agentType: string,
  agentTemplate: AgentTemplate,
  parentAgentState: AgentState,
  agentContext: Record<string, Subgoal>,
  graphInjectionProjectRoot?: string,
  rawEvidenceRecords?: EvidenceSpillRecord[],
): AgentState {
  if (parentAgentState.ancestorRunIds.length >= MAX_SUBAGENT_DEPTH) {
    throw new Error(
      `Subagent depth limit exceeded (maximum ${MAX_SUBAGENT_DEPTH} ancestors).`,
    )
  }

  const agentId = generateCompactId()

  // When including message history, filter out any tool calls that don't have
  // corresponding tool responses. This prevents the spawned agent from seeing
  // unfinished tool calls which throw errors in the Anthropic API.
  let messageHistory: Message[] = []

  if (agentTemplate.includeMessageHistory) {
    messageHistory = filterUnfinishedToolCalls(parentAgentState.messageHistory)
    // FID-2026-0824-026: restore raw evidence over compaction sentinels for
    // audit agents (requiresRawEvidence) BEFORE knowledge-graph/spawn markers.
    if (rawEvidenceRecords && rawEvidenceRecords.length > 0) {
      const recordsById = new Map(
        rawEvidenceRecords.map((record) => [record.toolCallId, record]),
      )
      const spliced = spliceRawEvidence(messageHistory, recordsById)
      messageHistory = spliced.messages
      const note = buildRestoredEvidenceNote(spliced.restoredToolCallIds)
      if (note !== null) {
        messageHistory.push({
          role: 'user',
          content: [{ type: 'text', text: withSystemTags(note) }],
          tags: ['EVIDENCE_RESTORED'],
        })
      }
    }
    // FID-2026-0806-002 Phase 3c: harness-injected knowledge-graph evidence.
    // Zero-tool agents (Verifier) and restricted agents (Thinker) may not call
    // the graph query tools; the harness computes the evidence and injects it
    // into message history instead. Best-effort — null evidence is skipped.
    if (graphInjectionProjectRoot) {
      const evidence = buildGraphInjectionMessage({
        projectRoot: graphInjectionProjectRoot,
        agentType,
        parentMessageHistory: parentAgentState.messageHistory,
      })
      if (evidence) {
        messageHistory.push(buildGraphInjectionUserMessage(evidence))
      }
    }
    messageHistory.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: withSystemTags(`Subagent ${agentType} has been spawned.`),
        },
      ],
      tags: ['SUBAGENT_SPAWN'],
    })
  }

  return {
    agentId,
    agentType,
    agentContext,
    ancestorRunIds: [
      ...parentAgentState.ancestorRunIds,
      parentAgentState.runId ?? 'NULL',
    ],
    subagents: [],
    childRunIds: [],
    messageHistory,
    stepsRemaining: MAX_AGENT_STEPS_DEFAULT,
    creditsUsed: 0,
    directCreditsUsed: 0,
    output: undefined,
    parentId: parentAgentState.agentId,
    systemPrompt: '',
    toolDefinitions: {},
    // FID-2026-0919-027 / FID-2026-0919-028: the inherited half of the state —
    // the run's governance configuration, the protocol contract, the FSM
    // position, and the per-run instances that must be SHARED with the child
    // rather than recreated. Single-sourced from INHERITED_FROM_PARENT, so the
    // classification list IS the behavior: nothing can be documented as
    // inherited and then forgotten here.
    ...inheritFromParent(parentAgentState),
  }
}
