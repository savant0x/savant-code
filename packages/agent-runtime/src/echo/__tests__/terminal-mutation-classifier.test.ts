/**
 * FID-2026-1001-003 step 1: the mutation classifier. Enforcement selected
 * by tool NAME; one `sed -i` / `>` / `git checkout` mutated the tree with
 * no record for Law 1 (read-before-touch), Law 3 (verify-before-proceed),
 * or Law 15 (turn-end verification). Classification is now by EFFECT:
 * write-path tools and BOTH shell tools classify through ONE code path.
 *
 * Pipeline-level behavior (gate blocking, tracking-set recording, turn-end
 * blocking) lives in `terminal-bypass-pipeline.test.ts`.
 */
import { describe, expect, it } from 'bun:test'

import { classifyMutation } from '../enforcement/helpers'

describe('classifyMutation (FID-2026-1001-003 step 1)', () => {
  it('write-path tools classify targeted with their path', () => {
    expect(
      classifyMutation({
        toolName: 'write_file',
        params: { path: '/proj/src/a.ts', content: 'x' },
      }),
    ).toEqual({ mutates: true, targets: ['/proj/src/a.ts'], scope: 'targeted' })
    expect(
      classifyMutation({
        toolName: 'str_replace',
        params: { path: '/proj/src/a.ts', oldString: 'a', newString: 'b' },
      }),
    ).toEqual({ mutates: true, targets: ['/proj/src/a.ts'], scope: 'targeted' })
  })

  it('the canonical bypass commands classify mutating', () => {
    const commands = [
      "sed -i 's/a/b/' src/mod.ts",
      'git checkout -- src/mod.ts',
      'git reset --hard',
      'echo hi > src/out.txt',
      'bun test 2>err.log',
      'bun test | tee src/out.log',
      'rm src/legacy.ts',
    ]
    for (const command of commands) {
      const result = classifyMutation({
        toolName: 'run_terminal_command',
        params: { command },
      })
      expect(result.mutates).toBe(true)
    }
  })

  it('redirection extracts its target path', () => {
    const result = classifyMutation({
      toolName: 'run_terminal_command',
      params: { command: 'echo hi > src/out.txt' },
    })
    expect(result.mutates).toBe(true)
    expect(result.targets).toEqual(['src/out.txt'])
    expect(result.scope).toBe('targeted')
  })

  it('in-place edit targets the operand file', () => {
    const result = classifyMutation({
      toolName: 'run_terminal_command',
      params: { command: "sed -i 's/a/b/' src/mod.ts" },
    })
    expect(result.mutates).toBe(true)
    expect(result.targets).toEqual(['src/mod.ts'])
  })

  it('a quoted in-place operand loses its quotes', () => {
    const result = classifyMutation({
      toolName: 'run_terminal_command',
      params: { command: 'sed -i \'1s/a/b/\' "my file.ts"' },
    })
    expect(result.mutates).toBe(true)
    expect(result.targets).toContain('my file.ts')
  })

  it('unresolvable mutation targets defer to the worktree backstop (tree scope)', () => {
    expect(
      classifyMutation({
        toolName: 'run_terminal_command',
        params: { command: 'git reset --hard' },
      }),
    ).toEqual({ mutates: true, targets: [], scope: 'tree' })
  })

  it('batch commands classify per segment (&& and pipe chains)', () => {
    const result = classifyMutation({
      toolName: 'run_terminal_command',
      params: { command: 'echo x > a.txt && cat b.log | tee c.out' },
    })
    expect(result.mutates).toBe(true)
    expect(result.targets).toEqual(expect.arrayContaining(['a.txt', 'c.out']))
  })

  it('read-only shell commands classify non-mutating', () => {
    for (const command of ['ls -la', 'cat foo.md', 'git status', 'bun test']) {
      const result = classifyMutation({
        toolName: 'run_terminal_command',
        params: { command },
      })
      expect(result.mutates).toBe(false)
    }
  })

  it('read-only tools classify non-mutating (no behavior change)', () => {
    const tools = [
      'read_files',
      'glob',
      'code_search',
      'end_turn',
      'task_completed',
    ]
    for (const toolName of tools) {
      expect(classifyMutation({ toolName, params: {} })).toEqual({
        mutates: false,
        targets: [],
        scope: 'targeted',
      })
    }
  })

  it('stderr redirects are read-only diagnostics, not mutation targets', () => {
    expect(
      classifyMutation({
        toolName: 'run_terminal_command',
        params: { command: 'bun test 2>&1' },
      }).mutates,
    ).toBe(false)
    expect(
      classifyMutation({
        toolName: 'run_terminal_command',
        params: { command: 'bun test 2>nul' },
      }).mutates,
    ).toBe(false)
    // A diagnostic sink is not a worktree target — `> /dev/null` must not
    // wedge Law 15 with a file that can never be verified.
    expect(
      classifyMutation({
        toolName: 'run_terminal_command',
        params: { command: 'bun test > /dev/null 2>&1' },
      }).mutates,
    ).toBe(false)
  })
})
