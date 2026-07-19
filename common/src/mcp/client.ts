import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import { getErrorObject } from '../util/error'

import type { MCPConfig } from '../types/mcp'
import type { ToolResultOutput } from '../types/messages/content-part'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  BlobResourceContents,
  CallToolResult,
  TextResourceContents,
} from '@modelcontextprotocol/sdk/types.js'

// Cap on how much of a failed stdio server's stderr we retain for the error
// message — enough to show the real failure without unbounded growth.
const STDERR_BUFFER_CAP = 8192

// Default timeout values (ms)
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000
const DEFAULT_TOOL_TIMEOUT_MS = 60_000

// Hard cap — user-configured timeout is clamped to this ceiling.
const MAX_TIMEOUT_MS = 300_000

const runningClients: Record<string, Client> = {}
const listToolsCache: Record<
  string,
  ReturnType<typeof Client.prototype.listTools>
> = {}

// Per-client timeout for tool calls and listTools. Populated on successful
// connect so that callMCPTool / listMCPTools can look it up by clientId.
const clientTimeouts: Record<string, number> = {}

/**
 * Races a promise against a timeout. Rejects with a timeout Error if the
 * promise does not settle within `ms` milliseconds. The timer is always
 * cleared (via .finally) to avoid leaks when the promise wins the race.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timer),
  )
}

/**
 * Clamps a user-supplied timeout to [1, MAX_TIMEOUT_MS].
 * Returns the default if the input is undefined.
 */
function clampTimeout(
  value: number | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue
  return Math.min(Math.max(Math.round(value), 1), MAX_TIMEOUT_MS)
}

/**
 * Substitutes environment variable references ($VAR_NAME) in a string with their values.
 * Supports both simple replacement ("$VAR_NAME") and interpolation ("Bearer $VAR_NAME").
 */
function substituteEnvInValue(value: string): string {
  return value.replace(/\$([A-Z_][A-Z0-9_]*)/g, (match, varName) => {
    const envValue = process.env[varName]
    if (envValue === undefined) {
      // Return original if env var not found
      return match
    }
    return envValue
  })
}

/**
 * Substitutes environment variable references in all values of a record.
 */
function substituteEnvInRecord(
  record: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = substituteEnvInValue(value)
  }
  return result
}

function hashConfig(config: MCPConfig): string {
  if (config.type === 'stdio') {
    return JSON.stringify({
      command: config.command,
      args: config.args,
      env: config.env,
    })
  }
  if (config.type === 'http') {
    return JSON.stringify({
      type: 'http',
      url: config.url,
      params: config.params,
    })
  }
  if (config.type === 'sse') {
    return JSON.stringify({
      type: 'sse',
      url: config.url,
      params: config.params,
    })
  }
  config.type satisfies never
  throw new Error(
    `Internal error in hashConfig: invalid MCP config type ${config.type}`,
  )
}

export async function getMCPClient(config: MCPConfig): Promise<string> {
  let key = hashConfig(config)
  if (key in runningClients) {
    return key
  }

  let transport: Transport
  // Buffer the child process's stderr so that a server which crashes during
  // startup produces an actionable error instead of the opaque MCP SDK message
  // "MCP error -32000: Connection closed".
  let stderrBuffer = ''
  if (config.type === 'stdio') {
    const stdioTransport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: substituteEnvInRecord(config.env),
      stderr: 'pipe',
    })
    // When stderr is 'pipe' the SDK exposes a PassThrough immediately (before
    // the process is spawned), so attaching here captures even early output
    // from a child that dies during the connection handshake.
    stdioTransport.stderr?.on('data', (chunk: Buffer) => {
      if (stderrBuffer.length < STDERR_BUFFER_CAP) {
        stderrBuffer += chunk.toString('utf8')
      }
    })
    transport = stdioTransport
  } else {
    const url = new URL(config.url)
    for (const [key, value] of Object.entries(config.params)) {
      url.searchParams.set(key, value)
    }
    const headers = substituteEnvInRecord(config.headers)
    if (config.type === 'http') {
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers,
        },
      })
    } else if (config.type === 'sse') {
      transport = new SSEClientTransport(url, {
        requestInit: {
          headers,
        },
      })
    } else {
      config.type satisfies never
      throw new Error(`Internal error: invalid MCP config type ${config.type}`)
    }
  }

  const client = new Client({
    name: 'savant-code',
    version: '1.0.0',
  })

  const connectTimeoutMs = clampTimeout(
    config.timeout,
    DEFAULT_CONNECT_TIMEOUT_MS,
  )

  try {
    await withTimeout(
      client.connect(transport),
      connectTimeoutMs,
      `MCP connection timed out after ${connectTimeoutMs}ms`,
    )
  } catch (error) {
    // Clean up the transport to prevent orphaned child processes (stdio)
    // or dangling network sockets (http/sse). This also handles the race
    // condition where connect() resolves after the timeout — the transport
    // is dead so the client will be safely GC'd.
    try {
      await transport.close()
    } catch {
      // Ignore close errors — we're already in the error path.
    }

    const baseMessage = getErrorObject(error).message
    if (config.type === 'stdio') {
      const commandStr = [config.command, ...(config.args ?? [])].join(' ')
      const detail = stderrBuffer.trim()
      throw new Error(
        `${baseMessage}. Failed to start MCP server via \`${commandStr}\`. ` +
          `Ensure the command is installed and runnable (e.g. an up-to-date ` +
          `node/npm/npx, or python/uvx) and that any required env vars are set.` +
          (detail ? `\nServer stderr:\n${detail}` : ''),
      )
    }
    throw new Error(
      `${baseMessage}. Failed to connect to MCP server at ${config.url}.`,
    )
  }
  runningClients[key] = client
  clientTimeouts[key] = clampTimeout(config.timeout, DEFAULT_TOOL_TIMEOUT_MS)

  return key
}

export function listMCPTools(
  clientId: string,
  ...args: Parameters<typeof Client.prototype.listTools>
): ReturnType<typeof Client.prototype.listTools> {
  const client = runningClients[clientId]
  if (!client) {
    throw new Error(`listTools: client not found with id: ${clientId}`)
  }
  if (!listToolsCache[clientId]) {
    const timeoutMs = clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS
    listToolsCache[clientId] = withTimeout(
      client.listTools(...args),
      timeoutMs,
      `MCP listTools timed out after ${timeoutMs}ms`,
    ).catch((error) => {
      // Clear the cached rejected promise so the next call retries
      // instead of permanently returning the same timeout error.
      delete listToolsCache[clientId]
      throw error
    })
  }
  return listToolsCache[clientId]
}

function getResourceData(
  resource: TextResourceContents | BlobResourceContents,
): string {
  if ('text' in resource) return resource.text as string
  if ('blob' in resource) return resource.blob as string
  return ''
}

export async function callMCPTool(
  clientId: string,
  ...args: Parameters<typeof Client.prototype.callTool>
): Promise<ToolResultOutput[]> {
  const client = runningClients[clientId]
  if (!client) {
    throw new Error(`callTool: client not found with id: ${clientId}`)
  }

  const timeoutMs = clientTimeouts[clientId] ?? DEFAULT_TOOL_TIMEOUT_MS
  const callResult = await withTimeout(
    client.callTool(...args),
    timeoutMs,
    `MCP tool call timed out after ${timeoutMs}ms`,
  )
  const result = callResult as CallToolResult
  const content = result.content

  return content.map((c: (typeof content)[number]) => {
    if (c.type === 'text') {
      return {
        type: 'json',
        value: c.text,
      } satisfies ToolResultOutput
    }
    if (c.type === 'audio') {
      return {
        type: 'media',
        data: c.data,
        mediaType: c.mimeType,
      } satisfies ToolResultOutput
    }
    if (c.type === 'image') {
      return {
        type: 'media',
        data: c.data,
        mediaType: c.mimeType,
      } satisfies ToolResultOutput
    }
    if (c.type === 'resource') {
      return {
        type: 'media',
        data: getResourceData(c.resource),
        mediaType: c.resource.mimeType ?? 'text/plain',
      } satisfies ToolResultOutput
    }
    const fallbackValue =
      'uri' in c && typeof (c as { uri: unknown }).uri === 'string'
        ? (c as { uri: string }).uri
        : JSON.stringify(c)
    return {
      type: 'json',
      value: fallbackValue,
    } satisfies ToolResultOutput
  })
}
