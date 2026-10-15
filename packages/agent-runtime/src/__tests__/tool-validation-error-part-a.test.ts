import { describe, expect, it } from 'bun:test'

import { parseRawToolCall } from '../tools/tool-executor'

describe('tool validation error handling', () => {
  it('should parse repeatedly stringified native tool input before validation', () => {
    const input = {
      path: 'test.ts',
      instructions: 'Writes a test file',
      content: 'console.log("test")\n',
    }

    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'write_file',
        toolCallId: 'double-stringified-tool-call-id',
        input: JSON.stringify(JSON.stringify(input)),
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input).toEqual(input)
    }
  })

  it('should repair bare path values for list_directory string input', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'list_directory',
        toolCallId: 'bare-path-tool-call-id',
        input: '{"path": web/src/app/api/agents}',
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input).toEqual({ path: 'web/src/app/api/agents' })
    }
  })

  it('should repair bare pattern values for glob string input', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'glob',
        toolCallId: 'bare-pattern-tool-call-id',
        input: '{"pattern": backend/src/templates/agents/git-committer.ts}',
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input).toEqual({
        pattern: 'backend/src/templates/agents/git-committer.ts',
      })
    }
  })

  it('should repair bare paths values for read_files string input', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'read_files',
        toolCallId: 'bare-paths-tool-call-id',
        input: '{"paths": sdk/src/client.ts}',
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input).toEqual({ paths: ['sdk/src/client.ts'] })
    }
  })

  it('should not repair bare path values for unrelated tools', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'write_file',
        toolCallId: 'unrelated-bare-path-tool-call-id',
        input: '{"path": web/src/app/api/agents}',
      },
    })

    expect('error' in result).toBe(true)
  })

  it('should parse stringified params for spawn_agents entries', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'spawn_agents',
        toolCallId: 'spawn-agents-stringified-params-tool-call-id',
        input: {
          agents: [
            {
              agent_type: 'basher',
              prompt: 'Run tests',
              params: '{"command":"bun test"}',
            },
          ],
        },
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input.agents[0].params).toEqual({ command: 'bun test' })
    }
  })

  it('should parse stringified params for spawn_agent_inline', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'spawn_agent_inline',
        toolCallId: 'spawn-agent-inline-stringified-params-tool-call-id',
        input: {
          agent_type: 'basher',
          prompt: 'Run tests',
          params: '{"command":"bun test"}',
        },
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input.params).toEqual({ command: 'bun test' })
    }
  })

  it('should accept old_str/new_str aliases for str_replace replacements', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'str_replace',
        toolCallId: 'alias-tool-call-id',
        input: {
          path: 'test.ts',
          replacements: [
            {
              old_str: 'before',
              new_str: 'after',
            },
          ],
        },
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input.replacements).toEqual([
        { oldString: 'before', newString: 'after', allowMultiple: false },
      ])
    }
  })

  it('should accept old/new aliases for str_replace replacements', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'str_replace',
        toolCallId: 'short-alias-tool-call-id',
        input: {
          path: 'test.ts',
          replacements: [
            {
              old: 'before',
              new: 'after',
            },
          ],
        },
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input.replacements).toEqual([
        { oldString: 'before', newString: 'after', allowMultiple: false },
      ])
    }
  })

  it('should accept old_string/new_string aliases for str_replace replacements', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'str_replace',
        toolCallId: 'long-alias-tool-call-id',
        input: {
          path: 'test.ts',
          replacements: [
            {
              old_string: 'before',
              new_string: 'after',
            },
          ],
        },
      },
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.input.replacements).toEqual([
        { oldString: 'before', newString: 'after', allowMultiple: false },
      ])
    }
  })

  it('should summarize missing replacement fields without implying deletion', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'str_replace',
        toolCallId: 'missing-new-tool-call-id',
        input: {
          path: 'test.ts',
          replacements: [
            { oldString: 'before', newString: 'after' },
            { oldString: 'delete me' },
            { oldString: 'delete me too' },
          ],
        },
      },
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain('Missing required replacement fields:')
      expect(result.error).toContain('- replacements[1].newString')
      expect(result.error).toContain('- replacements[2].newString')
      expect(result.error).toContain(
        'If the intent is deletion, set "newString": "" explicitly.',
      )
      expect(result.error).toContain('Raw validation issues:')
    }
  })

  it('should include JSON parse details for incomplete stringified input', () => {
    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'write_file',
        toolCallId: 'incomplete-stringified-tool-call-id',
        input:
          '{"path": ".agents/deep-thinkers/meta-coordinator.ts", "instructions": "Creates a meta-coordinator"',
      },
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain(
        'expected the tool arguments to be an object, but received a string',
      )
      expect(result.error).toContain('Parsing as JSON failed:')
      expect(result.error).toContain(
        'The arguments may be malformed or incomplete',
      )
    }
  })

  it('should explain when parsed tool input remains a string', () => {
    const input = JSON.stringify(
      JSON.stringify(
        JSON.stringify(
          JSON.stringify({
            path: 'test.ts',
            instructions: 'Writes a test file',
            content: 'console.log("test")\n',
          }),
        ),
      ),
    )

    const result = parseRawToolCall({
      rawToolCall: {
        toolName: 'write_file',
        toolCallId: 'over-encoded-tool-call-id',
        input,
      },
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error).toContain(
        'expected the tool arguments to be an object, but received a string',
      )
      expect(result.error).toContain(
        'Parsing succeeded, but the parsed value was still a string',
      )
      expect(result.error).not.toContain('malformed or incomplete')
    }
  })
})
