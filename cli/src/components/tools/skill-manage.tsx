import { defineToolComponent } from './types'
import { TerminalCommandDisplay } from '../terminal-command-display'
import { parseTerminalOutput } from './run-terminal-command'

import type { ToolRenderConfig } from './types'

/**
 * FID-2026-0910-001 P1 — dedicated renderer for `skill_manage`.
 *
 * The handler already emits the canonical command-class output template
 * ({stdout, stderr, exitCode} — FID-2026-0908-001), so this component
 * delegates to the shared TerminalCommandDisplay (traffic-light chrome,
 * ✓/✗ status badge, expandable output) exactly like run_terminal_command.
 *
 * A raw registry alias of RunTerminalCommandComponent would render an empty
 * command row — skill_manage's input carries no `command` field — so the
 * label is synthesized from the {action, name} input pair instead. One
 * registration covers both render paths: agent-branch tool blocks flow
 * through tool-branch.tsx, which consults the same registry.
 */
export const SkillManageComponent = defineToolComponent({
  toolName: 'skill_manage',

  render(toolBlock, _theme, options): ToolRenderConfig {
    const input = toolBlock.input as
      { action?: string; name?: string } | undefined
    const action = typeof input?.action === 'string' ? input.action : ''
    const name = typeof input?.name === 'string' ? input.name : ''
    const label = [action, name].filter(Boolean).join(' ')
    const command = `skill ${label}`

    const { output, exitCode } = parseTerminalOutput(toolBlock.output)

    const content = (
      <TerminalCommandDisplay
        command={command}
        output={output}
        expandable={true}
        maxVisibleLines={5}
        availableWidth={options.availableWidth}
        exitCode={exitCode}
      />
    )

    return {
      content,
      collapsedPreview: command,
    }
  },
})
