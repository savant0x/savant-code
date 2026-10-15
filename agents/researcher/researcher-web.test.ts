import { describe, expect, test } from 'bun:test'

import definition from './researcher-web'

/**
 * FID-2026-1012-001: the researcher persona must carry the converged
 * remote-HTTP MCP contract for the public Scholars Reading List search
 * service — no key, read-only tools, and the usage discipline named in
 * the system prompt. The MCP server itself is exercised over the wire in
 * live integration; here we lock the definition shape (the part Savant
 * owns), the same contract agents/github/github.test.ts pins.
 */
describe('researcher-web agent definition', () => {
  test('keeps its native research tools and adds no write surface', () => {
    expect(definition.id).toBe('researcher-web')
    expect(definition.includeMessageHistory).toBe(false)
    expect(definition.spawnableAgents ?? []).toEqual([])
    expect(definition.toolNames).toEqual(
      expect.arrayContaining(['web_search', 'read_url', 'deep_research']),
    )
    for (const tool of definition.toolNames ?? []) {
      expect(tool).not.toMatch(/write|create|delete|edit/)
    }
  })

  test('wires the public scholars-search MCP server over remote HTTP', () => {
    const mcp = definition.mcpServers?.['scholars-search']
    expect(mcp).toBeDefined()
    expect(mcp?.type).toBe('http')
    if (!mcp || mcp.type !== 'http') {
      throw new Error('expected a remote http MCP config')
    }
    expect(mcp.url).toBe('https://api.sciencemadereadable.com/mcp')
    // No key: the public endpoint requires no auth, so no secret surface.
    expect(mcp.headers ?? {}).toEqual({})
  })

  test('names the four MCP tools and the usage discipline in the system prompt', () => {
    const prompt = definition.systemPrompt ?? ''
    for (const tool of [
      'scholars-search__search_papers',
      'scholars-search__get_papers',
      'scholars-search__find_similar_papers',
      'scholars-search__citation_walk',
    ]) {
      expect(prompt).toContain(tool)
    }
    expect(prompt).toContain('30 tool calls per minute')
    expect(prompt).toContain('never from memory')
  })

  test('routes literature through MCP before applying the web research workflow', () => {
    const instructions = definition.instructionsPrompt ?? ''
    expect(instructions).toContain('For scholarly literature questions')
    expect(instructions).toContain('fetched paper records')
    expect(instructions).toContain('For web research questions')
    expect(instructions).toContain('For web-based answers')
    expect(instructions).not.toContain(
      'HARD RULE: You may not write your final answer',
    )
  })

  test('uses the MCP parameter names and values rather than HTTP search arguments', () => {
    const prompt = definition.systemPrompt ?? ''
    expect(prompt).toContain('abstracts="none"')
    expect(prompt).toContain('abstracts="full"')
    expect(prompt).toContain('limit=10-20')
    expect(prompt).toContain('breadth=20-30')
    expect(prompt).not.toContain('abstracts=false')
    expect(prompt).not.toContain('k=')
  })
})
