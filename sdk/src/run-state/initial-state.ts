import { getInitialSessionState } from '@savant-code/common/types/session-state'
import { resolveBootContract } from '@savant-code/common/util/boot-contract'
import { getSystemInfo } from '@savant-code/common/util/system-info'

import { getGitChanges } from './git-changes'
import {
  deriveKnowledgeFiles,
  loadKnowledgeFilesFromPaths,
  loadUserKnowledgeFiles,
} from './knowledge-files'
import {
  processAgentDefinitions,
  processCustomToolDefinitions,
} from './process-definitions'
import {
  computeProjectIndex,
  discoverProjectPaths,
  getProjectIndexInput,
} from './project-index'
import { loadLocalAgents } from '../agents/load-agents'
import { loadSkills } from '../skills/load-skills'

import type { InitialSessionStateOptions } from './types'
import type { SessionState } from '@savant-code/common/types/session-state'
import type { SavantCodeSpawn } from '@savant-code/common/types/spawn'
import type {
  FileTreeNode,
  ProcessedAgentTemplate,
} from '@savant-code/common/util/file'
import type * as fsType from 'fs'

export async function initialSessionState(
  params: InitialSessionStateOptions,
): Promise<SessionState> {
  const { cwd, maxAgentSteps, skillsDir, protocolVariant } = params
  const bootContract = protocolVariant
    ? resolveBootContract(cwd ?? process.cwd(), protocolVariant)
    : undefined
  let {
    agentDefinitions,
    customToolDefinitions,
    projectFiles,
    knowledgeFiles,
    userKnowledgeFiles: providedUserKnowledgeFiles,
    fs,
    spawn,
    logger,
  } = params
  if (!agentDefinitions) {
    agentDefinitions = []
  }
  if (!customToolDefinitions) {
    customToolDefinitions = []
  }
  if (!fs) {
    fs = (require('fs') as typeof fsType).promises
  }
  if (!spawn) {
    const { spawn: nodeSpawn } = require('child_process')
    spawn = nodeSpawn as SavantCodeSpawn
  }
  if (!logger) {
    logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    }
  }

  let discoveredProject:
    { fileTree: FileTreeNode[]; filePaths: string[] } | undefined

  // Auto-discover project files if not provided and cwd is available
  if (projectFiles === undefined && cwd) {
    discoveredProject = await discoverProjectPaths({ cwd, fs })
  }
  if (knowledgeFiles === undefined) {
    if (projectFiles) {
      knowledgeFiles = deriveKnowledgeFiles(projectFiles)
    } else if (cwd && discoveredProject) {
      knowledgeFiles = await loadKnowledgeFilesFromPaths({
        cwd,
        filePaths: discoveredProject.filePaths,
        fs,
        logger,
      })
    } else {
      knowledgeFiles = {}
    }
  }

  let processedAgentTemplates: Record<string, ProcessedAgentTemplate> = {}
  if (agentDefinitions && agentDefinitions.length > 0) {
    processedAgentTemplates = processAgentDefinitions(agentDefinitions)
  } else {
    const loadedAgents = await loadLocalAgents({ verbose: false })
    processedAgentTemplates = processAgentDefinitions(
      Object.values(loadedAgents),
    )
  }
  const processedCustomToolDefinitions = processCustomToolDefinitions(
    customToolDefinitions,
  )

  let fileTree: FileTreeNode[] = []
  let fileTokenScores: Record<string, Record<string, number>> = {}
  let tokenCallers: Record<string, Record<string, string[]>> = {}

  const projectIndex = cwd
    ? getProjectIndexInput({ cwd, fs, logger, projectFiles, discoveredProject })
    : undefined
  if (projectIndex) {
    const result = await computeProjectIndex(projectIndex)
    fileTree = result.fileTree
    fileTokenScores = result.fileTokenScores
    tokenCallers = result.tokenCallers
  }

  // Gather git changes if cwd is available
  const gitChanges = cwd
    ? await getGitChanges({ cwd, spawn, logger })
    : {
        status: '',
        diff: '',
        diffCached: '',
        lastCommitMessages: '',
      }

  // Load user knowledge files from home directory and merge with any provided ones
  const homeKnowledgeFiles = await loadUserKnowledgeFiles({ fs, logger })
  const userKnowledgeFiles = {
    ...homeKnowledgeFiles,
    ...providedUserKnowledgeFiles,
  }

  // Load skills from project and home directories
  const skills = await loadSkills({
    cwd: cwd ?? process.cwd(),
    skillsPath: skillsDir,
    verbose: false,
  })

  const initialState = getInitialSessionState({
    projectRoot: cwd ?? process.cwd(),
    cwd: cwd ?? process.cwd(),
    fileTree,
    fileTokenScores,
    tokenCallers,
    knowledgeFiles,
    userKnowledgeFiles,
    agentTemplates: processedAgentTemplates,
    customToolDefinitions: processedCustomToolDefinitions,
    skills,
    gitChanges,
    changesSinceLastChat: {},
    shellConfigFiles: {},
    systemInfo: getSystemInfo(),
    ...(params.devMode ? { devMode: params.devMode } : {}),
    ...(params.designContract
      ? {
          designContract: params.designContract,
          designSystemContext: `## Active Design System Contract\\n\\n${JSON.stringify(params.designContract, null, 2)}`,
        }
      : {}),
  })

  if (maxAgentSteps) {
    initialState.mainAgentState.stepsRemaining = maxAgentSteps
  }

  if (bootContract) {
    initialState.mainAgentState.protocolVariant = bootContract.variant
    initialState.mainAgentState.protocolFile = bootContract.protocolFile
    initialState.mainAgentState.protocolVersion = bootContract.protocolVersion
    initialState.mainAgentState.protocolStrictMode = bootContract.strictMode
    initialState.mainAgentState.protocolSource = bootContract.protocolSource
  }

  return initialState
}
