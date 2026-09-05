import { describe, expect, it } from 'bun:test'

import { parseToolCallsFromText } from '../parse-tool-calls-from-text'

describe('parseToolCallsFromText', () => {
  it('should parse a single tool call', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"]
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      toolName: 'read_files',
      input: { paths: ['test.ts'] },
    })
  })

  it('should parse multiple tool calls', () => {
    const text = `Some commentary before

<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["file1.ts"]
}
</savant_code_tool_call>

Some text between

<savant_code_tool_call>
{
  "cb_tool_name": "str_replace",
  "path": "file1.ts",
  "replacements": [{"oldString": "foo", "newString": "bar"}]
}
</savant_code_tool_call>

Some commentary after`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      toolName: 'read_files',
      input: { paths: ['file1.ts'] },
    })
    expect(result[1]).toEqual({
      toolName: 'str_replace',
      input: {
        path: 'file1.ts',
        replacements: [{ oldString: 'foo', newString: 'bar' }],
      },
    })
  })

  it('should remove cb_tool_name from input', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "write_file",
  "path": "test.ts",
  "content": "console.log('hello')"
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0].input).not.toHaveProperty('cb_tool_name')
    expect(result[0].input).toEqual({
      path: 'test.ts',
      content: "console.log('hello')",
    })
  })

  it('should remove cb_easp from input', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"],
  "cb_easp": true
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0].input).not.toHaveProperty('cb_easp')
    expect(result[0].input).toEqual({ paths: ['test.ts'] })
  })

  it('should skip malformed JSON', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"
}
</savant_code_tool_call>

<savant_code_tool_call>
{
  "cb_tool_name": "write_file",
  "path": "good.ts",
  "content": "valid"
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0].toolName).toBe('write_file')
  })

  it('should skip tool calls without cb_tool_name', () => {
    const text = `<savant_code_tool_call>
{
  "paths": ["test.ts"]
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(0)
  })

  it('should return empty array for text without tool calls', () => {
    const text = 'Just some regular text without any tool calls'

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(0)
  })

  it('should return empty array for empty string', () => {
    const result = parseToolCallsFromText('')

    expect(result).toHaveLength(0)
  })

  it('should handle complex nested objects in input', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "spawn_agents",
  "agents": [
    {
      "agent_type": "scout",
      "prompt": "Find relevant files"
    },
    {
      "agent_type": "code-searcher",
      "params": {
        "searchQueries": [
          {"pattern": "function test"}
        ]
      }
    }
  ]
}
</savant_code_tool_call>`

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0].toolName).toBe('spawn_agents')
    expect(result[0].input.agents).toHaveLength(2)
  })

  it('should handle tool calls with escaped characters in strings', () => {
    const text =
      '<savant_code_tool_call>\n' +
      '{\n' +
      '  "cb_tool_name": "str_replace",\n' +
      '  "path": "test.ts",\n' +
      '  "replacements": [{"oldString": "console.log(\\"hello\\")", "newString": "console.log(\'world\')"}]\n' +
      '}\n' +
      '</savant_code_tool_call>'

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    const replacements = result[0].input.replacements as Array<{
      oldString: string
      newString: string
    }>
    expect(replacements[0].oldString).toBe('console.log("hello")')
  })

  it('should handle tool calls with newlines in content', () => {
    const text =
      '<savant_code_tool_call>\n' +
      '{\n' +
      '  "cb_tool_name": "write_file",\n' +
      '  "path": "test.ts",\n' +
      '  "content": "line1\\nline2\\nline3"\n' +
      '}\n' +
      '</savant_code_tool_call>'

    const result = parseToolCallsFromText(text)

    expect(result).toHaveLength(1)
    expect(result[0].input.content).toBe('line1\nline2\nline3')
  })
})
