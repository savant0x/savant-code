import { mcpConfigSchema } from '@savant-code/common/types/mcp'
import { describe, expect, mock, test } from 'bun:test'

import definition from '../../../../agents/researcher/researcher-web'
import { getMCPToolData } from '../mcp'
import { getToolSet } from '../tools/prompts'

import type { RequestMcpToolDataFn } from '@savant-code/common/types/contracts/client'

const PAPER_TOOLS = [
  'search_papers',
  'get_papers',
  'find_similar_papers',
  'citation_walk',
] as const

async function buildResearcherTools(
  requestMcpToolData: RequestMcpToolDataFn,
  warn = mock(() => {}),
) {
  const additional = await getMCPToolData({
    toolNames: definition.toolNames ?? [],
    mcpServers: {
      'scholars-search': mcpConfigSchema.parse(
        definition.mcpServers?.['scholars-search'],
      ),
    },
    requestMcpToolData,
    logger: {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn,
      error: mock(() => {}),
    },
  })
  return getToolSet({
    toolNames: definition.toolNames ?? [],
    additionalToolDefinitions: async () => additional,
    agentTools: {},
    skills: {},
  })
}

describe('researcher scholars-search runtime integration', () => {
  test('default MCP exposure reaches the model alongside the native research tools', async () => {
    let discoveries = 0
    const tools = await buildResearcherTools(
      async ({ mcpConfig, toolNames }) => {
        discoveries++
        expect(mcpConfig.type).toBe('http')
        expect(toolNames).toBeNull()
        return PAPER_TOOLS.map((name) => ({
          name,
          description: 'Read-only paper lookup',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        }))
      },
    )

    expect(discoveries).toBe(1)
    expect(Object.keys(tools).sort()).toEqual(
      [
        ...(definition.toolNames ?? []),
        ...PAPER_TOOLS.map((name) => `scholars-search__${name}`),
      ].sort(),
    )
    expect(tools['scholars-search__search_papers'].inputSchema).toBeDefined()
  })

  test('a failed server leaves every native research tool available', async () => {
    const warn = mock(() => {})
    const tools = await buildResearcherTools(async () => {
      throw new Error('literature service unavailable')
    }, warn)

    expect(Object.keys(tools).sort()).toEqual(
      [...(definition.toolNames ?? [])].sort(),
    )
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
