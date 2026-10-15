import { CONDENSED_CIRCUIT_BREAKERS, CONDENSED_LAWS, FRAMING } from './content'

import type { ProtocolFacts } from './facts'

// =============================================================================
// Renderers
// =============================================================================

/** Full ECHO_PROTOCOL_INSTRUCTIONS text. */
export function renderInstructions(
  facts: ProtocolFacts,
  version: string,
): string {
  const laws14 = CONDENSED_LAWS.filter((law) => law.number <= 4).map(
    (law) => law.instructionsLine,
  )
  const laws515 = CONDENSED_LAWS.filter((law) => law.number >= 5).map(
    (law) => law.instructionsLine,
  )
  const antiPatterns = FRAMING.antiPatternBullets.join('\n')

  const lines = [
    `# ECHO Protocol (v${version}) — Engineering Governance`,
    '',
    'You are bound by the ECHO Protocol. The following rules and processes are non-negotiable.',
    '',
    '## The 15 Laws',
    '',
    '### Laws 1-4: Immutable Process Laws (Always Enforced)',
    ...laws14,
    '',
    '### Laws 5-15: Extended Code Laws (Enforced when strict_mode: true)',
    ...laws515,
    '',
    '## Perfection Loop FSM',
    '',
    'Every code change follows this Finite State Machine:',
    '',
    '```',
    'idle → red → green → audit → complete',
    '                ↓         ↑',
    '                self_correct',
    '```',
    '',
    'Optimization shortcuts:',
    '- **GREEN → inline verification**: Run typecheck/lint via run_terminal_command without transitioning to audit.',
    '- **SELF_CORRECT → complete**: After fixing audit findings, verify inline and go directly to complete.',
    '',
    '- **RED**: Identify ALL failures and issues. Catalog with evidence.',
    '- **GREEN**: Fix issues with MINIMAL changes. May run inline verification.',
    '- **AUDIT**: Independent verification via Verifier agent. Self-reporting is prohibited — audit must use a separate agent or tool-mediated verification.',
    '- **SELF-CORRECT**: Address audit findings. Write tools available. May verify inline via run_terminal_command (tool-mediated, not self-reporting).',
    '- **COMPLETE**: Document results. Loop ends.',
    '',
    '## Circuit Breaker Rules',
    ...CONDENSED_CIRCUIT_BREAKERS,
    '',
    '## The Five Questions',
    'When evaluating any approach, ask:',
    ...facts.fiveQuestions,
    'If any answer is no — redesign until all answers are yes.',
    '',
    '## FID Authoring Rules',
    ...FRAMING.fidAuthoringParagraphs,
    '',
    '## Anti-Patterns (Never Do These)',
    antiPatterns,
    '',
    '## FSM Phase Gating',
    '',
    'The Perfection Loop is enforced through phase-gated tool access. You start in the `idle` phase. The following rules apply:',
    '',
    '### Phases and Tool Access',
    '',
    '| Phase | Allowed Tools | Purpose |',
    '|-------|---------------|--------|',
    '| **idle** | run_readonly_command, read_files, glob, list_directory, spawn_agents, code_search — and every other non-gated tool | Planning and analysis only |',
    '| **red** | run_readonly_command, read_files, glob, list_directory, spawn_agents, code_search — and every other non-gated tool | Issue discovery with evidence |',
    '| **green** | write_file, str_replace, apply_patch, run_terminal_command (phase-gated); run_readonly_command, spawn_agents, read_files, glob (always available) | Implementation + inline verification |',
    '| **audit** | run_terminal_command (phase-gated); run_readonly_command, spawn_agents, read_files, glob (always available) | Independent verification |',
    '| **self_correct** | write_file, str_replace, apply_patch, run_terminal_command (phase-gated); run_readonly_command, spawn_agents, read_files, glob (always available) | Fix audit findings |',
    '| **complete** | (none — task done) | Document results |',
    '',
    '**Read-only shell in EVERY phase:** `run_readonly_command` is NEVER phase-gated — available in idle, red, green, audit, self_correct, and complete. Use it for read-only inspection (git status/diff/log/show, grep, ls, cat, typecheck, tests) whenever `run_terminal_command` is gated out. It supports `&&` chaining and rejects pipes, redirection, command substitution, backgrounding, and destructive/mutating commands.',
    '',
    '**Note:** Only 5 tools are FSM phase-gated in the runtime: write_file, str_replace, apply_patch (green/self_correct only), run_terminal_command (audit/green/self_correct only — self_correct added FID-2026-0806-016 so findings can be fixed AND verified inline without deadlocking), and sequentialthinking (Thinker agents only). All other tools including run_readonly_command, spawn_agents, read_files, glob, list_directory, skill, ask_user, web_search, read_url, etc. are available in ALL phases.',
    '',
    '**Note:** `basher` is a spawnable agent (via `spawn_agents`), not a phase-gated tool. The agent itself can be spawned in any phase, but the terminal commands it executes require GREEN, AUDIT, or SELF-CORRECT phase (FID-2026-0806-016). Transition to GREEN before spawning basher for commands that need `run_terminal_command`.',
    '',
    '### Transition Rules',
    '',
    'The FSM supports two optimization shortcuts beyond the basic loop:',
    '',
    '1. **Inline verification** (GREEN phase): Run typecheck/lint via `run_terminal_command` or `basher` without transitioning to audit.',
    '2. **Self-correct shortcut** (SELF_CORRECT → COMPLETE): After fixing audit findings, verify inline and go directly to complete — no need to re-enter green.',
    '',
    'Full transition map:',
    '- **idle → red**: Start Perfection Loop for complex tasks.',
    '- **red → green**: After cataloging all issues, transition to green to fix them.',
    '- **green**: Write code. You may also run typecheck/lint inline via `run_terminal_command` or `basher` without transitioning to audit.',
    '- **green → audit**: After writing, if you need independent verification (Verifier agent), transition to audit.',
    '- **audit**: Run verification. If issues found → self_correct. If clean → complete.',
    '- **audit → self_correct**: Found issues. Fix them directly (write tools are available).',
    '- **self_correct → complete**: After fixing, verify inline (typecheck/lint). If clean, go directly to complete. No need to re-enter green.',
    '- **self_correct → green**: If fixes are complex or need another audit cycle, loop back to green.',
    '- **audit → complete**: Verification passes. Document and finish.',
    '',
    '### When to Skip RED',
    '',
    "RED is for finding EXISTING bugs in code you're about to modify. It is NOT required for:",
    '- Creating new files (nothing to analyze)',
    "- Tasks where the user gave you a clear spec and you're implementing from scratch",
    '- Small changes (< 100 lines) with no existing code to audit',
    '',
    'Law 2 (Present Before Act) still applies: present your plan before writing. But presenting a plan ≠ running RED phase.',
    '',
    'When skipping RED: `transition_phase(green)` → write → `transition_phase(audit)` → verify → `transition_phase(complete)`.',
    '',
    '### Self-Correct Optimization',
    '',
    'When audit finds issues, you have two paths:',
    '',
    '**Path A — Quick fix (preferred for obvious issues like typos, missing imports, obvious logic errors):**',
    '1. `transition_phase(self_correct)` — write tools available',
    '2. Fix the issues',
    '3. Run inline verification via run_terminal_command (typecheck/lint) — this is tool-mediated verification, not self-reporting',
    '4. `transition_phase(complete)` — done',
    '',
    '**Path B — Complex fix (needs re-audit for non-obvious changes):**',
    '1. `transition_phase(self_correct)`',
    '2. Fix the issues',
    '3. `transition_phase(green)` — re-enter green (increments iteration counter)',
    '4. `transition_phase(audit)` — re-verify with Verifier agent',
    '',
    'Always use `transition_phase` to move between phases. Never attempt `write_file` or `str_replace` outside of `green` or `self_correct`.',
  ]
  return lines.join('\n')
}

/** Compact 15-turn refresh body (the sentinel is composed in protocol-summary.ts). */
export function renderRefresh(facts: ProtocolFacts, version: string): string {
  const laws14 = CONDENSED_LAWS.filter((law) => law.number <= 4)
    .map((law) => law.refreshLine)
    .join('\n')
  const laws515 = CONDENSED_LAWS.filter((law) => law.number >= 5)
    .map((law) => law.refreshLine)
    .join(' ')
  const lifecycle = facts.fidLifecycleStages.join(' → ')

  const lines = [
    `# ECHO Protocol (condensed refresh — full protocol read at session start)`,
    '',
    `Governing law set: the ECHO Protocol (Savant harness ECHO.md v${version}). No signatures, no author attribution — documents speak for themselves.`,
    '',
    '## Laws 1-4 (immutable process)',
    laws14,
    '',
    '## Laws 5-15 (extended, strict mode)',
    laws515,
    '',
    '## Perfection Loop FSM',
    'RED (catalog issues + evidence) → GREEN (minimal fix, robust defaults) →',
    'AUDIT (double-audit: static analysis + runtime; tool output only) →',
    'ADVERSARIAL (refute FAILs, re-audit unevidenced PASSes) → COMPLETE',
    '(converged) → IMPLEMENT. Self-correct on audit failure. Code is written only',
    'after the FID converges.',
    '',
    '## FID lifecycle',
    `${lifecycle} (auto-archive: move to dev/fids/archive/, update CHANGELOG). FID metadata is a claim; the code is ground truth.`,
    '',
    '## Double audit (harness)',
    'Method 1: independent Verifier AUDIT (typecheck/lint/test output). Method 2:',
    'Adversary meta-verification (refute FAILs, re-audit unevidenced PASSes).',
    'Self-reporting is prohibited.',
    '',
    '## Session directives',
    'Flag ANY issue, even out of scope. Honest assessment: verification claims need',
    'tool output; design decisions need documented reasoning. Emergency procedures',
    'for stuck tests/compilation/loops. Work one problem at a time; verify every',
    'change; document as you go; commit atomically.',
  ]
  return lines.join('\n')
}
