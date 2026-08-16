import { EchoComplianceTracker } from '@savant-code/agent-runtime/util/echo-compliance'
import { COMPOSIO_META_TOOL_NAMES } from '@savant-code/common/constants/composio'
import { resolveBootContract } from '@savant-code/common/util/boot-contract'

import {
  applyOverridesToSessionState,
  initialSessionState,
} from '../../run-state'

import type { RunState } from '../../run-state'
import type { RunExecutionOptions } from '../types'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { SessionState } from '@savant-code/common/types/session-state'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'

/** Options needed by {@link resolveSessionState}, sliced from the full run options. */
type ResolveSessionStateOptions = Pick<
  RunExecutionOptions,
  | 'cwd'
  | 'skillsDir'
  | 'projectFiles'
  | 'knowledgeFiles'
  | 'customToolDefinitions'
  | 'maxAgentSteps'
  | 'protocolVariant'
  | 'devMode'
  | 'permissionMode'
  | 'designContract'
  | 'echoCompliance'
  | 'provenanceMode'
  | 'prompt'
  | 'logger'
>

/**
 * Builds (or restores) the session state for a run and applies all session
 * mutations that happen before the prompt is sent: protocol revalidation,
 * the per-run ECHO compliance tracker, dev/permission mode sync, and composio
 * meta-tool cleanup. Throws on failure; the caller maps errors to an error
 * RunState (FID-2026-0809-016: extracted from `run/execution.ts`).
 */
export async function resolveSessionState(params: {
  options: ResolveSessionStateOptions
  previousRun?: RunState
  agentDefinitions?: AgentDefinition[]
  fs: SavantCodeFileSystem
  spawn: SavantCodeSpawn
}): Promise<SessionState> {
  const {
    options: {
      cwd,
      skillsDir,
      projectFiles,
      knowledgeFiles,
      customToolDefinitions,
      maxAgentSteps,
      protocolVariant,
      devMode,
      permissionMode,
      designContract,
      echoCompliance,
      provenanceMode,
      prompt,
      logger,
    },
    previousRun,
    agentDefinitions,
    fs,
    spawn,
  } = params

  let sessionState: SessionState
  if (previousRun?.sessionState) {
    // applyOverridesToSessionState handles deep cloning and applying any provided overrides
    sessionState = await applyOverridesToSessionState(
      cwd,
      previousRun.sessionState,
      {
        knowledgeFiles,
        agentDefinitions,
        customToolDefinitions,
        projectFiles,
        maxAgentSteps,
      },
    )
  } else {
    // No previous run, so create a fresh session state
    sessionState = await initialSessionState({
      cwd,
      skillsDir,
      knowledgeFiles,
      agentDefinitions,
      customToolDefinitions,
      projectFiles,
      maxAgentSteps,
      protocolVariant,
      designContract,
      devMode,
      fs,
      spawn,
      logger,
    })
  }

  // Re-validate the selected contract on resumed sessions too. A persisted
  // session must never bypass an explicit boot-variant selection or silently
  // continue under a stale/missing protocol file.
  if (protocolVariant) {
    const bootContract = resolveBootContract(
      cwd ?? process.cwd(),
      protocolVariant,
    )
    sessionState.mainAgentState.protocolVariant = bootContract.variant
    sessionState.mainAgentState.protocolFile = bootContract.protocolFile
    sessionState.mainAgentState.protocolVersion = bootContract.protocolVersion
    sessionState.mainAgentState.protocolStrictMode = bootContract.strictMode
    sessionState.mainAgentState.protocolSource = bootContract.protocolSource
  } else {
    // A stale persisted contract must never arm a new SDK run. Hosts that do
    // not select a boot variant retain the legacy no-gate behavior.
    sessionState.mainAgentState.protocolVariant = undefined
    sessionState.mainAgentState.protocolFile = undefined
    sessionState.mainAgentState.protocolVersion = undefined
    sessionState.mainAgentState.protocolStrictMode = undefined
    sessionState.mainAgentState.protocolSource = undefined
    sessionState.mainAgentState.groundingCheckpoint = undefined
  }

  // FID-2026-0804-009: create the per-run ECHO compliance tracker and attach it
  // to the main agent state. `off` disables it; default is `warn`. A fresh
  // tracker is created every run (never inherited from a restored session).
  if (echoCompliance?.mode !== 'off') {
    sessionState.mainAgentState.echoCompliance = new EchoComplianceTracker({
      mode: echoCompliance?.mode ?? 'warn',
      fidPaths: echoCompliance?.fidPaths,
      userPrompt: prompt,
    })
  } else {
    sessionState.mainAgentState.echoCompliance = undefined
  }

  // FID-2026-0813-004: ZTAP provenance mode on the main agent state. Absent
  // values default to `record` at the provenance engine; hosts may override
  // per run.
  if (provenanceMode !== undefined) {
    sessionState.mainAgentState.provenanceMode = provenanceMode
  }

  // Ensure devMode reflects the current CLI state (may have changed since last run)
  if (devMode !== undefined) {
    sessionState.fileContext.devMode = devMode
  }
  if (designContract !== undefined) {
    sessionState.mainAgentState.designContract = designContract
    sessionState.fileContext.designContract = designContract
    sessionState.fileContext.designSystemContext = `## Active Design System Contract\\n\\n${JSON.stringify(designContract, null, 2)}`
  }
  if (permissionMode !== undefined) {
    sessionState.fileContext.permissionMode = permissionMode
  }

  for (const toolName of COMPOSIO_META_TOOL_NAMES) {
    delete sessionState.fileContext.customToolDefinitions[toolName]
  }

  return sessionState
}
