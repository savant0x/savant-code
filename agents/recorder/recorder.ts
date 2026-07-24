import { publisher } from '../constants'

import type { AgentDefinition } from '../types/agent-definition'

const definition: AgentDefinition = {
  id: 'recorder',
  publisher,
  model: 'anthropic/claude-sonnet-4.6',
  displayName: 'Savant the Recorder',
  spawnerPrompt:
    'FID lifecycle manager. Spawns to create, track, update, and archive Feature Implementation Documents. Ensures no FID closes without AUDIT evidence.',
  outputMode: 'last_message',
  toolNames: ['write_file', 'read_files', 'glob', 'code_search', 'set_output'],

  includeMessageHistory: true,
  inheritParentSystemPrompt: true,

  instructionsPrompt: `You are the Recorder, a specialized agent in the Savant ECHO Protocol system. Your sole responsibility is FID (Feature Implementation Document) lifecycle management.

# Core Responsibilities

1. **Create FIDs** — When a new issue, bug, or improvement is identified, create a FID file in \`dev/fids/\` using the standard format.
2. **Track FIDs** — Maintain accurate status (in_progress, complete, closed) and phase (RED, GREEN, AUDIT, SELF-CORRECT, COMPLETE) in each FID.
3. **Update FIDs** — Record Perfection Loop progress: RED findings, GREEN fixes, AUDIT evidence, SELF-CORRECT corrections.
4. **Archive FIDs** — When a FID reaches COMPLETE, move it from \`dev/fids/\` to \`dev/fids/archive/\` and append to \`CHANGELOG.md\`.
5. **Seal umbrella FIDs** — When the orchestrator signals 'Scaffold complete' (set_scaffold_complete), call set_output to seal the umbrella FID.
6. **Enforce AUDIT evidence** — No FID may close without tool output evidence in the AUDIT section. Self-reporting is prohibited.

# FID Format

FIDs follow the template in \`templates/FID-TEMPLATE.md\`. Key sections:
- Summary, Environment, Detailed Description
- Completed Work, Remaining Work
- Impact Assessment
- Perfection Loop (RED → GREEN → AUDIT → SELF-CORRECT → COMPLETE)
- Lessons Learned

# Rules

- You can ONLY write to FID files (\`dev/fids/*.md\`), \`dev/fids/archive/\`, and \`CHANGELOG.md\`.
- You cannot use str_replace or bash. Use write_file to create/update FIDs.
- Every FID update must include tool output evidence in the AUDIT section.
- Never close a FID that has unresolved items in Remaining Work.`,

  handleSteps: function* ({ agentState }) {
    const scaffoldCompleteSignal = agentState.messageHistory.some((message) => {
      if (message.role !== 'assistant') return false
      return message.content.some((part) => {
        const anyPart = part as {
          type?: string
          output?: { type: string; value: unknown }[]
        }
        if (anyPart.type !== 'tool-result') return false
        return (anyPart.output ?? []).some((output) => {
          if (output.type !== 'json') return false
          const value = output.value
          return (
            typeof value === 'object' &&
            value !== null &&
            'scaffoldComplete' in value &&
            (value as Record<string, unknown>).scaffoldComplete === true
          )
        })
      })
    })

    if (scaffoldCompleteSignal) {
      yield {
        toolName: 'set_output',
        input: {
          value:
            'Umbrella FID sealed. Scaffold session complete; reverting to EDIT mode.',
        },
      }
      return
    }

    yield 'STEP'
  },
}

export default definition
