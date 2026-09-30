import { toOptionalFile } from '@savant-code/common/constants/paths'
import { getMCPClient, listMCPTools } from '@savant-code/common/mcp/client'
import { toJSONValue } from '@savant-code/common/util/type-narrowing'

import { handleToolCall, readFiles } from './tool-call'
import { getAgentRuntimeImpl } from '../impl/agent-runtime'
import { getProjectPathLookupKeys } from '../tools/path-utils'

import type { CustomToolDefinition } from '../custom-tool'
import type { OverrideToolHandlers } from './types'
import type { OnFileWrittenCallback } from '../tools/change-file'
import type { FileFilter } from '../tools/read-files'
import type { ServerAction } from '@savant-code/common/actions'
import type { Logger } from '@savant-code/common/types/contracts/logger'
import type { TraceWriter } from '@savant-code/common/types/contracts/trace'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'

/**
 * Builds the agent-runtime implementation object for a run, wiring the SDK's
 * tool execution (handleToolCall / readFiles), MCP tool discovery, stream
 * chunk dispatch, and prompt-response resolution into the runtime's scoped
 * deps. All run-scoped values are injected so the builder stays pure.
 */
export function buildAgentRuntimeImpl(params: {
  logger?: Logger
  traceWriter?: TraceWriter
  signal?: AbortSignal
  fs: SavantCodeFileSystem
  cwd?: string
  env?: Record<string, string>
  fileFilter?: FileFilter
  overrideTools: OverrideToolHandlers
  customToolDefinitions: CustomToolDefinition[]
  onFileWritten?: OnFileWrittenCallback
  checkpointDir?: string
  checkpointTurnId?: string
  onError: (error: { message: string }) => void
  onResponseChunk: (action: ServerAction<'response-chunk'>) => Promise<void>
  onSubagentResponseChunk: (
    action: ServerAction<'subagent-response-chunk'>,
  ) => Promise<void>
  handlePromptResponseAction: (
    action: ServerAction<'prompt-response'> | ServerAction<'prompt-error'>,
  ) => void
}): ReturnType<typeof getAgentRuntimeImpl> {
  const {
    logger,
    traceWriter,
    signal,
    fs,
    cwd,
    env,
    fileFilter,
    overrideTools,
    customToolDefinitions: activeCustomToolDefinitions,
    onFileWritten,
    checkpointDir,
    checkpointTurnId,
    onError,
    onResponseChunk,
    onSubagentResponseChunk,
    handlePromptResponseAction,
  } = params

  return getAgentRuntimeImpl({
    logger,
    traceWriter,
    handleStepsLogChunk: () => {
      // Does nothing for now
    },
    requestToolCall: async ({ userInputId, toolName, input, mcpConfig }) => {
      return handleToolCall({
        action: {
          type: 'tool-call-request',
          requestId: crypto.randomUUID(),
          userInputId,
          toolName,
          input,
          timeout: undefined,
          mcpConfig,
        },
        overrides: overrideTools ?? {},
        customToolDefinitions: activeCustomToolDefinitions
          ? Object.fromEntries(
              activeCustomToolDefinitions.map((def) => [def.toolName, def]),
            )
          : {},
        cwd,
        fs,
        env,
        signal,
        onFileWritten,
      })
    },
    checkpointDir,
    checkpointTurnId,
    requestMcpToolData: async ({ mcpConfig, toolNames }) => {
      const mcpClientId = await getMCPClient(mcpConfig)
      const listToolsResult = await listMCPTools(mcpClientId)
      const tools = listToolsResult.tools
      const filteredTools = !toolNames
        ? tools
        : tools.filter((tool) => toolNames.includes(tool.name))

      return filteredTools.map((tool) => ({
        name: tool.name,
        description:
          typeof tool.description === 'string' ? tool.description : undefined,
        inputSchema: toJSONValue(tool.inputSchema),
      }))
    },
    requestFiles: ({ filePaths }) =>
      readFiles({
        filePaths,
        override: overrideTools?.read_files,
        fileFilter,
        cwd,
        fs,
      }),
    requestOptionalFile: async ({ filePath }) => {
      const files = await readFiles({
        filePaths: [filePath],
        override: overrideTools?.read_files,
        fileFilter,
        cwd,
        fs,
      })
      const lookupKeys = cwd
        ? getProjectPathLookupKeys(cwd, filePath)
        : [filePath]
      const fileKey = lookupKeys.find((key) => key in files)
      return toOptionalFile(fileKey === undefined ? null : files[fileKey]!)
    },
    sendAction: ({ action }) => {
      if (action.type === 'action-error') {
        onError({ message: action.message })
        return
      }
      if (action.type === 'response-chunk') {
        onResponseChunk(action)
        return
      }
      if (action.type === 'subagent-response-chunk') {
        onSubagentResponseChunk(action)
        return
      }
      if (action.type === 'prompt-response') {
        handlePromptResponseAction(action)
        return
      }
      if (action.type === 'prompt-error') {
        handlePromptResponseAction(action)
        return
      }
    },
    sendSubagentChunk: ({
      userInputId,
      agentId,
      agentType,
      chunk,
      prompt,
      forwardToPrompt = true,
    }) => {
      onSubagentResponseChunk({
        type: 'subagent-response-chunk',
        userInputId,
        agentId,
        agentType,
        chunk,
        prompt,
        forwardToPrompt,
      })
    },
  })
}
