// FID-2026-0910-001 P1 pin — skill_manage renders with the command-class
// traffic-light chrome via TerminalCommandDisplay reuse. The input carries no
// `command` field, so the label is synthesized from the {action, name} pair.
import { describe, expect, test } from 'bun:test'

import { getToolComponent } from '../registry'
import { SkillManageComponent } from '../skill-manage'

import type { ChatTheme } from '../../../types/theme-system'
import type { ToolBlock, ToolRenderConfig } from '../types'

const mockTheme = {} as ChatTheme
const mockOptions = {
  availableWidth: 80,
  indentationOffset: 0,
  labelWidth: 10,
}

function skillManageBlock(
  input: { action: string; name?: string },
  output?: string,
): ToolBlock & { toolName: 'skill_manage' } {
  return {
    type: 'tool',
    toolName: 'skill_manage',
    toolCallId: 'skill-call-1',
    input,
    output,
  }
}

// Command-class output envelope (FID-2026-0908-001) in the tuple format
// jsonToolResult emits — same shape the terminal-command suite parses.
const createJsonOutput = (
  stdout: string,
  stderr = '',
  exitCode: number | null = 0,
): string =>
  JSON.stringify([
    {
      type: 'json',
      value: {
        action: 'create',
        name: 'demo-skill',
        stdout,
        stderr,
        exitCode,
        pendingTrust: true,
      },
    },
  ])

/** Read the props handed to the shared TerminalCommandDisplay. */
function displayProps(result: ToolRenderConfig): {
  command: string
  output: string | null
  exitCode?: number | null
} {
  expect(result.content).toBeDefined()
  const element = result.content as {
    props: {
      command: string
      output: string | null
      exitCode?: number | null
    }
  }
  return element.props
}

describe('SkillManageComponent (FID-2026-0910-001 P1)', () => {
  test('registry resolves the dedicated component', () => {
    expect(getToolComponent('skill_manage')).toBe(SkillManageComponent)
  })

  test('successful create renders the synthesized label and exit plumbing', () => {
    const result = SkillManageComponent.render(
      skillManageBlock(
        { action: 'create', name: 'demo-skill' },
        createJsonOutput(
          "skill 'demo-skill' create at v0.1.0 — quarantined, pending operator trust",
        ),
      ),
      mockTheme,
      mockOptions,
    )
    expect(result.collapsedPreview).toBe('skill create demo-skill')
    const props = displayProps(result)
    expect(props.command).toBe('skill create demo-skill')
    expect(props.exitCode).toBe(0)
    // The engine's own human-readable line — including the trust-boundary
    // phrase — flows into the expanded display body.
    expect(props.output).toContain('quarantined, pending operator trust')
  })

  test('failure renders stderr and the failing exit code', () => {
    const result = SkillManageComponent.render(
      skillManageBlock(
        { action: 'trust', name: 'ghost-skill' },
        createJsonOutput('', 'no quarantined draft', 1),
      ),
      mockTheme,
      mockOptions,
    )
    const props = displayProps(result)
    expect(props.exitCode).toBe(1)
    expect(props.output).toContain('no quarantined draft')
  })

  test('input without a name renders the action-only label', () => {
    const result = SkillManageComponent.render(
      skillManageBlock({ action: 'rollback' }, createJsonOutput('ok')),
      mockTheme,
      mockOptions,
    )
    expect(result.collapsedPreview).toBe('skill rollback')
  })
})
