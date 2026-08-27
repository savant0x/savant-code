#!/usr/bin/env bun
/**
 * Condensed protocol-copy generator (FID-2026-0810-003).
 *
 * Single source of truth for the two condensed protocol copies:
 *
 *   1. `ECHO_PROTOCOL_INSTRUCTIONS` (common/src/constants/agents.ts) — the
 *      full instructions block injected into every harness agent prompt.
 *   2. `buildProtocolRefreshSummary()` (packages/agent-runtime/src/echo/
 *      protocol-summary.ts) — the compact 15-turn refresh.
 *
 * Source-of-truth model (recorded in the FID header):
 *   - `ECHO.md` provides the canonical titles/structure: the 15 law titles +
 *     directives, the 6 FSM state names, the 5 circuit-breaker titles, the 5
 *     questions, the 6 FID-lifecycle stages, and the anti-pattern titles.
 *   - This module hosts the generator-authored condensed wording (curated
 *     directive lines + harness framing with no ECHO.md home: FSM phase
 *     gating, session directives, the no-signature policy, double-audit
 *     wording).
 *   - Validation bridges the two: every curated line is checked against its
 *     ECHO.md anchor, so edits to ECHO.md fail fast until the generator
 *     table is updated in the same commit.
 *
 * The single-agent protocol document is deliberately absent (see the
 * harness-boundary gate in generate-protocol-bundle.ts): it belongs to a
 * third-party harness for outside agents, not the savant-code product.
 */

// =============================================================================
// ECHO.md fact extraction
// =============================================================================

export interface LawFact {
  number: number
  title: string
  /** The ECHO.md directive text for this law (normalized). */
  directive: string
}

export interface ProtocolFacts {
  laws: LawFact[]
  fsmStates: string[]
  circuitBreakers: string[]
  fiveQuestions: string[]
  fidLifecycleStages: string[]
  antiPatternTitles: string[]
  authoringPhrases: string[]
}

/** Strip markdown bold markers and collapse whitespace for comparisons. */
export function normalizeCell(cell: string): string {
  return cell.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
}

/** Extract lines of a markdown table block starting at a heading. */
function tableRowsAfter(lines: string[], heading: string): string[][] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const rows: string[][] = []
  let sawTableRow = false
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue // blank lines between heading and table / rows
    if (!line.startsWith('|')) {
      // Stop at the first non-table content after we've collected rows.
      if (sawTableRow) break
      continue
    }
    if (/^\|[\s\-|]+\|?$/.test(line)) continue // separator row
    sawTableRow = true
    rows.push(
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
  }
  return rows
}

/** Extract a numbered list block starting at a heading (first line of each item). */
function numberedListAfter(lines: string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  const items: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (/^#{1,6}\s/.test(line) || /^-{3,}$/.test(line)) break // next section
    if (/^\d+\.\s/.test(line)) items.push(line)
  }
  return items
}

/** Extract the first fenced code block after a heading. */
function fencedBlockAfter(lines: string[], heading: string): string[] {
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) return []
  let inFence = false
  const content: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trimStart().startsWith('```')) {
      if (inFence) break
      inFence = true
      continue
    }
    if (inFence) content.push(line)
  }
  return content
}

/** Slice a section between two headings (inclusive start, exclusive end). */
function sectionBetween(
  lines: string[],
  startHeading: string,
  endHeadings: string[],
): string {
  const start = lines.findIndex((line) => line.trim() === startHeading)
  if (start === -1) return ''
  let end = lines.length
  for (const endHeading of endHeadings) {
    const idx = lines.findIndex(
      (line, i) => i > start && line.trim() === endHeading,
    )
    if (idx !== -1 && idx < end) end = idx
  }
  return lines.slice(start, end).join('\n')
}

/** Parse the 15 laws from the two ECHO.md law tables. */
export function extractLaws(echoMd: string): LawFact[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const laws: LawFact[] = []
  for (const heading of [
    '### Laws 1-4: The Immutable Process Laws',
    '### Laws 5-15: The Extended Code Laws',
  ]) {
    for (const row of tableRowsAfter(lines, heading)) {
      const cells = row.map(normalizeCell)
      if (cells.length < 2 || !/^\d+$/.test(cells[0])) continue
      // Laws 1-4: [#, Law, Directive, Enforcement]; Laws 5-15: [#, Law, Why].
      const directive = cells[2] ?? cells[1]
      laws.push({ number: Number(cells[0]), title: cells[1], directive })
    }
  }
  return laws.sort((a, b) => a.number - b.number)
}

/** Extract FSM state names from the State Transitions table (first column). */
export function extractFsmStates(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const states: string[] = []
  for (const row of tableRowsAfter(lines, '### State Transitions')) {
    const cell = normalizeCell(row[0] ?? '')
    // Skip the header row (first cell == "State") and any empty cells.
    if (!cell || cell.toLowerCase() === 'state') continue
    states.push(cell)
  }
  return states
}

/** Extract circuit-breaker titles from the numbered rules block. */
export function extractCircuitBreakers(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const titles: string[] = []
  for (const item of numberedListAfter(lines, '### Circuit Breaker Rules')) {
    // "1. **Max Changes Per Pass** — ..." → "Max Changes Per Pass"
    const boldMatch = item.match(/\*\*([^*]+)\*\*/)
    const title = boldMatch
      ? boldMatch[1]
      : item
          .replace(/^\d+\.\s+/, '')
          .split('—')[0]
          .trim()
    titles.push(title)
  }
  return titles
}

/** Extract the five questions verbatim (bold/backtick-normalized). */
export function extractFiveQuestions(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  return numberedListAfter(lines, '## The Five Questions').map((item) =>
    item.replace(/\*\*/g, '').replace(/`/g, ''),
  )
}

/** Extract FID-lifecycle stage names from the fenced diagram block. */
export function extractFidLifecycleStages(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const fence = fencedBlockAfter(lines, '## FID Lifecycle')
  for (const line of fence) {
    const match = line.match(/^\s*(Created\s*→\s*Analyzed[\s\S]*?Archived)/)
    if (match) {
      return match[1]
        .split('→')
        .map((stage) => stage.trim())
        .filter(Boolean)
    }
  }
  return []
}

/** Extract anti-pattern titles (first column) from the Anti-Patterns table. */
export function extractAntiPatternTitles(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  return tableRowsAfter(lines, '## Anti-Patterns (Never Do These)')
    .map((row) => normalizeCell(row[0] ?? '').replace(/['"]/g, ''))
    .filter((cell) => cell && cell.toLowerCase() !== 'anti-pattern')
}

/** Extract the canonical FID-authoring phrases that must survive in the copies. */
export function extractAuthoringPhrases(echoMd: string): string[] {
  const lines = echoMd.replace(/\r\n/g, '\n').split('\n')
  const section = sectionBetween(lines, '### FID Authoring Rules', [
    '### Spawning the Recorder',
    '## Anti-Patterns',
  ])
  const phrases = [
    '## FID Authoring Rules',
    'dev/fids/',
    'FID-YYYY-MMDD-NNN',
    'templates/FID-TEMPLATE.md',
    'Only the Recorder',
    'created | analyzed | fixed | verified | converged | closed',
  ]
  return phrases.filter((phrase) => section.includes(phrase))
}

/** Extract every canonical fact from ECHO.md (fail-fast on missing anchors). */
export function extractFacts(echoMd: string): ProtocolFacts {
  const laws = extractLaws(echoMd)
  if (laws.length !== 15) {
    throw new Error(
      `protocol-copies: expected 15 laws from ECHO.md, found ${laws.length}.`,
    )
  }
  const fsmStates = extractFsmStates(echoMd)
  const circuitBreakers = extractCircuitBreakers(echoMd)
  const fiveQuestions = extractFiveQuestions(echoMd)
  const fidLifecycleStages = extractFidLifecycleStages(echoMd)
  const antiPatternTitles = extractAntiPatternTitles(echoMd)
  const authoringPhrases = extractAuthoringPhrases(echoMd)
  for (const [label, list, min] of [
    ['FSM states', fsmStates, 6],
    ['circuit breakers', circuitBreakers, 5],
    ['five questions', fiveQuestions, 5],
    ['FID-lifecycle stages', fidLifecycleStages, 6],
    ['anti-pattern titles', antiPatternTitles, 8],
    ['authoring phrases', authoringPhrases, 6],
  ] as const) {
    if (list.length < min) {
      throw new Error(
        `protocol-copies: expected at least ${min} ${label} from ECHO.md, found ${list.length}.`,
      )
    }
  }
  return {
    laws,
    fsmStates,
    circuitBreakers,
    fiveQuestions,
    fidLifecycleStages,
    antiPatternTitles,
    authoringPhrases,
  }
}

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

// =============================================================================
// Validation (bridges the curated wording to the ECHO.md anchors)
// =============================================================================

/** Return a list of validation failures (empty = converged). */
export function validateCondensedCopies(echoMd: string): string[] {
  const failures: string[] = []
  const facts = extractFacts(echoMd)
  const instructions = renderInstructions(facts, '0.0.0')
  const refresh = renderRefresh(facts, '0.0.0')
  const normalizedInstructions = instructions.toLowerCase()
  const normalizedRefresh = refresh.toLowerCase()

  // Law titles + key phrases must anchor to ECHO.md and survive in both copies.
  for (const law of CONDENSED_LAWS) {
    const fact = facts.laws.find((l) => l.number === law.number)
    if (!fact) {
      failures.push(`Law ${law.number} not found in ECHO.md.`)
      continue
    }
    const echoTitle = normalizeCell(fact.title).toLowerCase()
    if (echoTitle !== normalizeCell(law.title).toLowerCase()) {
      failures.push(
        `Law ${law.number} title drifted: ECHO.md "${fact.title}" vs generator "${law.title}".`,
      )
    }
    // Laws 5-15 carry a "Why" column (not a directive), so the key phrase may
    // anchor in the title row itself (e.g. "Build stays clean"). Check both.
    const anchorText = `${fact.title} ${fact.directive}`.toLowerCase()
    if (!anchorText.includes(law.echoDirectiveKey.toLowerCase())) {
      failures.push(
        `Law ${law.number} echoDirectiveKey "${law.echoDirectiveKey}" not found in ECHO.md title/directive "${fact.title} ${fact.directive}".`,
      )
    }
    if (!normalizedInstructions.includes(law.instructionsLine.toLowerCase())) {
      failures.push(
        `Law ${law.number} instructionsLine missing from rendered instructions.`,
      )
    }
    if (!normalizedRefresh.includes(law.refreshLine.toLowerCase())) {
      failures.push(
        `Law ${law.number} refreshLine missing from rendered refresh.`,
      )
    }
  }

  // FSM state names must appear in the copies (case-insensitive; hyphen/underscore).
  const combined = `${normalizedInstructions}\n${normalizedRefresh}`
  for (const state of facts.fsmStates) {
    const folded = state.toLowerCase().replace(/[-_]/g, '')
    if (!combined.replace(/[-_]/g, '').includes(folded)) {
      failures.push(`FSM state "${state}" missing from the condensed copies.`)
    }
  }

  // Circuit-breaker titles must appear in the copies and match ECHO.md.
  for (let i = 0; i < facts.circuitBreakers.length; i++) {
    const echoTitle = normalizeCell(facts.circuitBreakers[i]).toLowerCase()
    if (!normalizedInstructions.includes(echoTitle)) {
      failures.push(
        `Circuit breaker "${facts.circuitBreakers[i]}" missing from the instructions copy.`,
      )
    }
  }

  // Five questions must survive verbatim.
  for (const question of facts.fiveQuestions) {
    const normalized = question.toLowerCase().replace(/\*\*/g, '')
    if (!normalizedInstructions.includes(normalized)) {
      failures.push(
        `Five-question "${question}" missing from the instructions copy.`,
      )
    }
  }

  // FID-lifecycle stages must survive in the refresh.
  for (const stage of facts.fidLifecycleStages) {
    if (!normalizedRefresh.includes(stage.toLowerCase())) {
      failures.push(
        `FID-lifecycle stage "${stage}" missing from the refresh copy.`,
      )
    }
  }

  // Anti-pattern bullets must anchor to ECHO.md titles.
  for (const bullet of FRAMING.antiPatternBullets) {
    const title = normalizeCell(bullet)
      .replace(/^-\s*/, '')
      .replace(/['"]/g, '')
    const anchor = title.split('—')[0].trim().toLowerCase()
    if (
      !facts.antiPatternTitles.some((t) => t.toLowerCase().includes(anchor))
    ) {
      failures.push(`Anti-pattern "${title}" not found in the ECHO.md table.`)
    }
  }

  // Authoring phrases must survive in the instructions copy.
  for (const phrase of facts.authoringPhrases) {
    if (!instructions.includes(phrase)) {
      failures.push(
        `Authoring phrase "${phrase}" missing from the instructions copy.`,
      )
    }
  }

  return failures
}
