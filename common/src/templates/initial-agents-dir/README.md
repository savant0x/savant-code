# Custom agents

Define local agents as TypeScript files under your project's `.agents/`
directory. Each file exports an `AgentDefinition` as its default export.
Run `/init` to create `knowledge.md` and the current `.agents/types/` files.
`/init --force` refreshes shipped type files while preserving user agents and
knowledge. The template's `examples/` directory contains basic review,
programmatic commit, and delegated exploration examples for reference.

## A local agent

Create `.agents/my-reviewer.ts`:

```typescript
import type { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'my-reviewer',
  displayName: 'My Reviewer',
  model: 'openrouter/free',
  toolNames: ['read_files', 'code_search', 'run_readonly_command'],
  spawnerPrompt: 'Review changes without modifying files.',
  instructionsPrompt:
    'Read the relevant files, inspect the diff, and report findings with source evidence. Do not edit files.',
}

export default definition
```

Start `savant-code` in that project and ask the main agent to use your local
reviewer. Local definitions load without a hosted agent store. The active
CLI model governs runs; a template's model string is not a promise that the
CLI will silently switch providers or use another account.

## Definition fields

| Field | Purpose |
| --- | --- |
| `id` | Unique lowercase identifier with digits and hyphens |
| `displayName` | Name displayed in the UI |
| `model` | Model identifier for hosts using the definition directly |
| `toolNames` | Declared model-visible tools; runtime permissions still apply |
| `programmaticToolNames` | Tools callable only from `handleSteps` |
| `instructionsPrompt` | Instructions supplied during the agent run |
| `spawnerPrompt` | When a parent should select this agent |
| `spawnableAgents` | Explicit allowed child definitions |
| `inputSchema` | Prompt and parameter schemas |
| `outputMode`, `outputSchema` | Text/history or structured-result contract |
| `handleSteps` | Generator combining deterministic tool calls and model steps |

See `types/agent-definition.ts` and `types/tools.ts` for the complete contract.
Use the generated type files rather than copying tool parameter declarations.

## Programmatic steps

Tool calls use `toolName` and `input`. `STEP` requests one model step;
`STEP_ALL` runs until the model finishes. Declare every tool the generator
uses in the definition's tool lists.

```typescript
import type { AgentDefinition, ToolCall } from './types/agent-definition'

const definition: AgentDefinition = {
  id: 'diff-reviewer',
  displayName: 'Diff Reviewer',
  model: 'openrouter/free',
  toolNames: ['read_files', 'run_readonly_command'],
  instructionsPrompt: 'Review the diff using the actual source files.',
  handleSteps: function* () {
    yield {
      toolName: 'run_readonly_command',
      input: {
        command: 'git diff',
        process_type: 'SYNC',
        timeout_seconds: 30,
      },
    } satisfies ToolCall
    yield 'STEP_ALL'
  },
}

export default definition
```

## Verification and sharing

Test definitions in an isolated project with a configured provider. Check
tool authorization, cancellation, failure handling and the resulting evidence.
Keep read-only investigation separate from implementation and verification
when the governing ECHO contract requires those roles.

Share the definition and its instructions as source files. The retired hosted
publishing flow is not required for local use. SDK hosts can register these
definitions through `agentDefinitions` or pass an inline definition to `run`;
see the repository's `sdk/README.md` for its source-build workflow.
