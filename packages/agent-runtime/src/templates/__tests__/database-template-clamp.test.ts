/**
 * FID-2026-0919-013 (SEC-6) — database-sourced templates are capability-
 * clamped at load time. The capability gate reads `template.toolNames`;
 * for published templates that list is authored by an untrusted writer,
 * so "declared" must not equal "granted". Pinned here:
 *
 *   1. Mutation/execution/network tools are stripped from database
 *      templates; read/search/output tools are granted.
 *   2. Unknown tool names fail CLOSED (stripped, not granted).
 *   3. Bundled local templates are NOT clamped (registry only clamps the
 *      database fallback path).
 *   4. The registry's database fallback returns the clamped template
 *      (verified end-to-end through getAgentTemplate).
 */
import { describe, expect, test } from 'bun:test'

import { getAgentTemplate } from '../agent-registry'
import {
  clampDatabaseTemplateCapabilities,
  clampDatabaseTemplateToolNames,
} from '../database-template-clamp'

import type { AgentTemplate } from '../types'

function makeTemplate(overrides: Partial<AgentTemplate>): AgentTemplate {
  return {
    id: 'publisher/agent',
    displayName: 'Publisher Agent',
    spawnerPrompt: 'spawn',
    model: 'test-model',
    inputSchema: {},
    outputMode: 'last_message' as const,
    includeMessageHistory: false,
    inheritParentSystemPrompt: false,
    mcpServers: {},
    toolNames: [],
    spawnableAgents: [],
    systemPrompt: 'system',
    instructionsPrompt: 'instructions',
    stepPrompt: 'step',
    ...overrides,
  }
}

function makeNoopLogger(warn?: (...args: unknown[]) => void): never {
  const logger = {
    debug: () => {},
    info: () => {},
    warn: warn ?? (() => {}),
    error: () => {},
    trace: () => {},
    child: () => logger,
  }
  return logger as never
}

const noopLogger = makeNoopLogger()

describe('clampDatabaseTemplateToolNames (FID-2026-0919-013)', () => {
  test('strips mutation/execution tools, grants read/search/output tools', () => {
    const { toolNames, stripped } = clampDatabaseTemplateToolNames(
      makeTemplate({
        toolNames: [
          'read_files',
          'write_file',
          'code_search',
          'run_terminal_command',
          'end_turn',
        ],
      }),
    )
    expect(toolNames.sort()).toEqual(['code_search', 'end_turn', 'read_files'])
    expect(stripped.sort()).toEqual(['run_terminal_command', 'write_file'])
  })

  test('unknown tool names fail closed (stripped, never granted)', () => {
    const { toolNames, stripped } = clampDatabaseTemplateToolNames(
      makeTemplate({ toolNames: ['brand_new_dangerous_tool', 'glob'] }),
    )
    expect(toolNames).toEqual(['glob'])
    expect(stripped).toEqual(['brand_new_dangerous_tool'])
  })
})

describe('clampDatabaseTemplateCapabilities (FID-2026-0919-013)', () => {
  test('returns a template whose toolNames are the granted subset and warns', () => {
    const warnings: unknown[][] = []
    const logger = makeNoopLogger((...args: unknown[]) => {
      warnings.push(args)
    })
    const clamped = clampDatabaseTemplateCapabilities(
      makeTemplate({ toolNames: ['read_files', 'write_file'] }),
      logger,
    )
    expect(clamped.toolNames).toEqual(['read_files'])
    expect(warnings).toHaveLength(1)
  })
})

describe('registry wiring (FID-2026-0919-013)', () => {
  test('database fallback returns a clamped template; local templates are untouched', async () => {
    const databaseAgentCache = new Map()
    const fetchAgentFromDatabase = async () =>
      makeTemplate({
        id: 'publisher/agent',
        toolNames: ['read_files', 'write_file', 'run_terminal_command'],
      })
    const localAgentTemplates = {
      'local/agent': makeTemplate({
        id: 'local/agent',
        toolNames: ['read_files', 'write_file'],
      }),
    }

    const dbTemplate = await getAgentTemplate({
      agentId: 'publisher/agent',
      localAgentTemplates: {},
      databaseAgentCache,
      logger: noopLogger,
      fetchAgentFromDatabase,
    } as never)
    // SEC-6 core assertion: the DB template does NOT get its declared
    // write/terminal capabilities.
    expect(dbTemplate?.toolNames).not.toContain('write_file')
    expect(dbTemplate?.toolNames).not.toContain('run_terminal_command')
    expect(dbTemplate?.toolNames).toContain('read_files')

    // Local bundled templates pass through unclamped.
    const localTemplate = await getAgentTemplate({
      agentId: 'local/agent',
      localAgentTemplates,
      databaseAgentCache,
      logger: noopLogger,
      fetchAgentFromDatabase: async () => {
        throw new Error('must not be called for local templates')
      },
    } as never)
    expect(localTemplate?.toolNames).toEqual(['read_files', 'write_file'])
  })
})
