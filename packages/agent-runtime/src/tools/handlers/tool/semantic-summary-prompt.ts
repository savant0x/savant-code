/**
 * FID-2026-0914-002 — handoff instruction for the LLM semantic summary.
 *
 * Adapted from the kimi-code compaction instruction (read in full this
 * session) with ECHO additions: evidence classes, operator-ruling
 * provenance, credential redaction, and conversation-language matching.
 * The deterministic writer's output (post-hardening) is the INPUT
 * MATERIAL — the model synthesizes meaning from it; it never transcribes
 * it. Pure module: no imports beyond types so it can be unit-pinned.
 */

/** Token band for the validated summary (operator ruling MQ2). */
export const SEMANTIC_SUMMARY_MIN_TOKENS = 800
export const SEMANTIC_SUMMARY_MAX_TOKENS = 6_000

/**
 * Conservative length→token estimate for the band gate (chars/4). The
 * production token counter carries an Anthropic fudge factor that would
 * over-count English prose; the band is a guardrail, not a bill, so the
 * cheaper deterministic estimate is the contract here.
 */
export function estimateSummaryTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const SYSTEM_INSTRUCTION = `You are the continuity writer for a coding-agent session. You are continuing the work of the agent whose conversation is condensed in the material below. Write the handoff summary the NEXT agent instance needs to resume without re-discovering anything.

Discipline:
1. First, state what was actually ASKED (the operator's goal), in the operator's own terms.
2. Separate SETTLED from OPEN. Settled = completed work with evidence: exact commands run and their real results (exit codes, output heads), files created or modified, decisions made and WHY. Open = work in flight, unresolved errors, decisions awaiting a ruling.
3. Name the UNKNOWNs explicitly. If a claim was never verified, say so — never present an unverified claim as evidence.
4. End with the exact next move: the single most useful action for the continuation, with its concrete target (file, command, or question).
5. Preserve exact identifiers verbatim: file paths, commands, error messages, FID ids, model ids, URLs. Never paraphrase an identifier.
6. Do NOT transcribe todo lists, plans, or tool output wholesale — live todos and recent messages are re-attached to the continuation separately. Summarize their MEANING instead.
7. REDACT every credential you encounter (API keys, tokens) as [REDACTED] — the summary is stored in plaintext history.
8. Write the summary in the SAME LANGUAGE as the conversation you are summarizing.
9. Write plain prose and bullets for the reading agent. Never emit tool-call syntax, JSON tool envelopes, or fenced tool-call blocks — you are writing memory, not driving tools.

Length: a focused handoff, roughly 800-6000 tokens. The session model writes this summary; there is no other model.`

/**
 * Build the summary request messages. The deterministic excerpt is the
 * input material — the model may rely on its facts (they were just
 * hardened: placeholders skipped, paths normalized) but must synthesize,
 * not transcribe.
 */
export function buildSemanticSummaryPrompt({
  deterministicSummary,
}: {
  deterministicSummary: string
}): { system: string; user: string } {
  const user = `Condensed conversation material (deterministically preserved facts — headings, budgets, and machinery noise aside):

<deterministic-summary>
${deterministicSummary}
</deterministic-summary>

Write the handoff summary now. Follow the discipline: goal, settled-with-evidence, open, unknowns, exact next move — in the conversation's language, credentials redacted, identifiers verbatim.`
  return { system: SYSTEM_INSTRUCTION, user }
}
