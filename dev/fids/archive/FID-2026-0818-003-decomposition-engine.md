<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID-2026-0818-003 — Auto Drive decomposition engine: spec → master FID + child FID backlog

**Severity:** high
**Status:** closed
**ID:** FID-2026-0818-003
**Filename:** `FID-2026-0818-003-decomposition-engine.md`
**Created:** 2026-08-18
**Master FID:** FID-2026-0818-001
**Depends On:** FID-2026-0818-002

## Summary

After the operator confirms the pre-build plan (child 002), the decomposition
engine turns the approved plan into the executable backlog: the master FID
(the plan, rendered as a real FID in `dev/fids/`) plus one child FID per
planned work item. The pipeline is Thinker (sequentialthinking milestones) →
Detective (grounds milestones in real files via `query_blast_radius` /
`query_node_edges` / `query_domain_clusters`) → Recorder (authors the FIDs,
status `created`). A mechanical **manifest check** then proves every plan
item has a FID and every FID traces to a plan item — nothing in the approved
scope can go missing silently.

## Environment

- `agents/thinker/thinker.ts` — Thinker agent, `sequentialthinking` mandate
  (ECHO.md Thinker Protocol: all non-trivial reasoning).
- `agents/detective/detective.ts:61-63` — Detective's knowledge-graph tools:
  `query_blast_radius`, `query_domain_clusters`, `query_node_edges`;
  RED-phase cataloging contract (`:145-146`).
- `agents/recorder/recorder.ts` — Recorder: sole FID author; tools
  `write_file, read_files, glob, code_search, set_output`; no `str_replace`
  (ECHO.md "Spawning the Recorder": CREATE workflow = complete content in
  prompt).
- `dev/fids/` + `templates/FID-TEMPLATE.md` — FID format; filename rule
  `FID-YYYY-MMDD-NNN-{kebab-case-title}.md`; status `created` at birth.
- `packages/agent-runtime/src/echo/fid-validator.ts` + `pre-write-gates.ts` —
  FID completeness + step-status gates; `scripts/fid-ledger.ts` — master/
  dependency graph validation (`:72+`).
- Master-program precedent: `FID-2026-0816-002` (UI overhaul master) +
  children 003-012 — the same umbrella/child pattern.

## Detailed Description

### Problem

A confirmed plan is still prose. Nothing converts "the operator approved
these 9 modules" into "9 FIDs exist, each with the right scope, dependency
order, and numbering" — and nothing mechanically proves the conversion was
complete. Without that, drive mode could implement a subset and declare
victory (the exact 2026-08-16 failure class the anti-deferral gate exists
for).

### Expected Behavior

On confirm: Thinker produces milestone decomposition → Detective grounds each
milestone to real files/dependencies → Recorder drafts the master FID +
children (status `created`, step-status inventory from the plan) → manifest
check PASS (bidirectional coverage + dependency graph legal) → drive mode
(004) starts on the first child.

### Root Cause

FID creation today is interactive and per-finding; nothing batches plan →
FIDs or checks coverage.

### Evidence

- Recorder authoring rules verified in `ECHO.md` (CREATE = complete content;
  "Do NOT read any other files first"; Recorder cannot `str_replace`).
- Knowledge-graph tool registration verified (`agents/detective/detective.ts:61-63`).
- Master/child precedent verified: `dev/fids/README.md` (0816-002 + 003-012;
  0814-007 master + children).
- `scripts/fid-ledger.ts:72+` — graph validation exists: multiple masters
  error; children must declare the master; master must list children;
  dependencies must exist. The manifest check is a strict superset for the
  drive backlog.

## Impact Assessment

### Affected Components

- `agents/thinker/thinker.ts` + `agents/detective/detective.ts` +
  `agents/recorder/recorder.ts` — instruction updates for the decomposition
  contract (structured milestones output, grounding requirement, batched FID
  authoring).
- `packages/agent-runtime/src/run-agent-step/` — new
  `decomposition/` module (orchestration + manifest check).
- `common/src/types/session-state.ts` — decomposition record
  (`planId`, `manifest`, `coverage`).
- `dev/fids/` — the generated backlog (runtime artifacts, not this FID).

### Risk Level

- [x] Medium: pipeline is orchestrative (spawns existing agents); risk is
  coverage gaps, closed by the manifest check + ledger graph.

## Proposed Solution

### Approach

1. **Thinker pass** — sequentialthinking produces `milestones[]` with
   acceptance hints, module boundaries, and dependency edges (schema
   `{id, title, modules[], dependsOn[], acceptance[]}`).
2. **Detective pass** — for each milestone, grounds modules to file paths +
   blast-radius scope; flags oversized milestones (token payload over the
   safety threshold → split request back to Thinker, per the blueprint's
   scale guard).
3. **Recorder pass** — drafts `FID-YYYY-MMDD-NNN-{kebab}.md` per milestone
   (status `created`, full template, Step Status inventory from the plan's
   steps) + the master FID (goal, acceptance criteria, child manifest,
   resolution policy, Run Log skeleton). Uses the CREATE workflow: complete
   content supplied by the orchestrator.
4. **Manifest check (mechanical)** — bidirectional: plan items ⊆ FIDs and
   FIDs ⊆ plan items; numbering unique per day; dependency edges reference
   existing FIDs; ledger graph rules satisfied. Fail → regenerate missing
   FIDs (self-heal) before drive starts.

### Steps

1. Define the milestone schema + Thinker decomposition prompt
   (`agents/thinker/thinker.ts` + prompt).
2. Define the Detective grounding contract (graph tools, blast-radius
   bounds, oversize split).
3. Define the Recorder batch-authoring contract (master + children,
   complete-content CREATE workflow).
4. Implement `decomposition/` orchestration + manifest check in
   `packages/agent-runtime/src/run-agent-step/`.
5. Wire the drive record (`planId`, manifest) into session state.
6. Tests: coverage-missing → fail; extra FID → fail; dependency cycle →
   fail; happy path → PASS with unique numbering.

### Verification

- Unit: manifest check matrix (missing/extra/cycle/dup-number).
- Live: `/auto` fixture goal → plan → decomposition → verify the generated
  `dev/fids/` tree passes `bun run validate:repository` and the manifest
  check before drive starts.

## Step Status

- [x] 1. Milestone schema + Thinker decomposition prompt (`common/src/types/auto-drive.ts`, `agents/thinker/thinker.ts`)
- [x] 2. Detective grounding contract (`agents/detective/detective.ts`)
- [x] 3. Recorder batch-authoring contract (`agents/recorder/recorder.ts`)
- [x] 4. Manifest-check module (`packages/agent-runtime/src/run-agent-step/decomposition/manifest-check.ts`)
- [x] 5. Drive record wiring (`planId` + `manifest` on `DriveRecord`, `common/src/types/session-state.ts`)
- [x] 6. Coverage/dependency/duplicate test matrix (`decomposition/__tests__/manifest-check.test.ts`, 5 cases)

## Perfection Loop

### Loop 1 — RED

- R1. No batch FID generator: Recorder drafts one FID per interactive request.
- R2. No coverage proof: plan → FID conversion can silently drop items
  (2026-08-16 incident class).
- R3. No oversize guard: one giant milestone would blow the context/quality
  envelope in one FID.
- R4. Numbering is manual (allocate next N per day) — automation must keep
  the same rule and uniqueness.

### Loop 1 — GREEN

- G1. Existing agents + tools, new orchestration only (Law 13): Thinker
  (milestones), Detective (grounding, graph tools already registered),
  Recorder (authoring rules already defined).
- G2. Manifest check is mechanical and bidirectional; ledger graph rules are
  the floor (`fid.graph.*`), the manifest is the ceiling (plan coverage).
- G3. Oversize split: Detective flags; Thinker re-splits; no FID exceeds the
  plan's module count/size safety threshold (blueprint's scale guard).
- G4. Master FID is the plan artifact from 002 rendered as a real FID —
  single source of truth, survives L3 restart (007).

### Loop 1 — AUDIT

AUDIT-1 (citations):

- `agents/detective/detective.ts:61-63` — graph tools confirmed. ✓
- `agents/recorder/recorder.ts` — tool set confirmed (no str_replace). ✓
- `ECHO.md` — Recorder CREATE/UPDATE workflow rules confirmed. ✓
- `scripts/fid-ledger.ts:72-130` — graph validation rules read. ✓
- `templates/FID-TEMPLATE.md` — full template read 0-EOF. ✓
- `dev/fids/README.md` — 0816-002 master precedent confirmed. ✓
→ 6/6 verified.

AUDIT-2 (adversarial):

- A2.1 Could the Recorder draft 30 FIDs in one run and hit context limits?
  Batch size is capped (e.g., 5 FIDs per Recorder pass, loop until done) —
  the orchestrator paginates; each pass is independent.
- A2.2 Could a milestone map to zero files (greenfield module)? Greenfield is
  legal — Detective grounds it to the parent package/workspace + dependency
  edges; the manifest tracks it as a planned creation, not a gap.
- A2.3 Could the manifest check pass while FIDs are low-quality? Quality is
  the drive loop's job (004): created status FIDs must still pass the
  structural validator (`fid-validator.ts` REQUIRED_SECTIONS) before the
  queue accepts them — cheap gate at intake.

### Loop 1 — SELF-CORRECT

- SC1: initial design had the Recorder *compose* milestone content; corrected
  to orchestrator-supplied complete content (ECHO.md CREATE workflow — the
  Recorder must not compose).
- SC2: initial manifest was one-directional (plan ⊆ FIDs); added the reverse
  (FIDs ⊆ plan) after AUDIT-2 — an extra FID is scope expansion without
  approval, equally a Law 2 violation.

### Missed Questions

1. Who decides child FID order — creation order or dependency order?
   Decision: dependency order (topological sort of `dependsOn` edges) with
   creation order as tiebreak; the ledger graph already has the walk
   machinery.
2. Where does the master FID's Run Log section get created? Decision: a
   skeleton `## Run Log` section is drafted with the master FID; child 005
   defines the event vocabulary and writer.

### Code Verification Evidence

- All citations verified 2026-08-18 (AUDIT-1 6/6).
- `bun run validate:repository` PASS after drafting (see master Resolution).

## Resolution

- **Status:** `closed` — operator-directed closure + archive 2026-08-18: all
  6 steps `[x]`, gates green. Program-level live decomposition smoke stays
  tracked by master FID-2026-0818-001 (step 8), which closed + archived 2026-08-18.
- The agent-spawn orchestration is prompt-level (Thinker/Detective/Recorder
  contracts, steps 1-3) driven by the supervisor (004); there is no separate
  programmatic spawn pipeline.
- **Closure path:** live decomposition smoke on a fixture goal (needs a live
  model run) → generated tree passes `validate:repository` → closed +
  archived with evidence.

## Lessons Learned

- Authoring rules from ECHO.md (Recorder CREATE workflow) are constraints,
  not suggestions — the orchestrator supplies complete content or the
  Recorder silently stalls.
- Coverage must be proven bidirectionally: a missing FID is a silent scope
  drop; an extra FID is unapproved scope expansion. Both fail the manifest.
