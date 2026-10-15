/* eslint-disable @typescript-eslint/no-explicit-any -- variance, not laziness (W3-3): a tool call's `input` arrives as a union of ~20 tool-input shapes carrying `unknown` index signatures (`packages/agent-runtime/src/tools/tool-executor/client-tool-bridge.ts`) and must flow into a `Record<string, JSONValue>` action (`sdk/src/run/agent-runtime-impl.ts`); `Record<string, unknown>` fails the consumer and `Record<string, JSONValue>` fails every producer, so only `any` satisfies both ends of this boundary. Narrowing it requires editing those two files, which are outside this record's write surface. */
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
  /** LF-001 (FID-2026-1012-007): 1-indexed line window. The responder owns
   *  the window — the read tool's fetch boundary must select these lines
   *  BEFORE it caps the response, or a window past the cap is unreachable. */
  offset?: number
  limit?: number
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
