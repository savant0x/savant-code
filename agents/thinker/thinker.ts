import { ECHO_PROTOCOL_INSTRUCTIONS } from '@savant-code/common/constants/agents'

import { publisher } from '../constants'

import type { SecretAgentDefinition } from '../types/secret-agent-definition'

const definition: SecretAgentDefinition = {
  id: 'thinker',
  publisher,
  model: 'anthropic/claude-opus-4.8',
  displayName: 'Savant the Thinker',
  spawnerPrompt:
    'Does deep thinking given the current conversation history and a specific prompt to focus on. Use this to help you solve a specific problem. You must gather any relevant context before spawning this agent because the thinker agent only has the sequentialthinking and end_turn tools — no codebase, web, or write access. You can keep the prompt very short, because the thinker agent can see the entire conversation history for context.',
  inputSchema: {
    prompt: {
      type: 'string',
      description:
        'The problem you are trying to solve, very briefly. No need to provide context, as the thinker agent can see the entire conversation history.',
    },
  },
  // FID-2026-0801-012: the runtime convergence gate builds the FinalArtifact
  // from the session snapshot. `status: 'success'` structurally requires a
  // non-null `payload`; `payload` is null with an `error` for exhausted /
  // failed / cancelled outcomes.
  outputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description:
          "Terminal status: 'success' | 'exhausted' | 'cancelled' | 'failed'",
      },
      synthesis: {
        type: 'string',
        description: 'Concise explanation of how the conclusion was reached.',
      },
      payload: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: "The final answer (non-null when status is 'success')",
          },
        },
        description: "The final answer; null when status is not 'success'",
      },
      metrics: {
        type: 'object',
        properties: {
          totalThoughts: { type: 'number' },
          durationMs: { type: 'number' },
          branches: { type: 'array', items: { type: 'string' } },
        },
      },
      thoughts: {
        type: 'array',
        description:
          'The accepted sequential-thinking thought snapshots, in insertion order.',
      },
      error: {
        type: 'string',
        description: "Present when status is not 'success'",
      },
    },
  },
  outputMode: 'structured_output',
  inheritParentSystemPrompt: true,
  includeMessageHistory: true,
  spawnableAgents: [],
  // `end_turn` lets the model end its turn explicitly after the final
  // converged thought (FID-2026-0801-012). The runtime convergence gate still
  // owns output: premature end_turn (before nextThoughtNeeded=false) triggers
  // a typed retry, and converged sessions produce the FinalArtifact from the
  // session snapshot.
  toolNames: ['sequentialthinking', 'end_turn'],

  instructionsPrompt: `
You are a thinker agent bound by the ECHO Protocol. Use the sequentialthinking tool for all non-trivial reasoning — structured step-by-step thinking with support for branching, revision, and convergence detection.

The sequentialthinking tool supports:
- **Branching**: Explore alternative approaches by setting branchFromThought and branchId.
- **Revision**: Correct a previous thought by setting isRevision and revisesThought.
- **Extension**: Signal that more thoughts are needed than initially estimated.

For trivial decisions only, you may use <think> tags instead.

## Convergence contract (FID-2026-0801-012)

- Reason step by step with the sequentialthinking tool.
- When you have reached your final conclusion, make ONE LAST sequentialthinking call with **nextThoughtNeeded: false** and place your **complete conclusion inside the thought text** of that final call.
- Do NOT write your conclusion as plain text and stop — the runtime builds the final result from the accepted thought session, and it only finalizes when the last thought set nextThoughtNeeded=false.
- Do NOT call set_output — that tool is handled by the runtime for you.
- The thought stream is visible to the user; keep it honest and structured.

${ECHO_PROTOCOL_INSTRUCTIONS}
`.trim(),
}

export default definition
