import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterEach, describe, expect, it } from 'bun:test'

import { handleSkillManage } from '../skill-manage'

import type { SavantCodeToolCall } from '@savant-code/common/tools/list'
import type { ProjectFileContext } from '@savant-code/common/util/file'

const tempDirectories: string[] = []

function fixtureRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-manage-handler-'))
  tempDirectories.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirectories.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

type SkillManageInput = SavantCodeToolCall<'skill_manage'>['input']

function callSkillManage(projectRoot: string, input: SkillManageInput) {
  return handleSkillManage({
    previousToolCallFinished: Promise.resolve(),
    toolCall: {
      toolCallId: 'test-call',
      toolName: 'skill_manage' as const,
      input,
    },
    fileContext: { projectRoot } as ProjectFileContext,
  })
}

function outputValue(output: unknown): Record<string, unknown> {
  return (output as { value: Record<string, unknown> }[])[0].value
}

// FID-2026-0908-001: skill_manage output must match the canonical
// single-command tool-result template ({stdout, stderr, exitCode}) that the
// command-class tools (run_readonly_command / run_terminal_command) return —
// not the bespoke {ok, error} envelope.
describe('handleSkillManage output template (FID-2026-0908-001)', () => {
  it('create success returns the canonical {stdout, stderr, exitCode} envelope', async () => {
    const root = fixtureRoot()
    const { output } = await callSkillManage(root, {
      action: 'create',
      name: 'demo-skill',
      description: 'Demo skill body',
      body: '# Demo\n\nBody.',
      reason: 'test create',
    })
    const value = outputValue(output)

    expect(value.exitCode).toBe(0)
    expect(value.stderr).toBe('')
    expect(String(value.stdout)).toContain('demo-skill')
    // Machine-readable identity fields are preserved for the trust boundary.
    expect(value.name).toBe('demo-skill')
    expect(value.version).toBe('0.1.0')
    expect(value.action).toBe('create')
    expect(typeof value.nextSha).toBe('string')
    expect(value.pendingTrust).toBe(true)
    // The bespoke shape is gone — no ok/error/message channels remain.
    expect(value.ok).toBeUndefined()
    expect(value.error).toBeUndefined()
    expect(value.message).toBeUndefined()
  })

  it('engine failure returns exitCode 1 with the exact error on stderr', async () => {
    const root = fixtureRoot()
    const { output } = await callSkillManage(root, {
      action: 'create',
      name: 'Invalid Name!',
      description: 'Demo skill body',
      body: '# Demo\n\nBody.',
      reason: 'test invalid name',
    })
    const value = outputValue(output)

    expect(value.exitCode).toBe(1)
    expect(value.stderr).toBe('invalid skill name: Invalid Name!')
    expect(value.stdout).toBe('')
    expect(value.ok).toBeUndefined()
    expect(value.error).toBeUndefined()
  })

  it('missing-skill patch failure carries exitCode 1 + the engine error on stderr', async () => {
    const root = fixtureRoot()
    const { output } = await callSkillManage(root, {
      action: 'patch',
      name: 'absent-skill',
      oldString: 'anything',
      newString: 'other',
      reason: 'test missing skill',
    })
    const value = outputValue(output)

    expect(value.exitCode).toBe(1)
    expect(value.stderr).toBe(
      "skill 'absent-skill' does not exist (create it first)",
    )
    expect(value.stdout).toBe('')
  })

  it('success folds any engine message into stdout (one truth per channel)', async () => {
    const root = fixtureRoot()
    const { output } = await callSkillManage(root, {
      action: 'create',
      name: 'second-skill',
      description: 'Second skill body',
      body: '# Second\n\nBody.',
      reason: 'test message fold',
    })
    const value = outputValue(output)

    expect(value.exitCode).toBe(0)
    expect(value.message).toBeUndefined()
    expect(String(value.stdout).length).toBeGreaterThan(0)
  })
})
