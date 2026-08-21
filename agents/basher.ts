import { GEMINI_3_1_FLASH_LITE_MODEL_ID } from '@savant-code/common/constants/gemini'

import { publisher } from './constants'

import type {
  AgentDefinition,
  AgentStepContext,
} from './types/agent-definition'

const basher: AgentDefinition = {
  id: 'basher',
  publisher,
  model: GEMINI_3_1_FLASH_LITE_MODEL_ID,
  displayName: 'Basher',
  spawnerPrompt:
    'Runs a single terminal command and (recommended) describes its output using an LLM using the what_to_summarize field. A lightweight shell command executor. Every basher spawn MUST include params: { command: "<shell>" }.',

  inputSchema: {
    params: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description:
            "The terminal command to run in bash shell. Don't forget this field!",
        },
        what_to_summarize: {
          type: 'string',
          description:
            'What information from the command output is desired. Be specific about what to look for or extract. This is optional, and if not provided, the basher will return the full command output without summarization.',
        },
        timeout_seconds: {
          type: 'number',
          description: 'Set to -1 for no timeout. Default 30',
        },
      },
      required: ['command'],
    },
  },
  outputMode: 'last_message',
  includeMessageHistory: false,
  toolNames: ['run_terminal_command'],
  systemPrompt: `You are part of the Savant ECHO Protocol system. You are an expert at analyzing the output of a terminal command.

Your job is to:
1. Analyze the output of a terminal command that has already been executed
2. Focus on the information the user requested
3. Provide a clear, concise description of the relevant information

Fail fast (FID-2026-0806-016): run_terminal_command is FSM-gated to AUDIT/GREEN/SELF-CORRECT phases. If your first tool attempt returns a phase-gate block ("only available during AUDIT, GREEN, or SELF-CORRECT phases"), reply with ONE line naming the block — e.g. "BLOCKED: run_terminal_command unavailable in current phase — parent must transition_phase before spawning basher" — and stop. Do NOT analyze why it failed, explain the error, or offer alternatives.

When describing command output:
- Use excerpts from the actual output when possible (especially for errors, key values, or specific data)
- Focus on the information the user requested
- Be concise but thorough
- If the output is very long, summarize the key points rather than reproducing everything
- Don't include any follow up recommendations, suggestions, or offers to help`,
  instructionsPrompt: `The terminal command has already been executed and its output should be in your context. The user has specified what information they want from that output.

Analyze the output and describe the relevant information, following the user's instructions about what to focus on. Do not call any tools.

If no command output appears in your context, reply exactly: NO-OUTPUT: result not delivered — never invent, reconstruct, or estimate output.`,
  handleSteps: function* ({ params }: AgentStepContext) {
    const command = params?.command as string | undefined
    if (!command) {
      // Using console.error because agents run in a sandboxed environment without access to structured logger
      // eslint-disable-next-line no-console -- sandboxed agent env: no structured logger available
      console.error('Basher agent: missing required "command" parameter')
      yield {
        toolName: 'set_output',
        input: { output: 'Error: Missing required "command" parameter' },
      }
      return
    }

    const timeout_seconds = params?.timeout_seconds as number | undefined
    const what_to_summarize = params?.what_to_summarize as string | undefined

    // Run the command
    const { toolResult } = yield {
      toolName: 'run_terminal_command',
      input: {
        command,
        ...(timeout_seconds !== undefined && { timeout_seconds }),
      },
    }

    const firstResult = toolResult?.[0]

    if (!what_to_summarize) {
      // Return the raw command output without summarization
      // Only return object values (command output objects), not plain strings
      const output =
        firstResult?.type === 'json' && typeof firstResult.value === 'object'
          ? firstResult.value
          : ''
      yield {
        toolName: 'set_output',
        input: { output },
        includeToolCall: false,
      }
      return
    }

    // FID-2026-0820-015 BASHER-1: never hand a blocked/failed/relay-lost
    // command to the summarization step — the model would fabricate output
    // to satisfy the "output is in your context" premise. A delivered result
    // is a ToolResultOutput ('json' | 'media'); anything else is a failure.
    const hasDeliveredResult =
      firstResult?.type === 'json' || firstResult?.type === 'media'
    if (!hasDeliveredResult) {
      yield {
        toolName: 'set_output',
        input: {
          output:
            'ERROR: command produced no output — blocked, failed, or result relay lost',
        },
        includeToolCall: false,
      }
      return
    }

    // Let the model analyze and describe the output
    yield 'STEP'
  },
}

export default basher
