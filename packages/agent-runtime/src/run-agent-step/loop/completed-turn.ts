import { fireMainAgentTerminalHook } from '../../hooks/lifecycle-hooks'
import { getAgentOutput } from '../../util/agent-output'

import type { AgentTemplate } from '@savant-code/common/types/agent-template'
import type {
  AgentState,
  AgentOutput,
} from '@savant-code/common/types/session-state'
import type { ProjectFileContext } from '@savant-code/common/util/file'

/**
 * FID-2026-0919-031 — the single completed-turn exit of the main loop.
 *
 * Extracted from `loop.ts` (which owns the run and its exit paths) so the
 * `Stop` hook and the output resolution it reports stay in one place: the event
 * and the output it describes cannot drift apart, and `loop.ts` keeps the
 * under-300-line budget the quality gate enforces.
 *
 * Both endings of a completed turn resolve here, including compact-and-stop:
 * FID-2026-0825-001 — a manual `/compact` run ends via the pruner with NO
 * assistant turn, and `getAgentOutput` treats a zero-assistant history as an
 * error ("No response from agent"), which fired deterministically whenever the
 * compacted history kept no assistant messages. The one-shot stamp is consumed
 * and an explicitly empty last-turn output is reported instead — success with
 * nothing new to render (CompactionSignal carries the outcome).
 *
 * `Stop` is fired once, after the output is resolved, so the compact-and-stop
 * path reports the same event as any other completed turn. The helper excludes
 * child runs (they report through `SubagentStop`), so a subagent cannot claim
 * the session boundary.
 */
export function finishCompletedTurn(params: {
  agentState: AgentState
  agentTemplate: AgentTemplate
  fileContext: ProjectFileContext | undefined
}): AgentOutput {
  const { agentState, agentTemplate, fileContext } = params

  let output: AgentOutput
  if (agentState.compactAndStop === true) {
    agentState.compactAndStop = undefined
    output = { type: 'lastMessage', value: [] }
  } else {
    output = getAgentOutput(agentState, agentTemplate)
  }

  fireMainAgentTerminalHook({
    event: 'Stop',
    agentState,
    fileContext,
    outputType: output.type,
    ...(output.type === 'error' ? { errorMessage: output.message } : {}),
  })

  return output
}
