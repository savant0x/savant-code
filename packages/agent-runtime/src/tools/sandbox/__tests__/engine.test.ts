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

  it('prompts for destructive run_terminal_command in prompt mode', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      policy: policy('prompt'),
    })
    expect(decision.type).toBe('prompt')
  })

  it('allows destructive command in unsafe mode', () => {
    const decision = evaluateToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'rm -rf /' },
      policy: policy('unsafe'),
    })
    expect(decision.type).toBe('allow')
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

  it('allows network tools when network is enabled', () => {
    const decision = evaluateToolCall({
      toolName: 'web_search',
      input: { query: 'test' },
      policy: policy('safe'),
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
