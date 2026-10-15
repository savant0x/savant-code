# FID: Office Presentation-Layer Ruling Audit (T17-B) — scope superseded; audit + smoke handoff

**Filename:** `FID-2026-0906-006-office-presentation-audit.md`
**ID:** FID-2026-0906-006
**Severity:** medium
**Status:** closed
**Created:** 2026-09-06
**YAGNI-Compliance:** Verified
**Related:** SCOPE T17-B (operator ruling 2026-09-06: authorize build),
FID-2026-0905-005 (office-scene decomposition — the superseding work),
FID-2026-0831-002 (office P1–P6b), SCOPE T15-F/T15-H (the blocked items)

---

## Summary

The operator ruling on SCOPE's `[OPEN-OUT-OF-SCOPE]` office-visual item
(2026-09-06) authorized building "the environment + character presentation
layer" based on the 2026-08-31 smoke finding (capsule/sphere characters,
six tool desks, no walls/furniture/articulation). Ground-truth audit this
session proves that finding **stale**: FID-2026-0905-005 (landed 2026-09-05,
`3c737fb1`) already built and wired the full presentation layer — perimeter
walls, window strips, bookshelves, procedural tech-floor/panel textures, a
15-prop layer (server racks, holo columns, break area: coffee machine,
water cooler, fridge, couch, whiteboard), 6 tool + 9 home desks with neon
edge strips, a rigged GLB robot cast (two CC0 designs, Idle/Walking clips,
hologram skin, fallback silhouette), in-scene billboard speech bubbles,
living day/night lighting, and the neon-noir postprocessing pass. Building
"the layer" again would duplicate existing code (Law 7 violation).

This FID therefore converges to what the ruling actually still needs: an
**evidence-backed audit** that each element of the authorized scope exists
and is composed into the rendered scene, plus the **operator visual smoke**
(that element was always the acceptance bar — visual confirmation cannot be
self-reported). If the audit or the smoke surfaces a real gap, the gap
becomes a new scoped FID; this record is the honest bridge between the
ruling's premise and the tree's reality.

## Environment

- **OS:** Windows 11 host (win32, Git Bash)
- **Runtime:** Bun 1.3.14-pinned; React Three Fiber 9 / three 0.185
- **Commit/State:** `main @ 43fd049` + local `78cc114` (SCOPE T17 rulings)
- **Audit evidence:** all citations read 0-EOF 2026-09-06 this session

## Detailed Description

### Problem

SCOPE T17-B (as ruled) says: build walls, room zones, personal desk
furniture, articulated character detail, in-scene speech bubbles — then
re-run the visual smoke that failed 2026-08-31. The premise is outdated:
the 08-31 smoke ran against the pre-decomposition scene. The current tree
composes `OfficeEnvironment` (`scene-environment.tsx:37-186` — walls,
windows, bookshelves, plants, desks, prop layer) and a rigged robot cast
(`scene-robot-body.tsx` + `robot-cast.ts:281 lines` + `stage/deck-robots*`)
inside `OfficeScene` (`office-scene.tsx:130-152`). T15-G speech bubbles
landed 08-31 (`speech-bubble-3d.tsx`, driver-fed via
`deck-view.tsx:69-85 useLiveBubbles`).

### Expected Behavior

- Every element of the ruled scope is either (a) present and composed —
  with `file:line` evidence in this document's audit table — or (b) a
  named, scoped gap with its own follow-up FID.
- The operator smoke (T15-F) runs against the **current** scene and its
  outcome gates T15-H (P4 stage retirement), per the original unblocking
  contract.
- No duplicate presentation code is written.

### Root Cause

Work raced the ledger: the presentation layer was built (09-05) while the
smoke finding (08-31) still defined the scope conversation, and the
OPEN-OUT-OF-SCOPE item was never reconciled with the landing of
FID-2026-0905-005.

### Evidence (audit — all verified 0-EOF this session)

| Ruled element | Status | Evidence |
|---|---|---|
| Walls / room structure | **present** | `scene-environment.tsx:78-93` — 4× `PerimeterWall` (x/z axes); `scene-decor.tsx` (`PerimeterWall`, `WindowStrip`, `NeonLine`, `FloorGrid`, `Bookshelf`, `OfficePlant`) |
| Windows / neon accents | **present** | `scene-environment.tsx:94-115` — 2× `WindowStrip` (cyan + error-red), 2× `NeonLine` baseboards |
| Personal desk furniture | **present** | `scene-environment.tsx:120-134` — 6× `ToolDesk` (busy-keyed neon edge), 9× `HomeDesk`, `CommandConsole`; `scene-desk-furniture.tsx` (79 lines) |
| Prop layer / set dressing | **present** | `scene-environment.tsx:136-186` — `CeilingStrips`, 3× `ServerRack`, 2× `HoloColumn`, 2× `CargoStack`, 2× `ChargingPad`, `CoffeeMachine`, `WaterCooler`, `Fridge`, `Couch`, `Whiteboard` |
| Floor identity | **present** | `scene-environment.tsx:43-59` — procedural tech-floor textures (repeat 12×10) + `FloorGrid`; `SavantLogo` emblem (`scene-identity.tsx`) |
| Articulated character detail | **present** | `scene-robot-body.tsx:1-89` — rigged GLB cast (`robot-cast.ts`: `loadCastTemplate`, `createOfficeRobotFigure`), Idle/Walking clips, hologram skin, fallback silhouette (`stage/deck-robots.ts`), Savant 2-3× height scale |
| Cast variety | **present** | `office-walker-cast.ts` — two CC0 designs rotating across the pad ring; standby-filler dedupe (FID-2026-0901-006) |
| In-scene speech bubbles | **present** | `speech-bubble-3d.tsx` (billboard, in character group); fed by `useLiveBubbles` (`deck-view.tsx:69-85`) from the driver's text snapshot (honesty filter + TTL — FID-2026-0831-002 P4/T15-G) |
| Atmosphere / motion | **present** | `neon-atmosphere.tsx` (Bloom mipmapBlur + Vignette, quality-tiered), `LivingLights` (day/night + sweeping spots), `scene-motion.ts` walk math, spark bursts + processing ring (`scene-agent-fx.tsx`, `scene-overlay.tsx`) |

Composition proof: `office-scene.tsx:143-152` mounts
`<OfficeEnvironment floor={floor} />` and `<OfficeContents …/>` inside the
`Canvas` — the audited elements are in the rendered graph, not dead code.
Reachability (Law 4): `deck-view.tsx:24` imports `OfficeScene` (the single
consumer edge; see FID-2026-0906-005 for the lazy boundary now wrapping
it).

### Impact Assessment

### Affected Components

- None (no code change in the converged scope) — this record + the smoke
  handoff. Any gap the smoke surfaces gets its own FID.
- Tracking: SCOPE T15-F (smoke), T15-H (stage retirement), T17-B (this
  ruling) updated at closure.

### Risk Level

- [ ] Critical
- [ ] High
- [x] Medium: Feature degraded, workaround exists — the risk was
      duplicating a working layer or approving stage retirement against a
      stale visual claim; the audit + smoke sequence retires both.
- [ ] Low

## Proposed Solution

### Approach

Audit (done — table above) → operator smoke on the current build →
branch on outcome.

### Steps

1. [x] **Audit:** every ruled element traced to composed, rendered code
       (table above; all rows `present`, zero dead-code rows —
       composition + reachability cited).
2. [ ] **Smoke handoff:** the operator's v0.0.30 pre-cut smoke is the
       acceptance bar: launch desktop, Deck view, message a model —
       confirm walls/props/robots walk + glow, bubbles render, neon-noir
       look. This is T15-F verbatim, now against a far richer scene.
3. [ ] **Branch:** smoke passes → T15-F closes, T15-H (P4 retirement:
       delete 14 old stage modules + tests, one atomic commit) unblocks;
       T17-B closes as `audit-confirmed, smoke-approved`. Smoke surfaces
       gaps → each gap becomes a scoped FID; T17-B closes pointing at
       them (the ruling is discharged either way — nothing was silently
       dropped).

## Verification

- Audit evidence: the table (static, file:line).
- Acceptance: the operator smoke (visual confirmation is the bar for a
  visual product — self-reporting prohibited; the audit proves the code
  exists, only the smoke proves it *looks right*).

## Verification Gates

- gate: typecheck desktop
- gate: test desktop/src/floor/office/__tests__/office-plan.test.ts

### Verification Receipt

- fingerprint: sha256:fd9939f1ecff04a446c4fdc431bb30621f46f1440387f2e4dafe522ea45b7994
- verified: 2026-09-07T00:19:07.384Z
- typecheck desktop: exit 0
- test desktop/src/floor/office/__tests__/office-plan.test.ts: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) The ruling's premise (08-31 finding) is stale — evidence:
  the audit table; the decomposition commit `3c737fb1` (2026-09-05,
  FID-2026-0905-005) post-dates it. (2) The item was never reconciled
  with that landing. (3) T15-F/T15-H remain blocked on a smoke that has
  never run against the current scene.
- **GREEN:** converge to audit + smoke handoff; explicitly reject
  re-building (Law 7 — `scene-environment.tsx` alone composes ~40
  component instances across 14 domain modules).
- **AUDIT (tool-evidenced):**
  - V1 PASS — all table citations read 0-EOF this session; composition
    line cited (`office-scene.tsx:143-152`).
  - V2 PASS — no dead-code row: every audited module is imported by the
    environment/contents composition (imports cited in
    `scene-environment.tsx:14-32`).
  - V3 FAIL → corrected: the first draft called T17-B "entirely
    superseded — close with no action." Wrong: the ruling's *acceptance
    arm* (re-run the visual smoke) was never discharged and cannot be —
    that arm is live and is exactly T15-F. Scope corrected from
    "no-action" to "audit (done) + smoke (operator-held) + branch."
  - V4 PASS — the 08-31 smoke ran pre-decomposition: the finding text
    itself (SCOPE, filed 08-31) describes "capsule/sphere characters and
    six tool desks," which matches the pre-`3c737fb1` scene, not the
    current one.
- **ADVERSARIAL:** "Build it anyway — the operator ruled." → The operator
  ruled on the *outcome* (a complete office presentation), filed when the
  layer was missing. Law 2 requires presenting scope-changing
  information before acting on an approved item; building duplicate
  walls/robots over working ones is not the ruled outcome, it's a Law 7
  violation wearing an approval. The honest execution is this audit +
  the smoke. "Skip the smoke — the code exists" → No: visual quality was
  the 08-31 failure mode and code-existence proves nothing about look;
  the smoke is the acceptance bar and stays.
- **CHANGE DELTA:** initial authoring (~40% — premise correction is the
  loop's product).

### Missed Questions

1. *Is any ruled element genuinely missing?* → One candidate class:
   "room zones" (named areas — e.g., break area vs. work floor). The
   break area exists as props (`CoffeeMachine`/`Couch`/etc.) but there
   is no zone *labeling* in-scene. Judgment: cosmetic, not load-bearing;
   noted for the smoke — if the operator wants named zones, that's the
   follow-up FID template.
2. *Why not run the smoke myself via the desktop app?* → The desktop app
   requires the operator's display + the gateway sidecar; visual
   confirmation is the operator's acceptance bar by design (T15-F
   wording). Self-reported screenshots would violate the no-self-report
   rule for a visual product.
3. *Does T15-H (stage retirement) unblock on the ruling?* → No — on the
   **smoke passing**, per its own contract ("once the live smoke approves
   the office").
4. *What if the smoke fails on a lazy-chunk regression (FID-005
   interaction)?* → Then the smoke catches both FIDs' live boundary at
   once — the exact point of running it on the v0.0.30 build.

## Code Verification Evidence

- [x] Files referenced in Affected Components exist and were read 0-EOF
      (`office-scene.tsx`, `scene-environment.tsx`, `scene-robot-body.tsx`,
      `deck-view.tsx`, `scene-decor.tsx`/`scene-desks.tsx` via their
      composition)
- [x] Audit citations verified this session (V1-V4)
- [x] No code change proposed (Law 7 — the layer exists; audit + smoke)
- [x] Production call-graph: composition + reachability cited (audit
      table + `deck-view.tsx:24`)
- [x] FID status reflects actual state (`analyzed` — audit complete;
      smoke operator-held)

### Loop 2 — Independent audit and self-correction

- **RED:** the only open risk is smoke-outcome; it is operator-held by
  design, not silent deferral (Step 3's branch is explicit).
- **GREEN:** no further correction.
- **AUDIT:** gate files exist (`desktop` typecheck; floor suite family
  — 189 files under `src/floor`, suites green per T15-E baseline and
  every subsequent battery).
- **ADVERSARIAL:** "The audit could be cherry-picked." → Counter: every
  row cites the composition file that mounts the component; the
  composition itself was read whole (not grepped), and the scene's
  runtime surface is operator-visible in the smoke. Static + visual
  together are the double audit.
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** none in-document; the smoke is the named live boundary.
- **GREEN:** none.
- **AUDIT:** gates declared; receipt stamps at `fixed` flip (post
  v0.0.30-cut gates) — closure rides the operator smoke outcome.
- **ADVERSARIAL:** STANDS.
- **CHANGE DELTA:** <2% (converged — circuit breaker).

## Resolution

- **Converged 2026-09-06** (audit complete — every ruled element present
  and composed, evidence table above; the acceptance arm is the operator
  visual smoke, which cannot be executed by the agent by design). Status
  `converged` per the FID lifecycle: the plan is approved and complete;
  the remaining action is operator-held. This FID closes on the smoke
  outcome at the v0.0.30 pre-cut: pass → T15-F closes, T15-H unblocks,
  T17-B `audit-confirmed, smoke-approved`; gaps → named follow-up FIDs.
  Either branch discharges the ruling; nothing is dropped silently.
  **Blocked-on-event record:** the smoke is `blocked` on the operator's
  v0.0.30 pre-cut session (2026-09-07), not silently deferred.
- **Closed Date:** 2026-09-06 — closed by operator ruling ("completed =
  close + archive + changelog immediately"): this FID's agent-executable
  content — the per-element ground-truth audit — is complete with
  evidence; the visual smoke remains operator-held (SCOPE T17-C) and is
  **not** a closure precondition per that ruling. The T17-B ruling this
  FID discharges is fully recorded either way (present layer → no
  duplicate build; smoke → the acceptance bar, still owed by the
  operator, unchanged).
- **Archived:** 2026-09-06 → `dev/fids/archive/`

## Lessons Learned

(To be filled at closure — expected: scope items must be re-grounded
against the tree at execution time; a ledger ruling inherits the
freshness of the evidence it was made on.)
