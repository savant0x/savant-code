import { describe, expect, it } from 'bun:test'

import { parseTextWithToolCalls } from '../parse-tool-calls-from-text'

// FID-2026-0819-005 Loop 207: parseTextWithToolCalls suite moved verbatim
// from parse-tool-calls-from-text.test.ts.

describe('parseTextWithToolCalls', () => {
  it('should parse interleaved text and tool calls', () => {
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
  "cb_tool_name": "write_file",
  "path": "file2.ts",
  "content": "test"
}
</savant_code_tool_call>

Some commentary after`

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({ type: 'text', text: 'Some commentary before' })
    expect(result[1]).toEqual({
      type: 'tool_call',
      toolName: 'read_files',
      input: { paths: ['file1.ts'] },
    })
    expect(result[2]).toEqual({ type: 'text', text: 'Some text between' })
    expect(result[3]).toEqual({
      type: 'tool_call',
      toolName: 'write_file',
      input: { path: 'file2.ts', content: 'test' },
    })
    expect(result[4]).toEqual({ type: 'text', text: 'Some commentary after' })
  })

  it('should return only tool call when no surrounding text', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"]
}
</savant_code_tool_call>`

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'tool_call',
      toolName: 'read_files',
      input: { paths: ['test.ts'] },
    })
  })

  it('should return only text when no tool calls', () => {
    const text = 'Just some regular text without any tool calls'

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      type: 'text',
      text: 'Just some regular text without any tool calls',
    })
  })

  it('should return empty array for empty string', () => {
    const result = parseTextWithToolCalls('')

    expect(result).toHaveLength(0)
  })

  it('should handle text only before tool call', () => {
    const text = `Introduction text

<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"]
}
</savant_code_tool_call>`

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ type: 'text', text: 'Introduction text' })
    expect(result[1].type).toBe('tool_call')
  })

  it('should handle text only after tool call', () => {
    const text = `<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"]
}
</savant_code_tool_call>

Conclusion text`

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(2)
    expect(result[0].type).toBe('tool_call')
    expect(result[1]).toEqual({ type: 'text', text: 'Conclusion text' })
  })

  it('should skip malformed tool calls but keep surrounding text', () => {
    const text = `Before text

<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"
}
</savant_code_tool_call>

After text`

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ type: 'text', text: 'Before text' })
    expect(result[1]).toEqual({ type: 'text', text: 'After text' })
  })

  it('should trim whitespace from text segments', () => {
    const text = `   
  Text with whitespace  
  
   
<savant_code_tool_call>
{
  "cb_tool_name": "read_files",
  "paths": ["test.ts"]
}
</savant_code_tool_call>
   
  More text  
   `

    const result = parseTextWithToolCalls(text)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ type: 'text', text: 'Text with whitespace' })
    expect(result[1].type).toBe('tool_call')
    expect(result[2]).toEqual({ type: 'text', text: 'More text' })
  })
})
