import path from 'path'

import { isComposioMetaToolName } from '@savant-code/common/constants/composio'
import { callMCPTool, getMCPClient } from '@savant-code/common/mcp/client'
import { toolNames } from '@savant-code/common/tools/constants'
import { clientToolCallSchema } from '@savant-code/common/tools/list'
import { applyPatchOperationSchema } from '@savant-code/common/tools/params/tool/apply-patch'
import { jsonObjectSchema } from '@savant-code/common/types/json'
import {
  getOptionalNumber,
  getOptionalString,
  getString,
} from '@savant-code/common/util/param-helpers'

import { isRunPauseError } from './types'
import { applyPatchTool } from '../tools/apply-patch'
import { FileChangeSchema, changeFile } from '../tools/change-file'
import { codeSearch } from '../tools/code-search'
import { glob } from '../tools/glob'
import { listDirectory } from '../tools/list-directory'
import { getFiles } from '../tools/read-files'
import { readUrl } from '../tools/read-url'
import { runTerminalCommand } from '../tools/run-terminal-command'

import type { CustomToolDefinition } from '../custom-tool'
import type { SavantCodeClientOptions } from './types'
import type { OnFileWrittenCallback } from '../tools/change-file'
import type { FileFilter } from '../tools/read-files'
import type { ServerAction } from '@savant-code/common/actions'
import type { ToolName } from '@savant-code/common/tools/constants'
import type { PublishedClientToolName } from '@savant-code/common/tools/list'
import type { SavantCodeFileSystem } from '@savant-code/common/types/filesystem'
import type { ToolResultOutput } from '@savant-code/common/types/messages/content-part'

function requireCwd(cwd: string | undefined, toolName: string): string {
  if (!cwd) {
    throw new Error(
      `cwd is required for the ${toolName} tool. Please provide cwd in SavantCodeClientOptions or override the ${toolName} tool.`,
    )
  }
  return cwd
}

export async function readFiles({
  filePaths,
  override,
  fileFilter,
  cwd,
  fs,
}: {
  filePaths: string[]
  override?: NonNullable<
    Required<SavantCodeClientOptions>['overrideTools']['read_files']
  >
  fileFilter?: FileFilter
  cwd?: string
  fs: SavantCodeFileSystem
}) {
  if (override) {
    return await override({ filePaths })
  }
  return getFiles({
    filePaths,
    cwd: requireCwd(cwd, 'read_files'),
    fs,
    fileFilter,
  })
}

export async function handleToolCall({
  action,
  overrides,
  customToolDefinitions,
  cwd,
  fs,
  env,
  signal,
  onFileWritten,
}: {
  action: ServerAction<'tool-call-request'>
  overrides: NonNullable<SavantCodeClientOptions['overrideTools']>
  customToolDefinitions: Record<string, CustomToolDefinition>
  cwd?: string
  fs: SavantCodeFileSystem
  env?: Record<string, string>
  signal?: AbortSignal
  onFileWritten?: OnFileWrittenCallback
}): Promise<{ output: ToolResultOutput[] }> {
  const toolName = action.toolName
  const input = action.input

  if (signal?.aborted) {
    return {
      output: [
        {
          type: 'json',
          value: {
            message: 'Tool call cancelled: the run was aborted by the user.',
          },
        },
      ],
    }
  }

  // Handle MCP tool calls when mcpConfig is present
  if (action.mcpConfig) {
    try {
      const mcpClientId = await getMCPClient(action.mcpConfig)
      const result = await callMCPTool(
        mcpClientId,
        {
          name: toolName,
          arguments: input,
        },
        undefined,
        signal ? { signal } : undefined,
      )
      return { output: result }
    } catch (error) {
      return {
        output: [
          {
            type: 'json',
            value: {
              errorMessage:
                error instanceof Error ? error.message : String(error),
            },
          },
        ],
      }
    }
  }

  let result: ToolResultOutput[]
  if (toolNames.includes(toolName as ToolName)) {
    clientToolCallSchema.parse(action)
  } else {
    const customToolHandler = customToolDefinitions[toolName]

    if (!customToolHandler) {
      throw new Error(
        `Custom tool handler not found for user input ID ${action.userInputId}`,
      )
    }
    return {
      output: await customToolHandler.execute(input),
    }
  }

  try {
    let override = overrides[toolName as PublishedClientToolName]
    if (
      !override &&
      (toolName === 'str_replace' || toolName === 'apply_patch')
    ) {
      // Reuse the write_file override for file editing tools.
      override = overrides['write_file']
    }
    if (override) {
      result = await override(input)
    } else if (toolName === 'end_turn') {
      result = [{ type: 'json', value: { message: 'Turn ended.' } }]
    } else if (toolName === 'write_file' || toolName === 'str_replace') {
      FileChangeSchema.parse(input)
      result = await changeFile({
        parameters: input,
        cwd: requireCwd(cwd, toolName),
        fs,
        onFileWritten,
      })
    } else if (toolName === 'apply_patch') {
      applyPatchOperationSchema.parse(input.operation)
      result = await applyPatchTool({
        parameters: input,
        cwd: requireCwd(cwd, toolName),
        fs,
        onFileWritten,
      })
    } else if (toolName === 'run_terminal_command') {
      const resolvedCwd = requireCwd(cwd, 'run_terminal_command')
      result = await runTerminalCommand({
        command: getString(input, 'command'),
        process_type: 'SYNC',
        cwd: path.resolve(resolvedCwd, getOptionalString(input, 'cwd') ?? '.'),
        timeout_seconds: getOptionalNumber(input, 'timeout_seconds') ?? 30,
        env,
        signal,
      })
    } else if (toolName === 'read_url') {
      result = await readUrl({
        url: getString(input, 'url'),
        max_chars: getOptionalNumber(input, 'max_chars'),
        signal,
      })
    } else if (toolName === 'code_search') {
      result = await codeSearch({
        projectPath: requireCwd(cwd, 'code_search'),
        pattern: getString(input, 'pattern'),
        flags: getOptionalString(input, 'flags'),
        cwd: getOptionalString(input, 'cwd'),
        maxResults: getOptionalNumber(input, 'maxResults'),
        globalMaxResults: getOptionalNumber(input, 'globalMaxResults'),
        maxOutputStringLength: getOptionalNumber(
          input,
          'maxOutputStringLength',
        ),
        timeoutSeconds: getOptionalNumber(input, 'timeoutSeconds'),
        signal,
      })
    } else if (toolName === 'list_directory') {
      result = await listDirectory({
        directoryPath: getString(input, 'path'),
        projectPath: requireCwd(cwd, 'list_directory'),
        fs,
      })
    } else if (toolName === 'glob') {
      result = await glob({
        pattern: getString(input, 'pattern'),
        projectPath: requireCwd(cwd, 'glob'),
        cwd: getOptionalString(input, 'cwd'),
        fs,
      })
    } else if (toolName === 'run_file_change_hooks') {
      // No-op: SDK doesn't run file change hooks
      result = [
        {
          type: 'json',
          value: {
            message: 'File change hooks are not supported in SDK mode',
          },
        },
      ]
    } else if (isComposioMetaToolName(toolName)) {
      // FID-2026-0929-005 (gut the backend): composio executed exclusively
      // via the SavantCode backend relay, which no longer exists. The meta
      // tool names survive (they are part of the agent tool vocabulary), so
      // the branch stays and answers honestly instead of pretending.
      jsonObjectSchema.parse(input)
      result = [
        {
          type: 'json',
          value: {
            errorMessage:
              'Composio is unavailable: it executed exclusively via the SavantCode backend, which does not exist.',
          },
        },
      ]
    } else {
      throw new Error(
        `Tool not implemented in SDK. Please provide an override or modify your agent to not use this tool: ${toolName}`,
      )
    }
  } catch (error) {
    if (isRunPauseError(error)) {
      throw error
    }

    result = [
      {
        type: 'json',
        value: {
          errorMessage:
            error &&
            typeof error === 'object' &&
            'message' in error &&
            typeof error.message === 'string'
              ? error.message
              : typeof error === 'string'
                ? error
                : 'Unknown error',
        },
      },
    ]
  }
  return {
    output: result,
  }
}
