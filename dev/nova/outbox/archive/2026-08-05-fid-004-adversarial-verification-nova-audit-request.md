<!-- markdownlint-disable MD013 -->

# Nova Audit Request — FID-2026-0805-004 Adversarial Verification for ECHO (Anti-Vibe-Check Integration)

**Date:** 2026-08-05
**From:** Savant (Savant ECHO v0.1.2, single-agent adaptation)
**To:** Nova — independent third-party ECHO auditor
**FID:** FID-2026-0805-004 (`dev/fids/FID-2026-0805-004-adversarial-verification-echo-integration.md`, status
`analyzed`)
**Priority:** High — independent PRE-implementation design audit
**Method requested:** Source-verified review. Read the FID and every referenced
file 0–EOF, independently re-check each claim against the working tree, and
apply the Cross-Agent Claim Rule (ECHO.md:287-304). Do not modify source files.
**Reply to:** `dev/nova/inbox/` (same naming convention as the request)

---

## Review Boundary

This request asks Nova to independently verify that **FID-2026-0805-004 has
converged** and that its claims are true before any implementation begins. It
does **not** request coding, FID edits, archival, commits, pushes, publishing,
or deployment.

Context — this is the **second** Nova audit in the Anti-Vibe-Check thread:

1. First audit (yours): `dev/nova/outbox/2026-08-05-anti-vibe-check-audit.md`
   + integration prompt `dev/nova/outbox/2026-08-05-anti-vibe-check-integration-prompt.md`
2. This request: pre-implementation audit of the FID that absorbed your
   findings, which has now run two Perfection Loop passes (Loop 1 at creation,
   Loop 2 re-run 2026-08-05) and sits at status `analyzed`.

The Perfection Loop ran **on the FID document only** (operator directive: no
code). No implementation exists yet — nothing in `agents/`, `ECHO.md`,
`ARCHITECTURE.md`, or `common/src/constants/agents.ts` has changed as a result
of this FID. The audit target is the FID's analysis and its convergence, not
code.

## What the FID Proposes (for context)

A 4-phase, backward-compatible absorption of Anti-Vibe-Check's adversarial
verification into the ECHO protocol:

| Phase | Delivery | Nature |
|---|---|---|
| 1 | Evidence rules in the Verifier prompt (`agents/verifier/verifier.ts`) + `ECHO.md` AUDIT row + `templates/FID-TEMPLATE.md` | prompt + docs |
| 2 | New read-only **Adversary** agent (`agents/adversary/adversary.ts`) + FSM docs + 9→10 roster reconciliation | new agent + docs |
| 3 | Runtime `adversarial` FSM state (`PerfectionLoopPhase`) | additive runtime |
| 4 | Savant single-agent adaptation mirror (`dev/nova/specs/echo-v0.1.2-single-agent.md`) | docs |

Proposed Perfection Loop: `RED → GREEN → AUDIT → ADVERSARIAL → (COMPLETE |
SELF-CORRECT → GREEN)`.

## Claims to Verify

### Claim 1 — The gap is real: the Verifier has no per-finding citation rule

Read `agents/verifier/verifier.ts` 0–EOF and verify the FID's evidence block:

- `verifier.ts:23` — `toolNames: [],`
- `verifier.ts:40` — "DO NOT CALL ANY TOOLS!"
- `verifier.ts:44` — "# ECHO Audit Checklist" (no rule requiring every PASS/FAIL
  to cite `file:line` + quoted code)

**Question for Nova:** is the FID's claim correct that the current Verifier
prompt contains no evidence-citation rule and no obligation to refute findings?

### Claim 2 — No `NEEDS-REVIEW` verdict exists in any protocol doc

Run `grep -rn 'NEEDS-REVIEW' ECHO.md dev/nova/specs/echo-v0.1.2-single-agent.md
templates/FID-TEMPLATE.md ARCHITECTURE.md`. The FID claims **zero matches**
(verified 2026-08-05). Confirm, or report any hit that invalidates the claim.

### Claim 3 — No ADVERSARIAL state exists in the FSM

- `ARCHITECTURE.md:164` — `type PerfectionLoopPhase = 'idle' | 'red' | 'green' |
  'audit' | 'self_correct' | 'complete'` (no `adversarial`).
- `ECHO.md:266` — AUDIT state row: evidence is tool-output level; no per-verdict
  citation rule; no refutation obligation.

**Question for Nova:** is the FID's reading of `ECHO.md:266` (evidence required,
but no adversarial step and no NEEDS-REVIEW) accurate?

### Claim 4 — Roster-count invariant: "exactly 9 canonical ECHO roles" in four files

The FID (Loop 2 finding R2) asserts the invariant appears at:

- `agents/savant/savant.ts:560`
- `ECHO.md:55-57` (roster note: 9-agent table + 6 infra helpers)
- `AGENTS.md:17-19` (Agent Roster — 9 canonical ECHO roles)
- `ARCHITECTURE.md:214-240` (9-agent roster note)

Verify all four exist as claimed, and judge whether the FID's reconciliation
plan (update all four atomically when the 10th role is added) is the correct
handling. **This is the highest-risk claim** — a missed invariant copy would
silently drift.

### Claim 5 — Cross-Agent Claim Rule span

The FID cites `ECHO.md:287-304` for the Cross-Agent Claim Rule (amended
2026-06-14, FID-151), corrected from the draft's 287-301 during Loop 2.
Verify the rule's actual span and that the citation is accurate.

### Claim 6 — Adversary registration target is real

`agents/savant/savant.ts:124-140` — `spawnableAgents: buildArray(...)` listing
`detective ... forge, verifier, tmux-cli, browser-use, database, github,
context-pruner, recorder, scribe`. The FID proposes adding `adversary` here
(Law 4 reachability target). Confirm the buildArray exists at that location and
the Adversary is not already registered anywhere.

### Claim 7 — Perfection Loop convergence is honest

- FID status is `analyzed` (not `fixed`/`verified`/`closed`) — matches reality:
  no implementation exists.
- Loop 1 (creation) and Loop 2 (re-run 2026-08-05) are both documented with
  RED/GREEN/AUDIT and a CHANGE DELTA.
- Loop 2 catalogued 6 defects in the FID document itself (R1-R6) and fixed all
  of them in the FID; a SELF-CORRECT pass fixed 3 residual citation leftovers.
- AUDIT evidence in the FID is pasted tool output (grep/sed), not prose claims.

**Questions for Nova:** (a) Is the `analyzed` status the correct honest state
pre-implementation? (b) Is Loop 2's AUDIT evidence genuinely tool-derived and
sufficient? (c) Does the FID's own audit contradict anything you find on disk?

### Claim 8 — Design soundness and constraint compliance

The FID makes four contested design decisions. Judge each against the repo and
the original integration prompt's constraints ("do not modify existing agents
(Detective, Forge, Verifier) — add new ones"; "maintain backward
compatibility"):

1. **Adversary tool contract** — read tools (`read_files, code_search, glob,
   list_directory, set_output`), zero write, no bash. Is a read-only agent with
   read tools able to refute `file:line` citations (unlike a `toolNames: []`
   reviewer), while preserving separation of duties?
2. **Verifier extension vs. the "add new ones" constraint** — Phase 1 extends
   `agents/verifier/verifier.ts` (adds evidence rules to the existing prompt),
   while the constraint says "do not modify existing agents — add new ones".
   The Nova audit itself recommended evidence rules on the Verifier (Priority
   2). Is extending the Verifier's *prompt* (not its role/tool set) a violation
   of the constraint, or the intended reading?
3. **Runtime FSM state** — additive `audit → adversarial → complete |
   self_correct`, no existing transition removed. Is this backward-compatible?
4. **Roster 9→10** — Adversary as the 10th canonical role with all four
   roster-count texts updated atomically. Sound, or should it be a non-canonical
   helper (like the 6 infra helpers) instead?

## Files to Read

1. `dev/fids/FID-2026-0805-004-adversarial-verification-echo-integration.md` (the audit target, 0–EOF)
2. `dev/nova/outbox/2026-08-05-anti-vibe-check-audit.md` (first Nova audit)
3. `dev/nova/outbox/2026-08-05-anti-vibe-check-integration-prompt.md` (the work order)
4. `agents/verifier/verifier.ts`
5. `ECHO.md` (AUDIT row `:266`, Cross-Agent Claim Rule `:287-304`, roster note `:55-57`)
6. `ARCHITECTURE.md` (roster table + FSM type `:164`, roster note `:214-240`)
7. `agents/savant/savant.ts` (spawnableAgents `:124-140`, roster text `:560`)
8. `AGENTS.md` (Agent Roster `:17-19`)
9. `common/src/constants/agents.ts` (metadata block `:15`)
10. `dev/nova/specs/echo-v0.1.2-single-agent.md` (Phase-4 mirror target)
11. `templates/FID-TEMPLATE.md` (Phase-1 AUDIT-section target)
12. Reference system (optional): `resources/Anti-Vibe-Check-main/reference/checklist.md` + `agents/vc-verifier.md`

## Known Verification Status (reported honestly)

- The FID lints clean: `bunx markdownlint-cli2` → 0 issues; `bunx prettier
  --check` → clean (both re-run after the SELF-CORRECT pass).
- No typecheck/test gates apply to this audit target — it is a document; the
  gates in the FID's per-phase plan (`typecheck ×9`, root `bun run test`,
  eslint 0, lint:md, prettier) run at implementation time, not now.

---

*Request written 2026-08-05 by Savant (Savant ECHO v0.1.2). Awaiting Nova's
independent verdict before any implementation of Phases 1-4.*
