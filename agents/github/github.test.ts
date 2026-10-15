import { describe, expect, test } from 'bun:test'

import definition from './github'

/**
 * FID-2026-0804-003 testing gate: the github helper agent's definition must
 * carry the converged remote-HTTP MCP contract — read-only default, Bearer
 * token from the canonical env var, and only loop primitives as native tools.
 * The MCP server itself is mocked by the harness client in integration tests;
 * here we lock the definition shape (the part Savant owns).
 */
describe('github agent definition', () => {
  test('is an infra helper with loop-primitive toolNames only', () => {
    expect(definition.id).toBe('github')
    expect(definition.includeMessageHistory).toBe(false)
    expect(definition.spawnableAgents ?? []).toEqual([])
    // No native write tools: set_output/add_message are loop primitives.
    expect(definition.toolNames).toEqual(
      expect.arrayContaining(['set_output', 'add_message']),
    )
    for (const tool of definition.toolNames ?? []) {
      expect(tool).not.toMatch(/write|create|delete|merge|push/)
    }
  })

  test('uses the remote HTTP MCP route with the canonical env token', () => {
    const mcp = definition.mcpServers?.github
    expect(mcp).toBeDefined()
    expect(mcp?.type).toBe('http')
    if (!mcp || mcp.type !== 'http') {
      throw new Error('expected a remote http MCP config')
    }
    expect(mcp.url).toBe('https://api.githubcopilot.com/mcp/')
    // $VAR interpolation is performed by the harness MCP client
    // (common/src/mcp/client.ts substituteEnvInValue supports "Bearer $VAR").
    expect(mcp.headers?.Authorization).toBe('Bearer $SAVANT_CODE_GITHUB_TOKEN')
  })

  test('surfaces the documented tool groups in the system prompt', () => {
    const prompt = definition.systemPrompt ?? ''
    for (const tool of [
      'search_code',
      'get_pull_request',
      'create_pull_request_review',
      'issue_read',
      'issue_write',
      'get_workflow_run',
      'get_job_logs',
      'get_code_scanning_alert',
      'list_code_scanning_alerts',
    ]) {
      expect(prompt).toContain(tool)
    }
  })
})
