import { cloneDeep } from 'lodash'

import { initialSessionState } from './initial-state'
import { deriveKnowledgeFiles } from './knowledge-files'
import {
  processAgentDefinitions,
  processCustomToolDefinitions,
} from './process-definitions'
import { computeProjectIndex, getProjectIndexInput } from './project-index'

import type { CustomToolDefinition } from '../custom-tool'
import type { RunState } from './types'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { Message } from '@savant-code/common/types/messages/savant-code-message'
import type { SessionState } from '@savant-code/common/types/session-state'

export async function generateInitialRunState({
  cwd,
  skillsDir,
  projectFiles,
  knowledgeFiles,
  userKnowledgeFiles,
  agentDefinitions,
  customToolDefinitions,
  maxAgentSteps,
  fs,
}: {
  cwd: string
  skillsDir?: string
  projectFiles?: Record<string, string>
  knowledgeFiles?: Record<string, string>
  userKnowledgeFiles?: Record<string, string>
  agentDefinitions?: AgentDefinition[]
  customToolDefinitions?: CustomToolDefinition[]
  maxAgentSteps?: number
  fs: SavantCodeFileSystem
}): Promise<RunState> {
  return {
    schemaVersion: 1,
    traceSessionId: crypto.randomUUID(),
    sessionState: await initialSessionState({
      cwd,
      skillsDir,
      projectFiles,
      knowledgeFiles,
      userKnowledgeFiles,
      agentDefinitions,
      customToolDefinitions,
      maxAgentSteps,
      fs,
    }),
    // FID-2026-0802-006 SDK3: intentional sentinel, not a real failure —
    // consumers must not treat `output.type === 'error'` as a run failure
    // before the first step completes (same convention as the CLI loaders).
    output: {
      type: 'error',
      message: 'No output yet',
    },
  }
}

export function withAdditionalMessage({
  runState,
  message,
}: {
  runState: RunState
  message: Message
}): RunState {
  const newRunState = cloneDeep(runState)

  if (newRunState.sessionState) {
    newRunState.sessionState.mainAgentState.messageHistory.push(message)
  }

  return newRunState
}

export function withMessageHistory({
  runState,
  messages,
}: {
  runState: RunState
  messages: Message[]
}): RunState {
  // FID-2026-0802-006 SDK1: use cloneDeep (same as withAdditionalMessage) —
  // the previous JSON round-trip silently dropped function-valued fields
  // (e.g. agentTemplates[].handleStepsFn) on every resume.
  const newRunState = cloneDeep(runState)

  if (newRunState.sessionState) {
    newRunState.sessionState.mainAgentState.messageHistory = messages
  }

  return newRunState
}

/**
 * Applies overrides to an existing session state, allowing specific fields to be updated
 * even when continuing from a previous run.
 */
export async function applyOverridesToSessionState(
  cwd: string | undefined,
  baseSessionState: SessionState,
  overrides: {
    projectFiles?: Record<string, string>
    knowledgeFiles?: Record<string, string>
    agentDefinitions?: AgentDefinition[]
    customToolDefinitions?: CustomToolDefinition[]
    maxAgentSteps?: number
  },
): Promise<SessionState> {
  // Deep clone to avoid mutating the original session state. cloneDeep (not a
  // JSON round-trip) so function-valued fields like
  // agentTemplates[].handleStepsFn survive in-process resumes
  // (FID-2026-0802-008 R1; withMessageHistory parity).
  const sessionState = cloneDeep(baseSessionState)

  // Apply maxAgentSteps override
  if (overrides.maxAgentSteps !== undefined) {
    sessionState.mainAgentState.stepsRemaining = overrides.maxAgentSteps
  }

  // Apply projectFiles override (recomputes file tree and token scores)
  if (overrides.projectFiles !== undefined) {
    if (cwd) {
      const projectIndex = getProjectIndexInput({
        cwd,
        projectFiles: overrides.projectFiles,
      })
      if (projectIndex) {
        const { fileTree, fileTokenScores, tokenCallers } =
          await computeProjectIndex(projectIndex)
        sessionState.fileContext.fileTree = fileTree
        sessionState.fileContext.fileTokenScores = fileTokenScores
        sessionState.fileContext.tokenCallers = tokenCallers
      }
    } else {
      // If projectFiles are provided but no cwd, reset file context fields
      sessionState.fileContext.fileTree = []
      sessionState.fileContext.fileTokenScores = {}
      sessionState.fileContext.tokenCallers = {}
    }

    // Auto-derive knowledgeFiles if not explicitly provided
    if (overrides.knowledgeFiles === undefined) {
      sessionState.fileContext.knowledgeFiles = deriveKnowledgeFiles(
        overrides.projectFiles,
      )
    }
  }

  // Apply knowledgeFiles override
  if (overrides.knowledgeFiles !== undefined) {
    sessionState.fileContext.knowledgeFiles = overrides.knowledgeFiles
  }

  // Apply agentDefinitions override (merge by id, last-in wins)
  if (overrides.agentDefinitions !== undefined) {
    const processedAgentTemplates = processAgentDefinitions(
      overrides.agentDefinitions,
    )
    sessionState.fileContext.agentTemplates = {
      ...sessionState.fileContext.agentTemplates,
      ...processedAgentTemplates,
    }
  }

  // Apply customToolDefinitions override (replace by toolName)
  if (overrides.customToolDefinitions !== undefined) {
    const processedCustomToolDefinitions = processCustomToolDefinitions(
      overrides.customToolDefinitions,
    )
    sessionState.fileContext.customToolDefinitions = {
      ...sessionState.fileContext.customToolDefinitions,
      ...processedCustomToolDefinitions,
    }
  }

  return sessionState
}
