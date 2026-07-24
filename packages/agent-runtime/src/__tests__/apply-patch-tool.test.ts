import { describe, expect, test } from 'bun:test'

import { handleApplyPatch } from '../tools/handlers/tool/apply-patch'

import type { ProjectFileContext } from '@savant-code/common/util/file'

const mockFileContext: ProjectFileContext = {
  projectRoot: '/test',
  cwd: '/test',
  fileTree: [],
  fileTokenScores: {},
  knowledgeFiles: {},
  userKnowledgeFiles: {},
  agentTemplates: {},
  customToolDefinitions: {},
  gitChanges: {
    status: '',
    diff: '',
    diffCached: '',
    lastCommitMessages: '',
  },
  changesSinceLastChat: {},
  shellConfigFiles: {},
  systemInfo: {
    platform: 'test',
    shell: 'test',
    nodeVersion: 'test',
    arch: 'test',
    homedir: '/home/test',
    cpus: 1,
    chromeAvailable: false,
  },
}

// The full handler signature carries many runtime-only dependencies that are
// irrelevant for input-validation tests, so call through `any`.
async function runApplyPatch(input: unknown) {
  return (handleApplyPatch as any)({
    previousToolCallFinished: Promise.resolve(),
    toolCall: {
      toolCallId: 'test-call-id',
      toolName: 'apply_patch',
      input,
    },
    fileContext: mockFileContext,
    requestClientToolCall: async () => [
      { type: 'json' as const, value: { message: 'client called', applied: [] } },
    ],
  })
}

describe('apply_patch tool validation', () => {
  test('rejects missing operation object', async () => {
    const result = await runApplyPatch({ path: 'src/index.ts', diff: '@@\n- old\n+ new\n' })
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('requires an `operation` object')
  })

  test('rejects invalid operation type', async () => {
    const result = await runApplyPatch({
      operation: { type: 'rename_file', path: 'src/index.ts', diff: '@@\n- old\n+ new\n' },
    })
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('operation.type must be one of')
  })

  test('rejects missing path', async () => {
    const result = await runApplyPatch({
      operation: { type: 'update_file', diff: '@@\n- old\n+ new\n' },
    })
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('operation.path must be a non-empty string')
  })

  test('rejects missing diff for update_file', async () => {
    const result = await runApplyPatch({
      operation: { type: 'update_file', path: 'src/index.ts' },
    })
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('require a non-empty `diff` string')
  })

  test('rejects missing diff for create_file', async () => {
    const result = await runApplyPatch({
      operation: { type: 'create_file', path: 'src/index.ts' },
    })
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('require a non-empty `diff` string')
  })

  test('delete_file without diff does not fail validation', async () => {
    const result = await runApplyPatch({
      operation: { type: 'delete_file', path: 'src/index.ts' },
    })
    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)
    const output = result.output[0]
    expect(output.type).toBe('json')
  })

  test('rejects paths outside project root', async () => {
    const result = await runApplyPatch({
      operation: { type: 'delete_file', path: '/etc/passwd' },
    })
    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { errorMessage: string }
    expect(value.errorMessage).toContain('apply_patch:')
  })

  test('valid create_file reaches the client tool', async () => {
    const result = await (handleApplyPatch as any)({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolCallId: 'test-call-id',
        toolName: 'apply_patch',
        input: {
          operation: {
            type: 'create_file',
            path: 'src/index.ts',
            diff: '@@\n+hello\n',
          },
        },
      },
      fileContext: mockFileContext,
      requestClientToolCall: async () => [
        { type: 'json' as const, value: { message: 'created', applied: [{ file: 'src/index.ts', action: 'add' }] } },
      ],
    })

    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { message: string }
    expect(value.message).toBe('created')
  })

  test('valid update_file reaches the client tool', async () => {
    const result = await (handleApplyPatch as any)({
      previousToolCallFinished: Promise.resolve(),
      toolCall: {
        toolCallId: 'test-call-id',
        toolName: 'apply_patch',
        input: {
          operation: {
            type: 'update_file',
            path: 'src/index.ts',
            diff: '@@\n- old\n+ new\n',
          },
        },
      },
      fileContext: mockFileContext,
      requestClientToolCall: async () => [
        { type: 'json' as const, value: { message: 'updated', applied: [{ file: 'src/index.ts', action: 'update' }] } },
      ],
    })

    expect(result.output).toBeDefined()
    expect(result.output.length).toBeGreaterThan(0)
    const output = result.output[0]
    expect(output.type).toBe('json')
    const value = output.value as { message: string }
    expect(value.message).toBe('updated')
  })
})
