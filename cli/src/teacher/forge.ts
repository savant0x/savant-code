/**
 * Live teacher Forge — the seam that drives the real agent runtime.
 *
 * `ForgeFn` in the teacher engine is the single point where the headless
 * pipeline touches the live runtime: it asks the Forge agent to produce a
 * solution for the steering + challenge and returns the solution source. The
 * dedicated `teacher-forge` agent is read-only — no file, terminal, or spawn
 * tools — so an exercise can never write to the user's project. The Forge's
 * output is a plain function source string, never a file edit.
 */
import { resolveActiveModel } from '../state/savant-free-model-store'
import { getSavantCodeClient } from '../utils/savant-code-client'

import type { ForgeFn } from '@savant-code/agent-runtime/teacher/index'
import type { PublicChallenge } from '@savant-code/common/teacher'
import type { AgentDefinition } from '@savant-code/common/templates/initial-agents-dir/types/agent-definition'
import type { TextPart } from '@savant-code/common/types/messages/content-part'
import type { AgentOutput } from '@savant-code/common/types/session-state'

const TEACHER_FORGE_INSTRUCTIONS = [
  'You are the Teacher Forge, a read-only implementation agent for',
  'Agent-Steering Teacher exercises. You receive a coding challenge and a',
  'steering constraint and must produce ONLY the solution source code.',
  '',
  'Rules:',
  '- Return ONLY the JavaScript function source. No markdown fences, no prose,',
  '  no explanation, no yagni/think blocks.',
  '- Implement exactly the requested function signature.',
  '- You have no tools: do not attempt to read or write files, run commands,',
  '  or spawn agents.',
  '- The solution must satisfy the input/output contract, including edge cases',
  '  named in the guidance.',
].join('\n')

/**
 * A tool-less Forge agent. `last_message` output keeps extraction trivial and
 * the absence of toolNames guarantees the exercise cannot mutate the project.
 */
export const TEACHER_FORGE_AGENT: AgentDefinition = {
  id: 'teacher-forge',
  version: '0.0.1',
  displayName: 'Teacher Forge',
  // FID-2026-0814-004 H-08/H-09: display metadata only — the effective model
  // is ALWAYS resolved from the UI model store by resolveTeacherForgeAgent().
  // The paid hardcode was removed as a fallback: a headless teacher run must
  // never bill a paid model the operator never selected.
  model: 'openrouter/free',
  outputMode: 'last_message',
  toolNames: [],
  spawnableAgents: [],
  includeMessageHistory: false,
  inheritParentSystemPrompt: false,
  instructionsPrompt: TEACHER_FORGE_INSTRUCTIONS,
}

/** Compose the Forge prompt from steering + the public challenge contract. */
export function buildForgePrompt(
  steering: string,
  challenge: PublicChallenge,
): string {
  return [
    `Steering constraint: ${steering.trim() || '(none given)'}`,
    '',
    `Challenge: ${challenge.objective}`,
    challenge.prompt,
    '',
    challenge.visibleGuidance ? `Guidance: ${challenge.visibleGuidance}` : '',
    `Signature: ${challenge.inputContract.signature}`,
    `Examples: ${challenge.inputContract.examples.join(' ; ')}`,
    `Output: ${challenge.outputContract.description}`,
    '',
    'Produce only the function source.',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

/** Strip a single markdown code fence if the model wrapped its answer. */
export function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(
    /^```(?:js|javascript|ts|typescript)?\s*\n([\s\S]*?)\n```\s*$/,
  )
  return fence ? fence[1].trim() : trimmed
}

/**
 * Extract the solution source from a run output. Handles the text modes the
 * teacher-forge agent can produce; structured output is a defensive fallback.
 * Throws a descriptive error when the Forge produced nothing usable, which the
 * exercise engine surfaces as a failed attempt rather than a silent empty
 * solution.
 */
export function extractSolutionSource(output: AgentOutput): string {
  if (output.type === 'error') {
    throw new Error(`Teacher Forge run error: ${output.message}`)
  }

  if (output.type === 'lastMessage' || output.type === 'allMessages') {
    for (let i = output.value.length - 1; i >= 0; i--) {
      const message = output.value[i]
      if (message.role !== 'assistant') continue
      const text = message.content
        .filter((part): part is TextPart => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
      if (text.trim()) return stripCodeFence(text)
    }
  }

  if (output.type === 'structuredOutput' && output.value) {
    const candidate =
      output.value.solution ??
      output.value.output ??
      output.value.result ??
      output.value.source ??
      output.value.text
    if (typeof candidate === 'string' && candidate.trim()) {
      return stripCodeFence(candidate)
    }
  }

  throw new Error('Teacher Forge produced no solution source')
}

/**
 * FID-2026-0814-004 H-08/H-09: resolve the Forge's model from the UI model
 * store — the same source as the main agent, sub-agents, and headless runs.
 * Pure and exported for tests. The teacher must respect the operator's
 * selection; `resolveActiveModel()` fail-safes to openrouter/free and can
 * never resolve to a paid model the operator never chose.
 */
export function resolveTeacherForgeAgent(override: string): AgentDefinition {
  return {
    ...TEACHER_FORGE_AGENT,
    model: override,
  }
}

/** The live ForgeFn: runs the teacher-forge agent headlessly and extracts. */
export function createTeacherForge(): ForgeFn {
  const agent = resolveTeacherForgeAgent(resolveActiveModel())
  return async (steering, challenge) => {
    const client = await getSavantCodeClient({ headless: true })
    if (!client) {
      throw new Error('Teacher Forge unavailable: not authenticated')
    }
    const runState = await client.run({
      agent,
      prompt: buildForgePrompt(steering, challenge),
      maxAgentSteps: 1,
    })
    return extractSolutionSource(runState.output)
  }
}
