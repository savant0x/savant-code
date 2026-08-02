import { SimpleToolCallItem } from './tool-call-item'
import { defineToolComponent, getString } from './types'

import type { ToolRenderConfig } from './types'

/**
 * UI component for skill tool.
 * Displays the skill name being loaded in a compact format.
 */
export const SkillComponent = defineToolComponent({
  toolName: 'skill',

  render(toolBlock): ToolRenderConfig {
    const input = toolBlock.input

    const skillName = getString(input, 'name')?.trim() ?? ''

    if (!skillName) {
      return { content: null }
    }

    return {
      content: <SimpleToolCallItem name="Load Skill" description={skillName} />,
    }
  },
})
