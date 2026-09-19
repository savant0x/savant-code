import { describe, expect, it } from 'bun:test'

import { EchoEnforcement } from '../enforcement'

/**
 * FID-2026-0919-015: Law 3 verification crediting is outcome-aware.
 *
 * Contract pinned here:
 * - commandSucceeded === true  → dirty files credit (unchanged grant path)
 * - commandSucceeded === false → NO credit, no advisory (failure is already
 *   visible in the transcript as the tool result)
 * - commandSucceeded === undefined → NO credit + steering advisory
 *   (fail-closed visibility, consistent with ZTAP enforce / unknown-tool
 *   strip norms)
 * - Law 4 grep crediting is untouched (separate counter, separate law)
 */

function sessionWithOneDirtyFile(): EchoEnforcement {
  const enforcement = new EchoEnforcement('hybrid')
  // Satisfy the session-init gate.
  enforcement.beforeToolCall({
    toolName: 'read_files',
    input: { paths: ['ECHO.md'] },
    agentId: 'savant',
  })
  enforcement.afterToolCall({
    toolName: 'write_file',
    input: { path: '/proj/src/mod.ts' },
    result: { text: 'ok' },
    writeSucceeded: true,
  })
  return enforcement
}

describe('Law 3 verification credit is outcome-aware (FID-2026-0919-015)', () => {
  it('SUCCESSFUL verification command credits dirty files', () => {
    const enforcement = sessionWithOneDirtyFile()
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { text: 'ok' },
      commandSucceeded: true,
    })
    expect(result.warnings).toHaveLength(0)
    expect(enforcement.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(
      true,
    )
  })

  it('FAILED verification command does NOT credit and stays silent', () => {
    const enforcement = sessionWithOneDirtyFile()
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: { error: 'error TS2307: Cannot find module' },
      commandSucceeded: false,
    })
    expect(result.warnings).toHaveLength(0)
    expect(enforcement.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(
      false,
    )
  })

  it('UNKNOWN outcome does NOT credit and emits the steering advisory', () => {
    const enforcement = sessionWithOneDirtyFile()
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'bun run typecheck' },
      result: {},
    })
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('outcome is unknown')
    expect(result.warnings[0].law).toBe(3)
    expect(enforcement.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(
      false,
    )
  })

  it('unknown outcome on a NON-verification command emits no advisory', () => {
    const enforcement = sessionWithOneDirtyFile()
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'ls -la' },
      result: {},
    })
    expect(result.warnings).toHaveLength(0)
  })

  it('FAILED run_terminal_command typecheck does not credit either', () => {
    const enforcement = sessionWithOneDirtyFile()
    enforcement.afterToolCall({
      toolName: 'run_terminal_command',
      input: { command: 'bun run typecheck' },
      result: { error: 'TS errors' },
      commandSucceeded: false,
    })
    expect(enforcement.getState().verifiedFiles.has('/proj/src/mod.ts')).toBe(
      false,
    )
  })

  it('Law 4 grep crediting is untouched by the outcome policy (regression guard)', () => {
    const enforcement = sessionWithOneDirtyFile()
    enforcement.afterToolCall({
      toolName: 'write_file',
      input: { path: '/proj/src/feature.ts' },
      result: {},
      writtenContent: 'export const helper = 1\n',
      writeSucceeded: true,
    })
    // Unknown outcome — grep crediting ignores outcome signals entirely.
    const result = enforcement.afterToolCall({
      toolName: 'run_readonly_command',
      input: { command: 'grep -rn "helper" packages/agent-runtime/src' },
      result: {},
    })
    expect(result.warnings).toHaveLength(0)
    expect(enforcement.getState().featuresVerified.size).toBe(1)
  })
})
