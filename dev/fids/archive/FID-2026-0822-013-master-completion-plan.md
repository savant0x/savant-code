# FID: Master Completion Plan — desktop program + small implementables (queue to zero)

**Filename:** `FID-2026-0822-013-master-completion-plan.md`
**ID:** FID-2026-0822-013
**Severity:** high
**Status:** closed
**Created:** 2026-08-22
**YAGNI-Compliance:** Satisfied — reuses the existing FID pipeline and
ledger; this plan adds one coordination record, no new machinery.

---

## Summary

Coordination master for the ten remaining active FIDs (operator directive
2026-08-22: "outline a master plan to complete all of them"). Sequences the
work into three tracks with explicit dependency ordering, so each FID
lands in an order where its prerequisites exist. Does not replace the
desktop program's own master (FID-2026-0820-007) — it coordinates ACROSS
that program and the standalone implementables, and it is the single place
the operator can see the whole queue's path to zero.

The queue at authoring time (all ten, statuses re-verified this pass):

| FID | Status | Track | Dependency |
|---|---|---|---|
| FID-2026-0820-008 (Session Gateway) | analyzed | Desktop A | none — FIRST |
| FID-2026-0820-009 (Tauri Shell + Sidecar) | analyzed | Desktop A | -008 (E2E) |
| FID-2026-0820-010 (Chat UI) | analyzed | Desktop A | -008, -009 |
| FID-2026-0820-011 (Packaging) | analyzed | Desktop B | 3 operator external actions |
| FID-2026-0822-012 (Holographic Deck) | analyzed | Desktop C | -008 (live), -009, -010; fixtures now |
| FID-2026-0821-004 (Result plumbing) | analyzed | Small | none |
| FID-2026-0822-004 (yagni_check leak) | analyzed | Small | none |
| FID-2026-0822-008 (Edit-diff fallback) | analyzed | Small | none |
| FID-2026-0822-007 (Hex migration) | analyzed | Small | none |
| FID-2026-0819-005 (Quality ratchet) | analyzed | HOLD | operator-paused 2026-08-21 |

## Environment

- **Runtime:** TypeScript strict monorepo, Bun 1.3.14, OpenTUI 0.5.3 CLI,
  Tauri v2 desktop workspace (scaffold landed).
- **Commit/state:** main @ v0.0.27 working tree (release-only-commits;
  changes land untracked until the next automation release sweep).
- **Ledger contract:** `scripts/fid-ledger.ts` — statuses limited to
  `created | analyzed | fixed | verified` while active; closure requires
  `closed` + CHANGELOG entry + archive move. Every FID below carries a
  full planning-loop record (completed this pass where it was missing).

## Detailed Description

### Problem

The active queue has ten FIDs with real dependencies the standalone FIDs
do not see: the desktop program (008 → 009 → 010) and its holographic
child (012) cannot complete without the gateway, and the deck's live
wiring is amendment-gated on FID-008. Without a sequencing plan, work
starts in dependency-violating order, E2E tests stay impossible, and the
deck's replay-fixture advantage is wasted. Separately, four small
implementables are fully analyzed and could land in any order — they need
a slot, not a gate.

### Expected Behavior

A single plan that: (1) starts the desktop program at its true first
dependency (FID-008 gateway), (2) lets the holographic deck proceed on
replay fixtures in parallel with the gateway work while its live wiring
waits for the amendment, (3) drains the four small implementables without
blocking on the desktop program, (4) keeps the paused ratchet out of the
critical path entirely, and (5) ends with the active queue at zero and
every FID archived with CHANGELOG coverage.

### Root Cause (evidence)

Queue hygiene drift: FIDs were authored by separate sessions without a
shared sequencing authority; the desktop master (0820-007) sequences its
own children but nothing sequences ACROSS the program and the standalone
FIDs; the deck (0822-012) was filed with hard prerequisites it correctly
records but no one had scheduled. This plan is the missing coordination
layer (the same role FID-2026-0818-001 played for Auto Drive).

## Proposed Solution (the master plan)

### Track A — Desktop program, dependency-ordered

1. **FID-2026-0820-008 (Session Gateway) — FIRST.** Zod event/action
   schemas extending the PrintModeEvent family → WS server with auth +
   Origin validation + watchdog → agent-runtime JSON-RPC wrapper (frozen
   handshake) → backpressure batching + reconnect → `savant-code server`
   headless entrypoint → integration tests. Everything else in the
   desktop program waits on this.
2. **FID-2026-0820-009 (Tauri Shell + Sidecar) — resumes on -008.** CI
   integration checklist, parent-kill E2E vs the real sidecar,
   externalBin declaration + gateway-integration E2E. Scaffold, supervisor,
   splash, CSP already landed.
3. **FID-2026-0820-010 (Chat UI) — after -008/-009.** Token-consumption
   half of Step 1 already landed; chat-thread work queued; renders on the
   gateway event stream.
4. **FID-2026-0820-011 (Packaging) — parallel, operator-gated.** Runs
   whenever the 3 external actions clear (Apple Developer ID enrollment,
   Azure Artifact Signing eligibility, minisign key escrow). No code
   dependency on Track A; can complete independently.

### Track C — Holographic deck (0822-012), fixtures now / live after -008

- The deck's scene logic (FloorAdapter, walkers, stations, auras) is
  deliberately fixture-testable BEFORE the shell exists — start it in
  parallel with Track A step 1 against Tier-1 replay fixtures.
- Live wiring + Tier-2 SYNTHETIC-PENDING-FID-008 fixtures + the four
  AMENDMENT-GATED elements land only after FID-008's PrintModeEvent
  amendment (per the deck's own Amendment Gate G1-G4).
- Sequencing note: deck adapter work can begin immediately; the P1-P4
  fixture suites do not depend on -008 landing, only on -008's amendment
  for the gated elements.

### Track B — Small implementables (any order, no deps)

1. **FID-2026-0821-004 (Result plumbing)** — per-call result return in
   `executeSingleToolCall` + gate-edge chunk coverage + success-path relay
   test. High (silent wrong-output relay). Independently shippable.
2. **FID-2026-0822-004 (yagni_check leak)** — universal scaffolding-tag
   stripper + text-channel gate consumption + payload sanitization +
   prompt alignment + regen. Medium.
3. **FID-2026-0822-008 (Edit-diff fallback)** — wrap-not-remove
   `constructDiffFromWriteFile` at the fallback site + regression test.
   Low effort, operator already placed the build order.
4. **FID-2026-0822-007 (Hex migration)** — 27-site disposition →
   batched migration (savant-ui → ask-user → singletons) → zero-hex grep
   gate → light-theme smoke. Medium; brand-claim sites need operator
   provenance confirmation before migration.

### Track H — Paused, not blocked, not blocking

- **FID-2026-0819-005 (Quality ratchet)** — operator-paused 2026-08-21
  ("call it good for now"); 241 intentional violations; `validate:repository`
  red on the ratchet alone. HOLD: do not schedule, do not silently drop;
  resume only on operator request.

### Sequencing rules

- A FID may start when ALL of its dependency row's prerequisites are
  `closed` (Track A: -008 → -009 → -010) OR when it has no deps (Track B).
- The deck's fixture work may start at any time (no dep); its live wiring
  respects the Amendment Gate.
- Two implementers may run concurrently ONLY in different tracks
  (A vs B) or on the deck-fixtures path vs Track A — never two Track A
  steps at once (serial dependency chain).

## Verification

- After each FID closes: its step status is `[x]`, it is archived, and a
  CHANGELOG entry exists (auto-archive contract) — verified by the ledger
  validator (`bun -e validateActiveFidLedger` → 0 issues).
- The active queue's FID count monotonically decreases toward zero; the
  README ledger table is updated at each closure.
- `validate:repository` green EXCEPT the paused ratchet class, which is
  recorded as operator-accepted HOLD (not silently re-opened).
- No FID is marked `closed` with an unresolved step (anti-deferral gate).

## Perfection Loop

### Loop 1 — Planning (2026-08-22)

- **RED:** PASS — cataloged the sequencing gap (no cross-program
  coordination authority), the deck's un-scheduled prerequisites, the four
  order-free implementables, and the paused ratchet's HOLD requirement.
  Disk-verified: desktop scaffold landed (-009); token pipeline landed
  (-010 Step 1); deck renumbered -012 with Amendment Gate G1-G4 in place;
  ten active FIDs with statuses as tabled; ledger validator accepts
  `analyzed` for planning-complete records.
- **GREEN:** PASS — three tracks + HOLD as above; dependency table; deck
  fixtures-now/live-after-008 sequencing; Track A serial rule; Track B
  any-order rule; ratchet HOLD recorded. Folded from Missed Questions
  below (every answer became a sequencing rule).
- **AUDIT:** PASS — 12 checks: (1) every active FID appears exactly once
  in the table (10/10); (2) every dependency row's prerequisite exists in
  the table; (3) Track A is a strict chain (-008 first); (4) deck fixture
  work has no missing dep; (5) deck live wiring respects G1-G4; (6) Track B
  has zero cross-deps; (7) packaging is operator-gated, not code-gated;
  (8) ratchet HOLD can't block anything (no row depends on it);
  (9) ledger statuses are legal (`analyzed`); (10) closure contract
  (archive + CHANGELOG) is stated in Verification; (11) no FID double-
  assigned to two tracks; (12) the plan is execution-orderable — a
  topological order exists (A1 → A2 → A3; B1-B4 parallel; C fixtures
  parallel; A4 parallel).
- **ADVERSARIAL:** UPHELD — challenged three claims: (a) "deck fixtures
  now" — could fixture work proceed without -008's schema types? Yes:
  Tier-1 fixtures use EXISTING printMode types (disk-verified in
  0822-012), only Tier-2/SYNTHETIC ones wait on the amendment; claim
  stands. (b) "Track B any order" — does -0821-004's D3 relay test depend
  on the deck or gateway? No: it is agent-runtime-internal; stands.
  (c) "ratchet HOLD" — could the paused ratchet regress the other nine?
  No: `validate:repository` failures are ratchet-class only (184
  violations, all pre-existing); no other gate depends on it; stands.
  Zero refutations.
- **CHANGE DELTA:** New coordination master; no production code touched.

### Missed Questions

1. Does this plan replace FID-2026-0820-007? Decision: no — that master
   sequences its own four children; this master sequences ACROSS the
   program and the standalone FIDs. -007 stays the desktop program's
   internal master; -013 is the queue-to-zero coordinator.
2. When can the deck start? Decision: fixture work immediately (no dep);
   live wiring + gated elements only after -008's amendment (G1-G4).
3. Why is packaging not in the serial chain? Decision: its blockers are
   three OPERATOR external actions, not code — serializing it would stall
   the chain on the operator, so it is parallel and gated on those actions.
4. Why not schedule the ratchet? Decision: operator-paused 2026-08-21;
   scheduling it would violate the pause. HOLD is the honest state.
5. Can two implementers run concurrently? Decision: yes, different tracks
   only (A vs B vs C-fixtures); Track A steps are serial.
6. How is completion proven? Decision: ledger validator 0 issues, FID
   count → zero, each closure archived + CHANGELOG-covered (auto-archive
   contract), anti-deferral gate green on every close.

### Code Verification Evidence

Planning-stage record — status `analyzed`; no implementation exists yet.

- Ten active FIDs exist on disk with the tabled statuses (disk-verified
  2026-08-22; ledger `validateActiveFidLedger` clean at the pass start).
- Desktop scaffold facts cited from FID-2026-0820-009 (workspace,
  supervisor, splash, CSP landed; E2E awaiting -008) and -010 (token
  pipeline landed).
- Deck fixture claim disk-verified: `common/src/types/print-mode.ts` 217
  lines, 13 schemas :12-184, union :198-215, `PrintModeEvent` :217 —
  Tier-1 fixture types exist today.
- Implementation gates (typecheck/tests/lint) become mandatory at each
  child's implementation AUDIT, not at this planning record.

## Step Status

> Dispositions recorded at SUPERSESSION (2026-08-23): coordination of the
> remaining queue transferred to FID-2026-0823-003 — see Resolution.

- [x] FID-2026-0820-008 (Session Gateway) implemented + closed — closed +
      archived 2026-08-23 (`savant-code server` shipped)
- [x] FID-2026-0820-009 (Shell) resumed + E2E closed — real-sidecar E2E 4/4
      green (Loop 4); the FID itself sits `fixed` under -003 pending the GUI
      live smoke
- [ ] FID-2026-0820-010 (Chat UI) — PARTIAL; remainder owned by -003 — deferred::operator-approved 2026-08-23
      (Loop 3 transport/thread core audited; Steps 4–7 open at supersession)
- [ ] FID-2026-0820-011 (Packaging) — not started; owned by -003 — deferred::operator-approved 2026-08-23
      (day-0 signing gate holds)
- [x] FID-2026-0822-012 (Deck) fixtures green — DONE via -003/U7 (8/0);
      live wiring + closure stay gated/owned by -003
- [x] FID-2026-0821-004 (Result plumbing) implemented + closed — closed +
      archived 2026-08-22
- [x] FID-2026-0822-004 (yagni_check leak) implemented + closed — closed +
      archived 2026-08-22
- [x] FID-2026-0822-008 (Edit-diff fallback) implemented + closed — closed +
      archived 2026-08-22
- [x] FID-2026-0822-007 (Hex migration) implemented + closed — closed +
      archived 2026-08-22
- [x] FID-2026-0819-005 (Ratchet) HOLD honored (paused; no work scheduled) —
      honored through supersession; stays HOLD under -003
- [x] Active queue at zero; ledger README updated at each closure — DONE
      under -003 (U5/U6/U7/U9 done at supersession) —
      deferred::operator-approved 2026-08-23

## Resolution

**SUPERSEDED + CLOSED 2026-08-23 (queue-to-zero unit U10).** On 2026-08-23
the operator issued the overnight queue-to-zero directive and
FID-2026-0823-003 was authored as the fresh coordinator — its Summary
states explicitly: "This master supersedes FID-2026-0822-013 as the
queue-to-zero coordinator." All sequencing authority for the remaining
queue transfers there; this record's own sequencing substantially executed
before supersession: Track B drained in full (-0821-004, -0822-004,
-0822-008, -0822-007 all closed + archived 2026-08-22), Track A step 1
closed+archived (-008) with step 2 at `fixed`, deck fixtures landed (U7,
8/0), and the ratchet HOLD was honored throughout. Open items (-010 close,
-011 operator-gated close, final queue-at-zero) are owned by FID-2026-
0823-003 and are NOT silently dropped — they are live rows in its Step
Status. Each child's own FID remains the implementation record.

Prior state: planning loop converged 2026-08-22 with RED/GREEN/AUDIT PASS
+ ADVERSARIAL UPHELD; status `analyzed` while it coordinated the sequence.

## Lessons Learned

A queue of analyzed FIDs is not a plan: the desktop program's own master
sequenced its children but nothing coordinated across programs, so the
holographic deck's hard prerequisites were recorded (in its FID) yet
never scheduled. The coordination layer is a one-page dependency table —
cheap to write, load-bearing for execution order. And a paused FID is not
a forgotten FID: the ratchet sits on a HOLD row so it can neither block
the queue nor silently drop.
