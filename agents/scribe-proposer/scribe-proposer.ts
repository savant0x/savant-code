import { publisher } from '../constants'

import type { AgentDefinition } from '../types/agent-definition'

const definition: AgentDefinition = {
  id: 'scribe-proposer',
  publisher,
  // FID-2026-0912-004: the isolated skill proposer — a Scribe-role drafting
  // turn (S2-B toolset preserved) that is COLD-SPAWNED. Handoff isolation
  // (WikiSkill §3.2.3): its ONLY context is the drafting prompt built from
  // the pattern wiki + deduped traces + skill inventory. It never sees the
  // parent conversation — the summarizing Scribe turn is untouched
  // (mode-split, 09-10 adversarial correction).
  model: 'openrouter/free',
  displayName: 'Savant the Scribe (Proposer)',
  spawnerPrompt:
    'Isolated skill-proposal drafting turn. Cold-spawned at session end when a wiki pattern qualifies; drafts at most ONE atomic skill change from wiki evidence alone.',
  outputMode: 'last_message',
  // FID-2026-0824-012 S2-B: skill_manage is Scribe + Orchestrator only; this
  // definition is a Scribe-role variant, so the declarative tool restriction
  // is preserved (skill_manage stays absent from Forge/Verifier/Detective).
  toolNames: [
    'read_files',
    'write_file',
    'glob',
    'code_search',
    'set_output',
    'skill_manage',
  ],

  // THE isolation contract: no parent message history reaches this turn.
  // Mechanical cold-spawn (spawn-agent-utils reads this field).
  includeMessageHistory: false,
  inheritParentSystemPrompt: true,

  instructionsPrompt: `You are the skill proposer, a specialized Scribe drafting turn in the Savant ECHO Protocol system (FID-2026-0912-004).

# Handoff isolation contract

You are cold-spawned: you have NO access to the parent conversation. Your only
inputs are the drafting prompt you receive: the pattern wiki, the deduped
failure traces, and the trusted skill inventory. Propose from that evidence
alone. Never invent context you were not given.

# Core responsibilities

1. Read the drafting prompt's evidence (wiki pages + traces + inventory).
2. Decide whether the evidence justifies exactly one skill change:
   - create a new skill covering the recurring failure pattern, or
   - patch one existing skill (from the inventory) that failed to prevent it.
3. Emit at most ONE proposal via skill_manage (it lands in quarantine —
   the operator releases; you cannot trust your own proposal).

# The atomic-proposal contract

- Propose AT MOST ONE skill change per drafting turn (one skill, one action).
- If the evidence does not justify a change, propose nothing. A correct
  no-proposal is a valid outcome.

# Rules

- You can ONLY write to documentation/skill-draft paths via write_file and
  skill_manage. No str_replace, no bash, no spawn.
- Every proposal must cite the pattern evidence (dedup key or trace lines)
  in its rationale.
- Never fabricate recurrences or observations. Evidence or no proposal.
`,

  // Session summaries keep the full-fidelity Scribe; this turn only drafts.
  handleSteps: undefined,
} as AgentDefinition

export default definition
