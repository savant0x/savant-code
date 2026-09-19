import { describe, expect, it } from 'bun:test'

import { evaluateToolCall, createDefaultSandboxPolicy } from '../engine'

const projectRoot = '/test/project'

const policy = (mode: 'safe' | 'prompt' | 'unsafe' = 'prompt') =>
  createDefaultSandboxPolicy(projectRoot, mode)

describe('sandbox engine', () => {
  it('allows read_files', () => {
    const decision = evaluateToolCall({
      toolName: 'read_files',
      input: { paths: ['src/index.ts'] },
      policy: policy(),
    })
    expect(decision.type).toBe('allow')
  })

  it('allows write_file', () => {
    const decision = evaluateToolCall({
      toolName: 'write_file',
      input: { path: 'src/foo.ts', content: '' },
      policy: policy(),
    })
    expect(decision.type).toBe('allow')
  })

  it('prompts for run_terminal_command in prompt mode', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'bun test' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('prompt')
  })

  it('denies destructive run_terminal_command in safe mode', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      policy: policy('safe'),
    })
    expect(decision.type).toBe('deny')
  })

  // FID-2026-0919-014 (SEC-7): the destructive-command floor applies in
  // EVERY permission mode — deny, not prompt — because an operator who
  // relaxes sandbox policy did not opt out of machine destruction.
  it('denies destructive run_terminal_command in prompt mode (floor)', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('deny')
    if (decision.type === 'deny') {
      expect(decision.reason).toContain('FID-2026-0919-014')
    }
  })

  it('denies destructive command in unsafe mode (floor)', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      policy: policy('unsafe'),
    })
    expect(decision.type).toBe('deny')
  })

  it('denies destructive readonly command (floor reaches the readonly tool)', () => {
    const decision = evaluateToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'dd if=image.iso of=/dev/sda' },
      policy: policy('unsafe'),
    })
    expect(decision.type).toBe('deny')
  })

  it('denies network tools when network is disabled', () => {
    const p = policy('safe')
    p.allowNetwork = false
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: p,
    })
    expect(decision.type).toBe('deny')
  })

  it('denies network tools in safe mode by default', () => {
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: policy('safe'),
    })
    expect(decision.type).toBe('deny')
  })

  it('allows network tools when network is explicitly enabled', () => {
    const p = policy('safe')
    p.allowNetwork = true
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: p,
    })
    expect(decision.type).toBe('allow')
  })

  // FID-2026-0909-004: outbound-read research tools (registry
  // permission 'allow') run in prompt mode — the registry taxonomy governs,
  // not a blanket network prompt.
  it('allows network+allow research tools in prompt mode', () => {
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('allow')
  })

  // FID-2026-0909-004: state-changing network tools keep the approval path.
  it('still prompts for network+prompt tools in prompt mode', () => {
    const decision = evaluateToolCall({
      toolName: 'composio_manage_connections',
      input: {},
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('prompt')
  })

  it('allows network tools in unsafe mode', () => {
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: policy('unsafe'),
    })
    expect(decision.type).toBe('allow')
  })

  it('prompts for network tools with prompt permission in prompt mode', () => {
    const decision = evaluateToolCall({
      toolName: 'composio_multi_execute_tool',
      input: { tool: 'test' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('prompt')
  })

  it('allows network tools in unsafe mode even if allowNetwork is false', () => {
    const p = policy('unsafe')
    p.allowNetwork = false
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: p,
    })
    expect(decision.type).toBe('allow')
  })

  it('prompts for unknown tools', () => {
    const decision = evaluateToolCall({
      toolName: 'custom_mcp_tool',
      input: { arg: 'value' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('prompt')
  })

  it('denies unknown tools in safe mode', () => {
    const decision = evaluateToolCall({
      toolName: 'custom_mcp_tool',
      input: { arg: 'value' },
      policy: policy('safe'),
    })
    expect(decision.type).toBe('deny')
  })

  it('allows read-only shell commands', () => {
    const decision = evaluateToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'git status' },
      policy: policy('safe'),
    })
    expect(decision.type).toBe('allow')
  })

  it('denies destructive read-only shell commands', () => {
    const decision = evaluateToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'rm -rf /' },
      policy: policy('safe'),
    })
    expect(decision.type).toBe('deny')
  })
})
