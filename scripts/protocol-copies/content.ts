// =============================================================================
// Generator-authored condensed wording (the single place to edit it)
// =============================================================================

export interface CondensedLaw {
  number: number
  /** Canonical title — must equal the ECHO.md law title (normalized). */
  title: string
  /** A phrase that must appear in the ECHO.md directive row for this law. */
  echoDirectiveKey: string
  /** The exact line rendered in ECHO_PROTOCOL_INSTRUCTIONS. */
  instructionsLine: string
  /** The exact line rendered in the 15-turn refresh. */
  refreshLine: string
}

export const CONDENSED_LAWS: readonly CondensedLaw[] = [
  {
    number: 1,
    title: 'Read 0-EOF Before Touch',
    echoDirectiveKey: 'Every file read completely before any edit',
    instructionsLine:
      '1. **Read 0-EOF Before Touch** — Every file read completely before any edit. No exceptions.',
    refreshLine: '1. Read 0-EOF before touch — no exceptions, no skimming.',
  },
  {
    number: 2,
    title: 'Present Before Act',
    echoDirectiveKey:
      'Every change presented with full impact analysis BEFORE implementation',
    instructionsLine:
      '2. **Present Before Act** — Every change presented with full impact analysis BEFORE implementation.',
    refreshLine:
      '2. Present before act — full impact analysis before implementation; user approval before any code is written.',
  },
  {
    number: 3,
    title: 'Verify Before Proceed',
    echoDirectiveKey: 'Every change verified with build and test commands',
    instructionsLine:
      '3. **Verify Before Proceed** — Every change verified with build/test commands before moving on. No broken builds.',
    refreshLine:
      '3. Verify before proceed — build/test commands from protocol.config.yaml; zero errors, zero warnings.',
  },
  {
    number: 4,
    title: 'Verify Call-Graph Reachability',
    echoDirectiveKey:
      'grep production entry points to confirm it is actually called',
    instructionsLine:
      '4. **Verify Call-Graph Reachability** — After wiring any feature, grep production entry points to confirm it is actually called. Compilation is NOT verification.',
    refreshLine:
      '4. Verify call-graph reachability — grep production entry points after wiring; zero grep results = not wired.',
  },
  {
    number: 5,
    title: 'No pseudo-code, TODOs, or placeholders',
    echoDirectiveKey: 'No pseudo-code, TODOs, or placeholders',
    instructionsLine: '5. No pseudo-code, TODOs, or placeholders',
    refreshLine: '5. No pseudo-code/TODOs/placeholders.',
  },
  {
    number: 6,
    title:
      'No type safety shortcuts — use language-appropriate safe patterns (see coding-standards)',
    echoDirectiveKey: 'type safety shortcuts',
    instructionsLine:
      '6. No type safety shortcuts (no any, no @ts-ignore, no bare except:)',
    refreshLine: '6. No type-safety shortcuts.',
  },
  {
    number: 7,
    title: 'Search for existing code BEFORE creating new',
    echoDirectiveKey: 'Search for existing code BEFORE creating new',
    instructionsLine: '7. Search for existing code BEFORE creating new',
    refreshLine: '7. Search for existing code before creating.',
  },
  {
    number: 8,
    title: 'Log intent before coding',
    echoDirectiveKey: 'Log intent before coding',
    instructionsLine:
      '8. Log intent before coding — document intended change in the session summary before implementation',
    refreshLine: '8. Log intent before coding.',
  },
  {
    number: 9,
    title: 'Generate production-grade documentation',
    echoDirectiveKey: 'Generate production-grade documentation',
    instructionsLine: '9. Generate production-grade documentation',
    refreshLine: '9. Production-grade documentation.',
  },
  {
    number: 10,
    title: 'Update tracking after every feature',
    echoDirectiveKey: 'Update tracking after every feature',
    instructionsLine: '10. Update tracking after every feature',
    refreshLine: '10. Update tracking after every feature.',
  },
  {
    number: 11,
    title: 'Follow discovered patterns EXACTLY',
    echoDirectiveKey: 'Follow discovered patterns EXACTLY',
    instructionsLine: '11. Follow discovered patterns EXACTLY',
    refreshLine: '11. Follow discovered patterns exactly.',
  },
  {
    number: 12,
    title: 'Never expose sensitive data in logs/errors',
    echoDirectiveKey: 'Never expose sensitive data in logs/errors',
    instructionsLine: '12. Never expose sensitive data in logs/errors',
    refreshLine: '12. Never expose sensitive data.',
  },
  {
    number: 13,
    title: 'Utility-first, universal logic',
    echoDirectiveKey: 'Utility-first, universal logic',
    instructionsLine:
      '13. Utility-first, universal logic — one function, one truth',
    refreshLine: '13. Utility-first, universal logic.',
  },
  {
    number: 14,
    title: 'All error paths handled',
    echoDirectiveKey: 'All error paths handled',
    instructionsLine: '14. All error paths handled',
    refreshLine: '14. All error paths handled.',
  },
  {
    number: 15,
    title: 'Build stays clean',
    echoDirectiveKey: 'Build stays clean',
    instructionsLine: '15. Build stays clean — zero errors, zero warnings',
    refreshLine: '15. Build stays clean.',
  },
]

/** Circuit-breaker condensed lines keyed to ECHO.md rule titles (by index). */
export const CONDENSED_CIRCUIT_BREAKERS: readonly string[] = [
  '1. **Max Changes Per Pass** — ~10% of total character count of the FID (markdown heuristic; EHEL enforces strictly for code)',
  '2. **Verification** — after each FID update, verify with exact character match',
  '3. **Convergence Detection** — stop if the FID changes are trivial/minor for 2 consecutive passes (use judgment, not exact percentages)',
  '4. **Oscillation Detection** — if same issue reappears 3 times, escalate',
  '5. **Hard Stop** — 10 maximum iterations per loop',
]

/**
 * Harness framing with no ECHO.md home — the single place to edit this
 * runtime-only wording. Em-dashes/arrows are literal characters here; the
 * generated modules carry them verbatim.
 */
export const FRAMING = {
  /** The 8 anti-pattern bullets kept in the instructions copy. */
  antiPatternBullets: [
    '- "The simplest approach" — enterprise-grade implementations, not simple ones',
    '- "Let me just quickly fix this" — every change is surgical',
    '- Reading only the affected line — MUST read full file 0-EOF',
    '- Making changes without presenting — partner, not rubber stamp',
    '- Skipping verification — broken builds cascade',
    '- Choosing speed over quality — never in a rush',
    '- "Good enough" — good enough is never good enough',
    '- Writing pseudo-code or placeholders — every line must be production-ready',
  ],
  /** FID-authoring paragraphs (canonical phrases validated against ECHO.md). */
  fidAuthoringParagraphs: [
    "Only the Recorder agent may create, update, or archive FID files. Agents without write tools (Thinker, Scout, Researcher) must route FID content through the Recorder. Parent agents with write tools must not write FID files directly from a sub-agent's output. HYBRID-mode exception (operator directive 2026-08-23): the Orchestrator may create and update FID records directly for its own work when no sub-agent authored the content — the Recorder is required only for work above the 100-line escalation threshold, STRICT mode, and loop-closure ceremony.",
    'FIDs are Markdown files that live ONLY in `dev/fids/`. NEVER create top-level directories such as `fids/`, `archive/`, or any path that shadows canonical ECHO paths.',
    'Filename format: `FID-YYYY-MMDD-NNN-{kebab-case-title}.md`. Scan the existing FIDs in `dev/fids/` and `dev/fids/archive/` first to allocate the next available number on the date, and never reuse a number on the same date.',
    'Use `templates/FID-TEMPLATE.md` as the exact template. Required metadata fields: **Filename**, **ID**, **Severity**, **Status**, **Created**, **Author**.',
    'Allowed status values: `created | analyzed | fixed | verified | converged | closed`.',
    'Non-FID design documents go to `docs/design/`, never at the repo root, and never with a `FID-` prefix.',
  ],
} as const
