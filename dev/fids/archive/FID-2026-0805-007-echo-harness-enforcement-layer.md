# FID: ECHO Harness Enforcement Layer (EHEL)

**Filename:** `FID-2026-0805-007-echo-harness-enforcement-layer.md`
**ID:** FID-2026-0805-007
**Severity:** critical
**Status:** closed
**Created:** 2026-08-05 16:00
**Closed:** 2026-08-06
**Archived:** 2026-08-06
**Author:** Savant (Orchestrator)

---

## Summary

ECHO Protocol's 15 laws are currently enforced through system prompt
instructions (behavioral compliance). Agents can and do violate them
— verified in this session when 4 file changes were written without
verification (Law 3), FIDs were created without "Unanswered
Questions" sections (FID Authoring Rules), and the agent wrote FID
files directly instead of routing through the Recorder (FID
Authoring Rules). The EHEL adds a structural enforcement layer
that makes violations impossible at the tool middleware level,
with enforcement severity driven by the existing Hybrid/Strict
mode system.

## Environment

- **OS:** win32
- **Language/Runtime:** TypeScript / Bun
- **Tool Versions:** Savant-Code v0.0.21
- **Commit/State:** Uncommitted working tree on main

## Detailed Description

### Problem

ECHO laws are documented in `ECHO.md` and injected into the agent
system prompt, but enforcement is purely behavioral — the agent
must "choose" to comply. This session produced three distinct
violations:

**Violation 1 — Law 3 (Verify Before Proceed):**
Four file changes were written (FID creation, str_replace on
static-catalogs.ts, FID update, FID rewrite for MD013 compliance)
without running typecheck/lint between writes. The user caught
this, not the system.

**Violation 2 — FID Authoring Rules (Unanswered Questions):**
Two FIDs were created (FID-005, FID-006) without the "Unanswered
Questions" section that ECHO.md mandates under the Perfection Loop
Trigger: *"the Thinker must ask: 'What questions should I have
asked when this FID was created, but failed to?' — surface every
missed question, answer it with the most robust default derivable
from code inspection, and fold those answers directly back into the
existing FID sections."*

**Violation 3 — FID Authoring Rules (Recorder exclusivity):**
FID files were written directly by the Orchestrator instead of
routing through the Recorder agent. ECHO.md states: "Only the
Recorder agent may create, update, or archive FID files."

### Expected Behavior

ECHO laws should be structurally enforced at the tool middleware
level. The harness should make it impossible to violate a law, not
rely on the agent choosing to comply.

### Root Cause

The agent runtime in `packages/agent-runtime/src/run.ts` handles
tool calls without ECHO-aware middleware. Phase gating exists for
`write_file`/`str_replace` (GREEN/SELF_CORRECT only) and
`run_terminal_command` (GREEN/AUDIT only), but there is no
middleware layer that:

1. Tracks which files have been read before allowing edits
2. Tracks dirty files and requires verification before allowing
   more writes
3. Validates FID completeness before allowing status transitions
4. Enforces the Recorder exclusivity rule for FID writes
5. Scans written files for extended law violations (in Strict mode)

### Evidence

```text
# Session violations observed:
1. 4 writes without verification → Law 3 broken
2. 2 FIDs without Unanswered Questions → FID rules broken
3. FIDs written directly → Recorder exclusivity broken
# User quote: "when i designed the system, it's setup to pull
# the model info from openrouter... this should've never happened"
```

### Key Design Decision — Mode-Driven Enforcement

The enforcement tier is determined by the existing execution mode.
No separate config flag is needed.

| Mode | Laws 1-4 | Laws 5-15 | FID Rules |
|------|----------|-----------|-----------|
| **Hybrid** | BLOCKING | Advisory (warnings) | Advisory |
| **Strict** | BLOCKING | BLOCKING | BLOCKING |

This unifies two orthogonal concepts:

- **Execution style**: Hybrid (direct writes) vs Strict (FID-Bound)
- **Enforcement severity**: Derived from the same mode selection

When the user switches modes mid-session, the enforcement tier
updates automatically. No config drift is possible because the
mode IS the enforcement level.

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/run.ts` — tool executor integration
- `packages/agent-runtime/src/echo/` — NEW: enforcement layer
- `agents/savant/savant.ts` — system prompt enforcement docs
- `templates/FID-TEMPLATE.md` — mandatory sections
- `protocol.config.yaml` — mode definitions

### Risk Level

- [x] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Architecture

The EHEL is a middleware layer that intercepts every tool call
through the agent runtime's tool executor. It maintains
per-conversation state and applies blocking rules before and
after tool calls.

**Write permission model:** Only 2 agents have write tools —
Orchestrator and Recorder. All other agents (Detective, Forge,
Verifier, Thinker, Scout, Researcher, Scribe) cannot write files.
The universal 20-line threshold means any agent with write tools
can write any file if the change is ≤ 20 lines. Only FID writes
> 20 lines by the Orchestrator must route through the Recorder.

### Enforcement State

```typescript
// Per-conversation enforcement state
interface EnforcementState {
  // Law 1: Read tracking
  filesRead: Set<string>
  filesWritten: Set<string>

  // Law 3: Verification gate
  dirtyFiles: Set<string>
  hasVerifiedSinceLastDirty: boolean

  // Law 4: Call-graph tracking
  featuresWired: Set<string>
  featuresVerified: Set<string>

  // FID tracking
  fidFilesWritten: Set<string>
  fidValidator: FidValidator

  // Extended law scanners (Strict mode)
  postWriteViolations: Violation[]
}
```

### Pre-Write Blocking Rules

Every `write_file`, `str_replace`, and `apply_patch` call passes
through `beforeToolCall()` which enforces the following:

| Check | Law | Mode | Response |
|-------|-----|------|----------|
| Path not in `filesRead` AND not new file | 1 | Both | BLOCK — "Law 1: Read 0-EOF first" |
| `dirtyFiles.size > 0` AND no verification since last dirty | 3 | Both | BLOCK — "Law 3: Verify before more writes" |
| Target is `dev/fids/FID-*.md` AND change > 20 lines AND caller is Orchestrator | FID | Both | BLOCK — "FID > 20 lines — route through Recorder" |
| File is `dev/fids/FID-*.md` AND missing required sections | FID | Strict | BLOCK — "FID Rule: Missing mandatory sections" |
| No search since entering GREEN before writing new file | 7 | Strict | BLOCK — "Law 7: Search before create" |
| No intent logged in session/FID before first write | 8 | Strict | BLOCK — "Law 8: Log intent first" |

> **Write Permission Model:** Only 2 agents have write tools —
> Orchestrator and Recorder. All other agents (Detective, Forge,
> Verifier, Thinker, Scout, Researcher, Scribe) cannot write files.
>
> **Universal 20-line threshold:** Any agent with write tools can
> write any file (including FIDs) if the change is ≤ 20 lines.
> Only FID writes > 20 lines by the Orchestrator are blocked
> and must route through the Recorder.

> **Law 2 note:** No separate middleware check. The `transition_phase`
> to GREEN already requires Law 2 compliance — the agent must have
> presented a plan before entering GREEN. The phase gate enforces
> Law 2 structurally. (Nova Q1 resolution)

### Post-Write Scanning Rules (Batched at Turn End)

Post-write scanners are NOT run after each individual write.
Instead, they are batched and run once at turn end (like Law 3).
This reduces overhead from N writes x M scanners to 1 turn x M
scanners. If violations are found at turn end, the agent is
blocked from starting a new turn until violations are resolved.
(Nova Q6 resolution)

| Check | Law | Mode | Response |
|-------|-----|------|----------|
| Verify typecheck/lint passes | 3, 15 | Both | Mark clean or add to dirtyFiles |
| `code_search` for `TODO`, `FIXME`, `placeholder` | 5 | Strict | BLOCK — "Law 5: No pseudo-code" |
| `code_search` for `any`, `@ts-ignore` | 6 | Strict | BLOCK — "Law 6: No type shortcuts" |
| `code_search` for `password`, `secret`, `token` | 12 | Strict | BLOCK — "Law 12: No sensitive data" |
| New public export lacks JSDoc | 9 | Strict | BLOCK — "Law 9: Production docs" |
| Promise without `.catch()` or `await` in `try` | 14 | Strict | BLOCK — "Law 14: Handle errors" |
| Unhandled path without status change | 10 | Strict | BLOCK — "Law 10: Update tracking" |

### Law 4 — Turn-End Call-Graph Evaluation

Law 4 is enforced at turn end, not per-write. If the agent wrote
an `export` statement or wired a new feature but did not run
`code_search` or `grep` for callers, a compliance warning is
emitted. This catches the pattern without adding complexity to
the pre-write gate. (Nova Q2 resolution)

### Laws 11 and 13 — Verifier Only

Laws 11 (Follow discovered patterns) and 13 (Utility-first, one
function one truth) are NOT enforced by the middleware. These are
semantic checks requiring codebase understanding and AST analysis.
The Verifier already checks pattern compliance. They can be added
as middleware checks in follow-up FIDs. (Nova Q5 resolution)

### FID Completeness Validator

The `FidValidator` class checks FID markdown files for structural
completeness before allowing creation or status transitions:

**Required sections (all modes):**

1. Summary
2. Environment
3. Detailed Description (Problem, Expected, Root Cause, Evidence)
4. Impact Assessment
5. Proposed Solution (Approach, Steps, Verification)
6. Perfection Loop
7. Resolution
8. Lessons Learned

**Additional required sections (Strict mode):**

9. Unanswered Questions (minimum `MIN_UNANSWERED_QUESTIONS` per medium+ severity)
10. Code Verification Evidence (checkboxes)

**Status transition rules:**

- `created → analyzed`: Proposed Solution section non-empty
- `analyzed → fixed`: Resolution section non-empty
- `fixed → verified`: All Code Verification Evidence checked
- `verified → closed`: Auto-archives to `dev/fids/archive/` + CHANGELOG entry appended

(Per ECHO.md FID Lifecycle — transition logic reuses the existing
lifecycle spec, not a parallel implementation.)

### Recorder gate (narrow)

The Recorder gate only applies when ALL three conditions are met:

1. Target file matches `dev/fids/FID-*.md`
2. Change exceeds 20 lines
3. Caller is the Orchestrator (not the Recorder)

If all three are true, the write is BLOCKED and the Orchestrator
must route through the Recorder. If any condition is false (e.g.,
change is ≤ 20 lines, or caller IS the Recorder), the write
passes through.

This is a narrow gate, not a blanket FID write ban. Quick edits
(status changes, single-line fixes) can be done directly by the
Orchestrator.

### Advisory Mode (Hybrid)

In Hybrid mode, Laws 5-15 and FID rules are advisory:

- Violations are included in the tool call response as warnings
- The agent is NOT blocked
- Warnings are logged to the session state for Scribe review
- The agent can choose to self-correct or ignore

```typescript
// Advisory warnings surfaced in Hybrid mode
interface AdvisoryWarning {
  law: number
  severity: 'info' | 'warning'
  message: string
  file?: string
  line?: number
}
```

### Integration Points

The middleware integrates into the existing tool execution pipeline
in `packages/agent-runtime/src/run.ts`:

```typescript
// Integration into the tool executor loop:
const enforcement = new EchoEnforcement(mode, agentId)
const preCheck = enforcement.beforeToolCall(toolName, args)
if (preCheck.blocked) {
  return { error: preCheck.reason }
}
if (preCheck.warnings.length > 0) {
  // Append advisory warnings (Hybrid mode)
  result.warnings = preCheck.warnings
}
// ... execute tool ...
const postCheck = enforcement.afterToolCall(toolName, args, result)
if (postCheck.blocked) {
  return { error: postCheck.reason }
}
```

### Files to Create

```text
packages/agent-runtime/src/echo/
├── index.ts                    # Public API
├── enforcement.ts              # Core middleware class
├── enforcement-state.ts        # Per-conversation state
├── pre-write-gates.ts          # Laws 1-4, 7, 8 pre-checks
├── post-write-scanners.ts      # Laws 5-6, 9, 12, 14, 15
├── fid-validator.ts            # FID completeness validation
├── recorder-gate.ts            # FID Recorder exclusivity
├── violation-handler.ts        # Error/advisory messages
├── advisory-logger.ts          # Advisory mode logging
└── types.ts                    # Shared types
```

### Files to Modify

```text
packages/agent-runtime/src/run.ts          # Integrate middleware
agents/savant/savant.ts                     # System prompt update
templates/FID-TEMPLATE.md                   # Add Unanswered Questions
protocol.config.yaml                        # Document mode enforcement
```

## Perfection Loop### Loop 1

- **RED:** Three violations cataloged with evidence — Law 3,
  FID Authoring Rules (Unanswered Questions), Recorder exclusivity.
  Root cause: no structural enforcement layer exists.
- **GREEN:** ✅ FID authored with complete architecture spec
  covering all 15 ECHO laws, mode-driven enforcement, middleware
  integration, FID validator, advisory mode, and 10 answered
  questions.
- **AUDIT:** ✅ Verifier approved. Markdownlint 8→0 errors fixed.
  Prettier clean.
- **Nova Review:** ✅ 6 design questions resolved (Q1-Q6).
  Status updated: created → analyzed.
- **CHANGE DELTA:** 1 file updated (~40 new lines for Nova
  resolutions and architecture refinements)

### Unanswered Questions

> ECHO.md Perfection Loop Trigger: the Thinker must ask:
> "What questions should I have asked when this FID was created,
> but failed to?" Surface every missed question, answer it with the
> most robust default derivable from code inspection, and fold those
> answers directly back into the existing FID sections.

1. **How does enforcement handle multi-agent sessions where both
   the Orchestrator and Forge write files?**
  → Only 2 agents have write tools — Orchestrator and Recorder.
  Each gets its own `EnforcementState` keyed by `agentId`.
  The Orchestrator's state tracks its reads/writes; the
  Recorder's state tracks its FID operations independently.
  The Recorder gate only applies to the Orchestrator writing
  FIDs > 20 lines — the Recorder can write FIDs of any size.

2. **What happens when mode switches mid-session (Hybrid →
   Strict or vice versa)?**
   → The `EnforcementState.mode` field updates immediately. Future
   tool calls use the new enforcement tier. Existing violations
   logged under the old tier are NOT retroactively enforced — only
   new writes are checked against the new tier. This prevents
   thrashing from mode toggling.

3. **How do you test the enforcement layer itself?**
   → The enforcement middleware is a pure function:
   `beforeToolCall(state, toolName, args) → { blocked, warnings }`
   and `afterToolCall(state, toolName, args, result) → { blocked,
   warnings }`. Each gate is a separate function with deterministic
   inputs. Unit tests pass known states and assert blocking/non-
   blocking behavior. Integration tests run the full tool executor
   with enforcement enabled and verify end-to-end blocking.

4. **What is the performance overhead of post-write scanners
   on every tool call?**
   → Post-write scanners use `code_search` with targeted regex
   patterns (e.g., `/\bTODO\b/`, `/\bany\b/`). These run against
   the specific file that was just written, not the entire codebase.
   For files under 1000 lines, this is sub-millisecond. The scanner
   is lazy — it only runs after `write_file`/`str_replace`, not
   after read-only tools like `glob` or `read_files`.

5. **How does enforcement interact with the context-pruner
   agent that runs between steps?**
   → The context-pruner only reads and calls `set_messages` — it
   never writes code files. It is exempt from Law 1 and Law 3
   enforcement. Its tool calls pass through the middleware without
   blocking. The middleware recognizes `set_messages` and
   `set_output` as non-mutating tools and skips enforcement.

6. **What happens when the enforcement layer itself has a bug
   — does it block all progress?**
   →The enforcement layer includes a `bypassEmergency` mechanism.
The agent can REQUEST a bypass, but the user must CONFIRM via
`ask_user` before it takes effect. This prevents accidental
bypass while allowing human override when the enforcement layer
has bugs. All bypass events are logged to CHANGELOG as critical
events. (Nova Q4 resolution)

7. **How do you handle false positives from Law 7 (search
   before create) for genuinely novel files?**
   → Law 7 checks: "Has the agent searched for anything since
   entering GREEN phase?" If yes, Law 7 passes. It doesn't
   require finding a specific match — it requires the *act of
   searching*. This catches the "write first, search never"
   pattern while allowing searches that happened during RED
   phase to count. (Nova Q3 resolution)

8. **How does the FID validator handle existing FIDs that
   predate the Unanswered Questions requirement?**
   → Existing FIDs in `dev/fids/` and `dev/fids/archive/` are
   grandfathered — the validator only runs on new FIDs (create)
   or status transitions. Existing FIDs with status `created` or
   `analyzed` are not retroactively validated. Only when they
   transition to `fixed`, `verified`, or `closed` do the full
   checks apply.

9. **What is the recovery path when an enforcement block is
   wrong — the agent is actually compliant?**
   → The blocking response includes the specific check that failed,
   the evidence, and a suggested resolution path. The agent can
   satisfy the check and retry. For example, if Law 1 blocks a
   write because the file wasn't read, the agent reads it and
   retries. The middleware is stateless per-tool-call — it re-evaluates
   on each call, so satisfying the check immediately unblocks.

10. **How does enforcement propagate to spawned sub-agents
    (Detective, Scout, etc.)?**
    → Sub-agents (Detective, Forge, Verifier, Thinker, Scout,
    Researcher, Scribe) do NOT have write tools — they cannot
    write files at all. They route through the Orchestrator or
    Recorder for any output. The enforcement middleware only
    gates the 2 agents that have write tools: Orchestrator and
    Recorder. Sub-agents are exempt from write-gate enforcement
    because they have nothing to gate.

### Nova Design Review Resolutions

Nova (independent third-party ECHO auditor) reviewed FID-007
and posed 6 design questions. All 6 have been resolved and
folded into the architecture above.

| # | Question | Resolution |
|---|----------|------------|
| Q1 | Law 2 mechanical check | **Phase transition implies plan.**
  The `transition_phase(green)` gate already requires Law 2
  compliance. No separate middleware check needed. |
| Q2 | Law 4 location | **Turn-end evaluation.** Law 4 enforced
  at turn end: if agent exported a feature without grepping
  for callers, emit compliance warning. |
| Q3 | Law 7 window | **Search since entering GREEN.** "Has the
  agent searched for anything since entering GREEN phase?"
  replaces the arbitrary "last 3 tool calls" heuristic. |
| Q4 | Emergency bypass | **Agent requests, user confirms.** Agent
  can request bypass via `ask_user`, but user must confirm.
  All bypass events logged to CHANGELOG. |
| Q5 | Laws 11, 13 | **Skip in middleware.** These are semantic
  checks requiring AST analysis. Left to the Verifier.
  Can be added as follow-up FIDs. |
| Q6 | Performance | **Batch scanners at turn end.** Post-write
  scanners run once at turn end, not after each write.
  Reduces N writes x M scanners to 1 turn x M scanners. |

### Code Verification Evidence

- [x] Files referenced in "Affected Components" exist in codebase
- [ ] Implementation matches the proposed solution (pending implementation)
- [ ] Typecheck passes: [pending]
- [x] FID status reflects current state (analyzed)

## Resolution

- **Fixed By:** Savant (EHEL implementation + follow-up hardening)
- **Fixed Date:** 2026-08-05 (implemented) / 2026-08-06 (follow-up fixes + closure)
- **Fix Description:** Implemented the ECHO Harness Enforcement Layer in
  `packages/agent-runtime/src/echo/` (`enforcement`, `pre-write-gates`,
  `post-write-scanners`, `law4-turn-end`, `fid-validator`, `violation-handler`,
  `advisory-logger`, `enforcement-state`, `types`) wired into the tool
  executor (`native.ts`). Pre-write gates block Laws 1/3/7/8 + the FID
  Recorder gate; post-write scanners + Law 4 call-graph evaluation run at
  turn end; enforcement is mode-driven (Hybrid = advisory for extended laws,
  Strict = all-15 blocking). Follow-up fixes on 2026-08-06: (1) the Law 1
  gate no longer blocks new-file writes in hybrid mode (new files exempt;
  hybrid is inert — the non-blocking EchoComplianceTracker owns the
  advisory receipt); (2) advisory warnings emit with their ACTUAL law
  (`law7`/`law8` via the `ComplianceWarningLaw` wire type) instead of a
  hardcoded `law1`; (3) strict-mode Law 7/8 blocks now inject budgeted
  `ECHO_STEERING` corrective text into the agent's message history. Full
  detail in CHANGELOG v0.0.22 (EHEL) and v0.0.23 Fixed.
- **Tests Added:** Unit tests for the tracker (`echo-compliance.test.ts`),
  the pre-write gates (`pre-write-gates.test.ts`, 6 tests), the
  violation-handler law mapping/chunks (`violation-handler.test.ts`),
  enforcement steering (`enforcement.test.ts`, 5 tests), and tool-executor
  wiring (`echo-compliance-wiring.test.ts`, incl. strict-mode law7 receipt +
  steering-in-history). agent-runtime suite: 685 pass / 0 fail.
- **Verified By:** Full agent-runtime (685), CLI (2852) and SDK (439)
  suites, typecheck ×10, ESLint zero-warnings, `bunx prettier --check .`,
  `bun run lint:md`.
- **Commit/PR:** Uncommitted — part of the v0.0.22/v0.0.23 release working
  tree.

## Lessons Learned

1. Behavioral compliance (system prompt instructions) is necessary
   but not sufficient for engineering governance. Structural
   enforcement (tool middleware) makes violations impossible.
2. Enforcement tiers should be derived from existing mode selection,
   not from a separate config flag. One concept, one knob.
3. The "Unanswered Questions" requirement from ECHO.md's Perfection
   Loop Trigger must be structurally enforced in the FID validator,
   not left to agent compliance.
4. Advisory mode (Hybrid) should still surface violations as
   warnings so agents can build good habits without the overhead
   of blocking enforcement.
