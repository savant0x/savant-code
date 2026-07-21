/* eslint-disable @typescript-eslint/no-explicit-any -- contract type: dynamic tool input/output shapes */
import type { ServerAction } from '../../actions'
import type { JSONValue } from '../json'
import type { MCPConfig } from '../mcp'
import type { ToolResultOutput } from '../messages/content-part'

export type RequestToolCallFn = (params: {
  userInputId: string
  toolName: string
  input: Record<string, any> & { timeout_seconds?: number }
  mcpConfig?: MCPConfig
}) => Promise<{
  output: ToolResultOutput[]
}>

export type RequestMcpToolDataFn = (params: {
  mcpConfig: MCPConfig
  toolNames: string[] | null
}) => Promise<
  {
    name: string
    description?: string
    inputSchema: JSONValue
  }[]
>

export type RequestFilesFn = (params: {
  filePaths: string[]
}) => Promise<Record<string, string | null>>

export type RequestOptionalFileFn = (params: {
  filePath: string
}) => Promise<string | null>

export type SendSubagentChunkFn = (params: {
  userInputId: string
  agentId: string
  agentType: string
  chunk: string
  prompt?: string | undefined
  forwardToPrompt?: boolean
}) => void

export type HandleStepsLogChunkFn = (params: {
  userInputId: string
  runId: string
  level: 'debug' | 'info' | 'warn' | 'error'
  data: JSONValue
  message?: string
}) => void

export type SendActionFn = (params: { action: ServerAction }) => void
