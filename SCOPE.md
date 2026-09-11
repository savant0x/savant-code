# SCOPE — Active Task Register

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

## Task 28 — FID-2026-0910-004 Steps 1-3: common layer (2026-09-10)

> Operator directive: "Start implementing FID-2026-0910-004 Steps 1-3
> (common layer)." Approved scope: Steps 1 (custom type + validation),
> 2 (merged registry), 3 (model-validation seam) only — CLI/SDK steps 4-10
> remain pending until separately approved. Step 3 finding recorded below
> when investigated.

## Task 29 — FID-2026-0910-004 Steps 4-6: SDK seam + CLI settings + key store (2026-09-10)

> Operator directive: "Authorize the path-scoped commit for Steps 1-3, then
> continue with Steps 4-6 (CLI wizard layer)." Grounding correction: in the
> converged FID the wizard is **Step 7** (separate approval); Steps 4-6 are
> SDK seam / CLI settings / CLI key store + setup. Approved scope: implement
> Steps 4-6 only.

- [x] **T29-CHECK.** ~~Grounding finding: the common module's research-BYOK
      reserved list (4 vars) drifted from `research-key-store.ts` ground truth
      (6 vars: `CONTEXT7_API_KEY`, `PARALLEL_API_KEY` missing).~~ **Withdrawn
      by operator ruling 2026-09-10:** research keys stay untouched — "they
      all work 100%" and other systems have replaced most of them natively
      and for free; no new CLI settings surface for them either. The drift
      edit was applied and then reverted same-session; committed state
      (`7f95b38f`) is unchanged. The 4-var list stays: it is a *reservation*
      list (what custom providers may not claim), not a completeness mirror
      of the research store.
- [x] **T29-A.** Step 4 (SDK): `SavantCodeClientOptions.customProviders` +
      registration in `client.ts` constructor and standalone `run()` (D4
      lifecycle); `model-provider.ts:17,87,116,165` → effective registry.
      RED-first pins. **Done (implemented 2026-09-10 by the crashed session;
      re-grounded + gates green 2026-09-11)** — see the session summary's
      evidence ledger.
- [x] **T29-B.** Step 5 (CLI settings): `customProviders` in `Settings` +
      `validateSettings` preservation via `parseCustomProviders` (save
      round-trip must never erase user data) + register-before-validate in
      `loadSettings`. RED-first pins. **Done (same provenance as T29-A).**
- [x] **T29-C.** Step 6 (CLI key store + setup): effective setup view (C2),
      custom env-var application, key functions through the effective view,
      research-env-var collision guard. RED-first pins. **Done (same
      provenance as T29-A).**
- [x] **T29-D.** Gates: typecheck ×4, suites, eslint/prettier, Law 4 greps;
      FID/SCOPE/ledger updates; commit plan. **Done 2026-09-11** — typecheck
      ×4 exit 0 (cli/sdk/common/agent-runtime); suites 60/0 (cli, 8 files) +
      51/0 (sdk, 12 files) + 51/0 (common providers); eslint 12 files 0
      problems; prettier clean; full evidence in the session summary +
      `dev/handoff.md`. Commit plan presented — awaiting operator
      authorization (G1).

## Task 28 — FID-2026-0910-004 Steps 1-3: common layer (2026-09-10)

> Operator directive: "Start implementing FID-2026-0910-004 Steps 1-3
> (common layer)." Approved scope: Steps 1 (custom type + validation),
> 2 (merged registry), 3 (model-validation seam) only — CLI/SDK steps 4-10
> remain pending until separately approved. Step 3 finding recorded below
> when investigated.

- [x] **T28-A.** RED: `custom-providers.test.ts` pins (validation rules, merge
      rules, replace/reset lifecycle, prefix list, dead-code removal pin).
      **Done 2026-09-10** — RED captured honestly: module-absent failure, then
      two pin corrections of my own contract ambiguity (parse/register return
      shapes) re-captured as RED before GREEN; behavior pins failing.
- [x] **T28-B.** Step 1: `CustomProviderConfig` + `validateCustomProviders` +
      `inline` catalog variant + `validateProviderRegistry` extension.
      **Done 2026-09-10** — types.ts:111-142, custom-providers.ts parser,
      validate.ts `'inline'` in CATALOG_SOURCES.
- [x] **T28-C.** Step 2: merged registry — register/getEffective/reset with
      D4 lifecycle, conversion to `ProviderConfig`, effective prefix list.
      **Done 2026-09-10** — file-name deviation (recorded): consolidated in
      `custom-providers.ts` rather than a separate `merged.ts` (one module,
      Law 13). Built-ins-win enforced by fail-closed shadow guard (RED
      process caught the silent-overwrite gap). Pin suite asserts effective
      prefixes derive from the merged view.
- [x] **T28-D.** Step 3: resolve the `dynamic-agent-template.ts` seam per the
      investigation fork; pin the outcome. **Done 2026-09-10** — fork
      resolved by evidence: no template-time model validation ever existed,
      `filteredModels` was dead code (computed, guarded, never consumed).
      Implemented as dead-code removal + pin; FID Loop 5 records it.
- [x] **T28-E.** Gates: GREEN run, typecheck ×4, eslint/prettier, existing
      provider suites green, Law 4 greps; FID evidence updated; commit plan.
      **Done 2026-09-10** — 51/0 provider suites; 686/4/0 full common;
      typecheck ×4 exit 0; eslint 0 problems; prettier clean. Law 4: common
      module's production caller is the Step 4 SDK seam (honest — not yet
      reachable from production; grep evidence recorded in FID). Commit plan
      presented, awaiting operator authorization (G1).

## Task 27 — FID-2026-0910-004: user-defined custom providers via /provider (2026-09-10)

> Operator directives: "make the fid, run perfection loop on it then present
> it", with the scope correction "no v1/v2 — we build the full feature the
> first time around." Feature: users add their own LLM providers at will
> through CLI slash commands, as first-class registry entries (prefix
> routing, catalogs, key storage) — not env-var configuration. Approved
> scope: author the FID with the full-feature design, run the Perfection
> Loop to convergence, present. Implementation is a separate approval.

- [x] **T27-A.** RED evidence catalog: registry/derivation/settings/input-mode
      consumers with file:line citations; cross-workspace coverage check;
      prefix-collision surface (ORG_PREFIXES) and model-validation seam.
      **Done 2026-09-10** — 10-cluster consumer map (C1-C10), desktop/
      savant-free zero-consumer check, evals inheritance check, ORG_PREFIXES
      + env-var collision surfaces, InputMode union pinned
      (`input-modes.ts:8-20`).
- [x] **T27-B.** Author `dev/fids/FID-2026-0910-004-custom-providers-slash-command.md`
      — full-feature design (merged registry, SDK registration seam, wizard,
      catalogs, key storage), RED + GREEN documented. **Done 2026-09-10** —
      D1-D10 decisions, Steps 1-10, 8 declared gates, 11 Missed Questions
      answered.
- [x] **T27-C.** Perfection Loop: audit pass with fresh greps on citations +
      missed-surface hunt; corrections applied; Missed Questions answered.
      **Done 2026-09-10** — Loop 2 found 5 findings (dangling step label,
      repo-validation interaction, registration lifecycle, missing citation,
      missing docs step), all corrected in-place; Loops 2-3 recorded with
      honest deltas (~6%, ~3%). Loop 4 (operator amendment): `/provider edit
      <id>` flow folded in per the approved edit-scope decision — prefilled
      wizard, id immutable, fail-closed save, re-activation rule; MQ12 +
      wizard edit-path pins added; delta ~2%; gates re-run clean.
- [x] **T27-D.** Status → `converged`; present FID + commit plan (no git
      execution without operator approval). **Done 2026-09-10** — FID clean
      under lint:md + prettier + markdownlint-cli2 (0 issues); presentation
      below. Commit pending operator authorization per G1.

## Task 26 — FID-2026-0909-008 Step 5: native-incomplete ledger capture (2026-09-10)

> Operator directive: "Pick up FID-2026-0909-008 Step 5 or run the perfection
> loop on it." Step 5 = route native-incomplete stream errors into the
> experience-capture path (Missed Question #1) — the truncation class is
> invisible to the recurrence engine (0 ledger records, ~11 incidents).
> Step 4's uncommitted work landed first as its own commit (G3). No drops,
> no deferrals.

- [x] **T26-A.** Commit Step 4's uncommitted work path-scoped. **Done
      2026-09-10** — commit `5859047f` (15 files).
- [x] **T26-B.** RED pin: a native-incomplete step appends one
      experience record per occurrence (tool_failure, tool name, normalized
      error line). **Done 2026-09-10** —
      `native-incomplete-capture.test.ts`; RED = 0 records pre-fix, GREEN =
      3 (ladder exhausts: 3 steps × 1 error chunk; pin corrected to the
      true contract after root-causing, not fitted).
- [x] **T26-C.** GREEN: capture via the existing hook-engine +
      experience-capture sink (Law 13 — one sink; fail-open by the hook
      contract). **Scope deviation, recorded:** implemented at the
      stream-parser error-chunk site (`stream-parser.ts:186-211`), not the
      loop strike site as originally scoped — the stream layer is the
      earliest point with `chunk.message` + `toolName` + `finishReason`,
      fires once per occurrence (the strike site would double-count on
      escalation), and `fileContext` is already in params. Same sink, same
      record shape.
- [x] **T26-D.** Gates: typecheck (0), new pin suite, strikes + capture
      suites (15/0), full agent-runtime suite (1379/0 — the 43-failure
      root-run was the vendored `resources/freebuff-main/` copy, not this
      repo), eslint 0, prettier clean. **Done 2026-09-10**.
- [x] **T26-E.** FID Step 5 status + Verification Results + loop record;
      commit; present. **Done 2026-09-10** — FID stays `fixed` (closure
      needs the live NEEDS-REVIEW proof); commit below.

## Task 25 — Implement FID-2026-0910-001 skill-notification surfaces (2026-09-10)

> Operator directive: "Implement FID-2026-0910-001's three skill-notification
> surfaces, entering the Perfection Loop at GREEN." The FID is loop-converged
> (RED/GREEN/Loop-2 recorded in-document, gates declared, Loop-2 corrections
> applied); this directive is the Law-2 approval to implement the converged
> Proposed Solution. No drops, no deferrals.

- [x] **T25-A.** RED legs first: extend the four suites (common counter pin,
      skill-manage render suite, skills-command pointer pin, session-end-review
      alert pin) and capture failing output pre-fix. **Done 2026-09-10** —
      all four RED legs captured (missing export / missing module / missing
      pointer line / missing alert line).
- [x] **T25-B.** GREEN: `countQuarantinedDrafts` in common skill-management
      (engine-owned count; facade re-export). **Done 2026-09-10** —
      `helpers.ts` + `skillQuarantineRootDir` in `paths.ts`.
- [x] **T25-C.** GREEN: `SkillManageComponent` + registry registration
      (P1; TerminalCommandDisplay reuse, synthesized label). **Done
      2026-09-10** — `skill-manage.tsx` + `registry.ts:69`.
- [x] **T25-D.** GREEN: `/skills list` quarantine pointer line (P2;
      state-gated, silent at zero). **Done 2026-09-10** — `skills.ts:55-65`.
- [x] **T25-E.** GREEN: SessionEnd quarantine alert line (P3; deterministic,
      zero-LLM, silent at zero). **Done 2026-09-10** —
      `session-end-review.ts` `quarantineAlertNote` + routing append.
- [x] **T25-F.** Docs: surfaces note in `docs/self-improving-harness.md`
      (update only what exists). **Done 2026-09-10** — §3.4 added.
- [x] **T25-G.** Gates: typecheck common + cli, the four suites (+1 new
      counter suite), eslint/prettier on touched files, lint:md; FID
      evidence + status update; ledger touch-up; commit plan presented
      (G1 discrepancy — operator executes or approves git). **Done
      2026-09-10** — all gates exit 0 / 22-0 tests; FID status `fixed`;
      commit plan presented below.
- [x] **T25-H.** FID-2026-0910-003 closure ceremony (operator directive:
      "Complete the FID-2026-0910-003 closure ceremony: archive move +
      CHANGELOG entry"). **Done 2026-09-10** — Ground-Truth re-verified
      (commits `377e0494`/`17b08fd5` on main; pins 38/0; typecheck/
      eslint/prettier clean); file moved to `dev/fids/archive/`; archive
      README index entry added; ledger row removed; CHANGELOG entry
      already existed (no duplicate).

## Task 24 — Perfection Loop on FIDs -0909-001/-002/-003 + master plan (2026-09-09)

> Operator directive: "run perfection loop on all 3 fids then organize them
> into a master plan so i can do all 3 of them in logical order." Interpreted
> scope: (1) run the Perfection Loop (RED→GREEN→AUDIT, codebase-grounded) on
> each of the three 2026-09-09 release-findings FIDs, correcting any drift
> against the live code found during grounding; (2) author a coordination
> master/build-order that sequences all three implementations in dependency
> order. **Planning only — no implementation code this task.** Implementation
> of each FID remains a separate Law-2 presentation. No drops, no deferrals.

- [x] **T24-A.** Read `ECHO-single-agent.md` + `dev/echo-v0.1.2-single-agent.md`
      0-EOF (session boot) and ground the project. **Done 2026-09-09.**
- [x] **T24-B.** Ground-truth all three FIDs against the live code:
      `scripts/verify-clean.ts` + `scripts/public-release/provenance.ts` read
      0-EOF (gate chain = `worktree add` → install → `bun run typecheck`,
      cleanup only in a `finally` that discards its result; no pre-create
      guard); three FID-002 fix commits verified present (`2b22103`,
      `87bcc44`, `05e2e1a`); banned-pattern inventory run (one residual
      documented-contract spawn site found at
      `scripts/public-release-pinned-bun.test.ts:54`; zero SDK-reachable
      `import.meta.dir` production sites in `common/src`). **Done 2026-09-09.**
- [x] **T24-C.** Run the Perfection Loop on each FID (status → `analyzed`)
      with loop-passed RED/GREEN/AUDIT records + ground-truth corrections
      recorded in each document. **Done 2026-09-09** — FID-001's root-cause
      hypothesis corrected by the code read (three-gap mechanism, three-piece
      fix); FID-003's chain located in the shared `assertCleanCheckoutCompiles`
      (parameterized gate-list design; RED pin sequenced after FID-001);
      FID-002's Step-1 inventory run with one reasoned exemption found and
      class 3 ruled non-greppable.
- [x] **T24-D.** Author the coordination master plan (build-order doc) that
      sequences the three implementations with rationale, per-FID scope,
      verification commands, and shared boundaries. **Done 2026-09-09** —
      `dev/build-orders/BO-2026-09-09-gate-chain-hardening.md` (order:
      001 → 003 → 002, with the dependency rationale).
- [x] **T24-E.** Update `dev/fids/README.md` (statuses + master cross-link)
      and run the documentation gates (`lint:md`, `validate:repository`).
      **Done 2026-09-09** — ledger updated to three `analyzed` rows with the
      loop-pass summary; gates: `lint:md` PASS, `validate:repository` PASS,
      prettier clean on all touched files.
- [x] **T24-F. [DONE 2026-09-09 — operator approved]** Presented the three
      looped FIDs + master plan. **Operator ruling: "Approve the full
      001→003→002 program and implement all three sequentially."**
      Implementation scope per FID = the looped Proposed Solution + declared
      Verification Gates + close/archive/CHANGELOG per the T17-C standing
      directive. FID-002's surface choice (minimal gate vs + behavioral
      probe) resolves at its GREEN per the FID's reservation.

### Task 24 implementation tracking (T24-G)

- [x] **T24-G1. FID-2026-0909-001 [DONE 2026-09-09, commit `086565b`]** —
      RED pins → self-healing lifecycle (`scripts/public-release/
clean-checkout.ts` + provenance rewiring) → gates (12/0 + provenance
      11/0 + verify-clean 9/0; live git-ordering probe) → closed +
      archived + CHANGELOG.
- [x] **T24-G2. FID-2026-0909-003 [DONE 2026-09-09, commit `086565b`]** —
      gate-list pins → parameterized chain + `verify:clean` opt-in →
      live drill BOTH legs (planted TS2339 on commit `1fbb1e06` → FAIL
      fail-closed with no checkout debris; clean `086565b6` → PASS
      146.0s) → closed + archived + CHANGELOG.
- [x] **T24-G3. FID-2026-0909-002 [DONE 2026-09-09]** — audit gate RED
      pins → `scripts/audit-gate-env-parity.ts` + `validate:repository`
      wiring as `audit.gate-env-parity` (minimal gate; classes 1–2
      mechanical, class 3 behaviorally pinned; one path-exact exemption:
      the pinned-bun contract probe). The guard's first live run caught
      TWO real class-1 defects (`scripts/bump-version.ts:138/156`,
      bracket-shape `Bun.spawnSync(['bun', ...])` the inventory grep
      missed) — fixed to `process.execPath`, ratchet bumped. Prove-
      the-guard leg both legs (planted `import.meta.dir` in a scratch
      worktree → FAIL with file:line precision; restored → PASS).
      Closed + archived + CHANGELOG.
- [x] **T24-G4. [DONE 2026-09-09]** Program battery: scripts surface
      326/0 across 45 files; typecheck ×4 (sdk/common/agent-runtime/cli)
      exit 0; eslint on all touched files `--max-warnings 0`; lint:md
      PASS; prettier clean; `validate:repository` PASS with the new
      audit gate live.

## Task 15 — Deck rebuild: cyberpunk neon-noir agent office (2026-08-31)

> Operator decision at the crossroads: the holographic command deck
> (desktop/src/floor) "completely misses the mark" vs. the Hermes3D idea
> (resources/Hermes3D-main, MIT, vendored). Direction chosen via ask_user
> 2026-08-31: **Full retro-office rebuild** with a **cyberpunk/neon-noir
> visual identity** (operator constraint). The office is the product: agents
> are characters with presence, not holograms on pedestals. Chat side of the
> desktop app is explicitly liked and OUT of scope. FID-2026-0831-001
> authored, Perfection-Loop converged, operator-approved ("proceed").

- [x] **T15-A.** Author the FID (RED→GREEN→AUDIT→Perfection Loop) and present
      for operator approval BEFORE any code. **Done 2026-08-31** —
      `FID-2026-0831-001-deck-rebuild-neon-noir-office.md`, 3 loops converged,
      gates structurally valid, operator approved.
- [x] **T15-B.** Phase 1 — R3F scaffold: office floor plan, agent characters
      with walk cycles driven by FloorState. **Done 2026-08-31** —
      `office/office-plan.ts` (shared geometry from `stationPosition`/
      `padPosition`), `office/office-motion.ts` (pure walk math,
      reduced-motion teleport), `office/office-scene.tsx` (R3F Canvas,
      characters, desks, per-frame ref-based pose loop).
- [x] **T15-C.** Phase 2 — activity mapping: walk-to-desk on tool work,
      speech bubbles from real chat output, station neon activation on real
      events. **Done 2026-08-31 (reducer level)** — `office/speech-bubbles.ts`
      (flatten/clamp/TTL/FIFO + honesty filter dropping unattributable ids);
      walkers depart pads for tool desks on `pendingTools` via `targetFor`;
      desk emissive keyed to busy state. **[OPEN-OUT-OF-SCOPE → Task 15-G]:**
      in-scene bubble rendering needs a text-event subscription seam in the
      office scene (FloorState carries no text deltas — see T15-G below).
- [x] **T15-D.** Phase 3 — neon-noir atmosphere: `office/neon-atmosphere.tsx`
      (Bloom mipmapBlur + Vignette, quality tier drops postfx first); DPR
      clamp [1,2]; WebGL probe + `webglcontextlost` listener in
      `deck-view.tsx` swaps to analytical fallback. **Done 2026-08-31.**
- [x] **T15-E.** Gates. **Done 2026-08-31** — desktop typecheck exit 0;
      floor suite 126 pass/0 fail (804 expect) UNTOUCHED; office suite
      27 pass/0 fail (office-motion 14, speech-bubbles 13); eslint
      `--max-warnings 0` clean; prettier clean; `fid:verify --write`
      receipt stamped (typecheck desktop PASS, floor-adapter test PASS).
- [ ] **T15-F.** Operator live smoke (visual confirmation is the acceptance
      bar for a visual product). **BLOCKED on operator** — run the desktop
      app, message a model, confirm: agents walk to tool desks during tool
      work, walk home after, desks glow when busy, neon-noir look.
- [x] **T15-G.** Speech bubbles in the scene: **Done 2026-08-31 (FID-2026-0831-002 P4)** —
      driver text snapshot implemented (option (a) preferred design: bounded,
      attributable text snapshot alongside FloorState, one event path, no second
      gateway subscription). `deck-live-driver.ts` folds `text` events into
      `getTextSnapshot()` with honesty filter (unknown agentIds dropped) and TTL
      prune; `deck-view.tsx` `useLiveBubbles()` feeds `OfficeScene bubbles=` prop;
      `office/speech-bubble-3d.tsx` renders billboard in character group;
      `office-scene.tsx` `OfficeContents` maps agentId→bubble. 3 new driver tests
      (fold, honesty-drop, TTL-prune) all pass.
- [ ] **T15-H. [DEFERRED — operator decision pending]** P4 stage retirement:
      delete the 14 old stage modules + their tests in one atomic commit
      once the live smoke approves the office (no dead code, Law 5/15).
      Awaiting T15-F.

## [OPEN-OUT-OF-SCOPE → promoted to work item, 2026-09-06] — desktop bundle size (+R3F deps)

Adding @react-three/fiber + drei + postprocessing grows the renderer bundle
(~+150KB gz estimated in FID Loop 3). **Operator ruling 2026-09-06: authorize
optimization** — lazy-load the 3D stack so the shell's first paint does not
carry it. FID-first per protocol; see Task 16 desktop item below.

> **Operator ruling 2026-09-06:** Authorize optimization. Lazy-load the 3D
> stack in the desktop renderer so the initial shell does not carry the R3F
> bundle; target the FID for it before code.

> **[PROMOTED → work item, 2026-09-06]** Operator ruled: lazy-load the 3D
> stack rather than accept the eager bundle. See the desktop task entry below
> for the contracted plan.

## [OPEN-OUT-OF-SCOPE → authorized, 2026-09-06] — T15-F visual smoke reveals incomplete office presentation

Operator smoke 2026-08-31 reports mostly black output, Savant framed near the
bottom, no office details, no visible robots/models, and no Hermes3D-like
movement. Ground-truth review confirms the current P1–P3 implementation only
renders capsule/sphere characters and six tool desks; it does not yet render
walls, room zones, personal desk furniture, articulated character detail,
or speech bubbles in-scene. **Operator ruling 2026-09-06: authorize build** —
the environment + character presentation layer is approved as a new work
item (FID-first), after which visual smoke is re-run. T15-F/T15-H unblock on
a passing smoke, not on authorization.

## [OPEN-OUT-OF-SCOPE] — T15-F visual smoke reveals incomplete office presentation

Operator smoke 2026-08-31 reports mostly black output, Savant framed near the
bottom, no office details, no visible robots/models, and no Hermes3D-like
movement. Ground-truth review confirms the current P1–P3 implementation only
renders capsule/sphere characters and six tool desks; it does not yet render
walls, room zones, personal desk furniture, articulated character detail,
or speech bubbles in-scene. The next correction requires a blocking scope
presentation before additional code: build the environment and character
presentation layer, then re-run visual smoke. T15-F/T15-H remain blocked.

## Approved work items (pending operator confirmation)

- [x] **A. Review the current Savant-Code UI** (code-based review of cli/src:
      chat layout, savant-ui library, theme system, animation usage). Live
      visual pass is a follow-up item, not part of this review.
- [x] **B. Critically review `docs/design/OpenTUI Terminal UI Capabilities.md`**
      — verify load-bearing claims against the actual OpenTUI release history,
      docs, and npm packages; classify claims as verified / unverified /
      incorrect.
- [x] **C. Produce the UI-overhaul plan** (a design document in
      `docs/design/`, phased, with the corrected OpenTUI facts as its basis).
      No UI code changes in this task.
- [x] **D. Correct the capability report in place** — appendix §14 added
      (verified / incorrect / unverified classifications), MD013 + MD001 lint
      fixes applied; repo-wide `lint:md` now green.
- [x] **E. Route implementation phases to FIDs** — six FIDs created
      (FID-2026-0816-002 master + 003–007 phases) and run through the
      Perfection Loop to document convergence. **Status: `analyzed`, OPEN
      in `dev/fids/`** — closure is deferred until each phase is implemented
      and verified (closure requires implementation evidence; correction
      per operator feedback 2026-08-16).

## Constraints

- strict_mode: true — all 15 laws active.
- No UI code written until the plan is approved (Law 2).
- The OpenTUI 0.2.2 → 0.5.x upgrade is the load-bearing foundation; the plan
  must sequence it first and flag its real breaking changes (verified, not the
  report's unshipped scope-tree claims).

## Task 2 — Native tool-call recovery hardening (2026-08-16)

> New task intake. Interpreted scope below — operator confirmation (via FID
> presentation) converts it into approved scope.

- [x] **T2-A. Create `FID-2026-0816-012`** for native tool-call recovery
      hardening (flash-model truncated-tool-call failures killing subagent
      runs), run the Perfection Loop on the document, and present it for
      approval. Evidence: operator-reported Forge run failure
      (`Native tool-call recovery failed twice consecutively`) on the
      FID-2026-0816-011 implementation task. **Done** — FID presented,
      operator approved (2026-08-16).
- [x] **T2-B. Implement the converged FID** — ONLY after operator approval of
      the presented FID (Law 2). **Done** — steering + 3-strike cap +
      actionable exhausted failure + drift warn; typecheck ×4, agent-runtime
      973/0, SDK 477/0, eslint 0, lint:md 0, prettier clean; FID closed and
      archived with CHANGELOG + index entries.

## Task 3 — Auto Drive (2026-08-18) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-18. Master
> FID-2026-0818-001 + children 002–008 all closed + archived with
> implementation evidence. Live `/auto-drive` smoke (TUI + headless + crash
> resume) and full gate sweep confirmed.

- [x] **AD-A. Review the Auto Drive Architecture Blueprint in full** against
      both reference codebases (`resources/code-main` = Every Code; the
      Savant-Code repo itself). All ~20 load-bearing claims verified; errors
      corrected (paths, non-existent `/auto`, decorative citations).
- [x] **AD-B. Read `ECHO.md` 0-EOF** and absorb the operator correction:
      single-agent ECHO governs Freebuff-harness sessions only; the product
      runs the 10-agent harness. Auto Drive = mechanized STRICT ceremony.
- [x] **AD-C. Converge the design with the operator** — driver-on-goal-engine,
      one-time Approval Contract, self-healing ladder, triple-gate completion.
- [x] **AD-D. Draft the FID backlog** — master `FID-2026-0818-001` + children
      `002`–`008`, all Perfection-Loop-converged, status `analyzed`, Step
      Status inventories present; `dev/fids/README.md` indexed; gates green
      (`validate:repository` PASS, markdownlint PASS).
- [x] **AD-E. Operator approval of the program** — resolution policy
      APPROVED 2026-08-18; scope revised per operator ("build it out
      completely, no v1/v2") — TUI + headless CLI mode (008) + inline plan
      editing (002) in scope; Auto Review ghost-worker + single-agent
      variant operator-confirmed out of scope. **Nova planning sign-off
      PASS 2026-08-18** (verdict in `dev/nova/outbox/2026-08-18-auto-drive-
      and-discord-rich-presence-planning-verdict.md`). Program approval
      confirmed; implementation complete.
- [x] **AD-F. Implement children in dependency order** — 002 → 003 → 004 →
      005 → 006 → 007 → 008, each closed with implementation evidence per
      FID-2026-0817-005; program certification = live `/auto-drive` smoke run
      (TUI + headless + crash resume) + full gate sweep (master step 8).
      **Complete 2026-08-18** — all FIDs closed + archived.

## Task 4 — Discord Rich Presence (2026-08-18) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-18.
> FID-2026-0818-009 closed + archived with implementation evidence. Live
> Discord presence confirmed under the Savant Discord application.

- [x] **DP-A. Read the Discord Presence blueprint 0-EOF** and ground-truth it
      against the repo — corrected the decorative citations (`bun.com`,
      `docs.discord.food`, UNPKG), the wrong preference home
      (`credentials.json` → `settings.json`), and the unverified "Bun Windows
      named-pipe anomaly" (must reproduce before any workaround).
- [x] **DP-B. Converge the design with the operator** — library-first
      (`@xhayper/discord-rpc`) with raw IPC as a documented, evidence-gated
      fallback; master + 3 children structure; Rich Presence only (the
      Embedded App SDK "Activities" surface needs a hosted HTTPS app + live
      egress, conflicting with local-first/zero-cloud — operator-confirmed
      out of scope 2026-08-18).
- [x] **DP-C. Draft the FID** — `FID-2026-0818-009` (single FID per
      single-agent ECHO; the initial master + 3 children structure was
      self-corrected after `validate:repository` reported multiple active
      masters), Perfection-Loop-converged, status `analyzed`, Step Status
      inventory present.
- [x] **DP-D. Operator approval of the program** — **Nova planning
      sign-off PASS 2026-08-18** (verdict in `dev/nova/outbox/2026-08-18-
      auto-drive-and-discord-rich-presence-planning-verdict.md`). External
      prerequisite satisfied: Discord Developer Portal application (Client
      ID `1539431002089328710`) + agent/phase icons uploaded. Program
      approval confirmed; implementation complete.
- [x] **DP-E. Implement the FID's five steps** — IPC transport → state +
      privacy → mapper → commands, closed with implementation evidence per
      FID-2026-0817-005. **Complete 2026-08-18** — FID-2026-0818-009 closed +
      archived; live Discord presence verified by operator.

## Task 5 — Desktop App (2026-08-19) — INTERPRETED SCOPE (pending operator confirmation)

> Research phase complete: explored Hermes Desktop, OpenHands Agent Canvas, and
> AionUI; findings + plan presented 2026-08-19. Operator confirmation converts
> interpreted scope into approved scope. Nothing implemented yet — planning only.

- [ ] **DA-A. Explore the three desktop references** (Hermes Desktop, OpenHands
      Agent Canvas, AionUI) — architecture, packaging, integration patterns,
      lessons. **Done 2026-08-19** — findings presented to operator.
- [ ] **DA-B. Produce the desktop app plan** — shell choice, backend bridge
      architecture (Bun-bound runtime constraint), UI approach, packaging,
      phases. Presented 2026-08-19 for confirmation.
- [x] **DA-C. Draft the self-contained Gemini deep-research prompt** —
      decision-oriented, embeds verified local facts;
      `dev/scratchpad/desktop-app-deep-research-prompt.md`. **Done
      2026-08-19** — ready for the operator to run in Gemini Deep Research
      (attach ECHO.md / ARCHITECTURE.md / README.md / protocol.config.yaml).
- [ ] **DA-D. [Post-approval] Author the architecture FID + design doc, then
      begin Phase 1** (headless session-gateway server mode in the CLI).

## Task 6 — Research tools non-functional in direct-provider mode (2026-08-19) — COMPLETE

> Planned, implemented, verified, closed, and archived 2026-08-19.
> FID-2026-0819-002 closed + archived with implementation evidence. Research is
> decoupled from `DIRECT_PROVIDER` behind a swappable adapter (`research-sources.ts`):
> `web_search` ships a keyless Qwant + DuckDuckGo port (default, zero keys) plus BYOK
> Serper/Parallel/Tavily/Exa/Firecrawl facades; `read_docs` ships keyless search-and-fetch
> plus a self-populating local SQLite FTS5 docset cache (`~/.savant-code/docsets/`,
> 7-day TTL, keyless version detection) plus BYOK Context7; `deep_research` inherits
> via its injected `SearchFn`. BYOK keys entered via `/research-keys`, saved to
> `credentials.json`, applied at boot, masked. Docs updated (`.env.example`,
> `docs/features.md`, `docs/installation.md`, `docs/faq.md`, `docs/index.md`,
> `README.md`, `README.zh-CN.md`).

- [x] **R6-A. Investigate the `read_docs` "backend services are unavailable" failure
      and root-cause it.** **Done 2026-08-19** — backend-only routing + the
      `DIRECT_PROVIDER` conflation; the direct Serper/Context7 facades exist but are
      unwired; `read_url` is the only native/keyless research tool.
- [x] **R6-B. Author `FID-2026-0819-002`** (RED + GREEN + missed questions), indexed in
      `dev/fids/README.md`. **Done 2026-08-19** — status `analyzed`.
- [x] **R6-C. Draft the self-contained Gemini Deep Research prompt** for keyless /
      self-hosted search + docs (no per-user keys). **Done 2026-08-19** —
      `dev/scratchpad/keyless-search-docs-deep-research-prompt.md`, ready for the
      operator to run in Gemini Deep Research.
- [x] **R6-D. Converge the architecture with the operator, then implement** —
      decouple `DIRECT_PROVIDER` from research + ship keyless/self-hosted search/docs.
      **Done 2026-08-19** — swappable adapter, keyless `web_search` + `read_docs`,
      BYOK (Serper/Parallel/Tavily/Exa/Firecrawl + Context7), `/research-keys` UI.
      FID-2026-0819-002 closed + archived with implementation evidence. Gates: typecheck
      ×4, agent-runtime 1103/0, CLI 3242/0, eslint clean, prettier clean.

## Task 7 — Quality-ratchet manual remediation (2026-08-20)

> Operator approved the converged `FID-2026-0819-005` for manual implementation.
> Batch 0 policy enforcement is complete; the remaining 300-line remediation is
> manual, sequential, and fail-closed. No codemod, mass rewrite, or remediation
> script is permitted.
>
> **2026-08-21 — program paused by operator decision:** the largest chunk of
> the decomposition is done without issue; the remaining inventory (standing
> item QR-Q, production inventory QR-IJ, and the Batch 4 test files) is
> explicitly deferred — call it good for now, leave the rest alone, and
> re-address only if the stance changes. No further large refactor sessions
> are planned for awhile. FID-2026-0819-005 remains open (`analyzed`) — not
> closed, not exempted; the quality report intentionally stays red (168) and
> `validate:repository` red (200, incl. ~32 pre-existing desktop-FID metadata
> findings) until the program resumes.

- [x] **QR-A.** Reconcile the FID with the live `quality-report.ts`, current
      baseline state, the operator-confirmed 300-line target, and prior
      `FID-2026-0805-003` deconstruction program. The operator also confirmed
      that all `approvedGrowth` entries were unauthorized.
- [x] **QR-B.** Rewrite the FID for single-agent ECHO: no agent attribution,
      no harness-only Verifier/Forge/Adversarial roles, explicit blocked steps,
      and separate ratchet versus absolute-ceiling verification.
- [x] **QR-C.** Run RED → GREEN → AUDIT on the FID and present the corrected
      planning document. The 300-line/no-exemption policy now covers every
      project-owned TypeScript/TSX file, including tests and core features.
      All remediation edits must be manual and individually audited.
- [x] **QR-D.** Operator approved implementation. Batch 0 was completed manually:
      `approvedGrowth` is absent from the baseline and rejected by the validator,
      policy sources align to 300 lines, owned TypeScript/TSX roots are scanned, and
      focused regression tests pass 4/4. `bun run quality:report` correctly fails
      closed with 309 outstanding absolute/ratchet issues. No codemod or remediation
      script was used.
- [x] **QR-E.** Complete the first manual decomposition seam: read and map
      `agents/scout/scout.ts`, move its self-contained `handleStepsMax` handler to
      `agents/scout/handle-steps-max.ts`, and verify the affected package. The source
      file decreased from 308 to 203 lines; the new module is 108 lines. Agents
      typecheck, 87 tests / 248 assertions, ESLint, and Prettier pass. The quality
      inventory decreased from 309 to 308 with no rebaseline or exemption.
- [x] **QR-F.** Complete the second manual decomposition seam: read and map
      `agents/savant/handle-steps.ts`, move its serialization factory and baked
      variants to `agents/savant/handle-steps-factory.ts`, and verify the affected
      package. The source file decreased from 323 to 58 lines; the new module is 275
      lines. Agents typecheck, 87 tests / 248 assertions, ESLint, and Prettier pass.
      The quality inventory decreased from 308 to 307 with no rebaseline or exemption.
- [x] **QR-G.** Complete the third manual decomposition seam: read and map
      `agents/context-pruner/structured-summary.ts`, move `buildPendingAsks` to
      `agents/context-pruner/pending-asks.ts`, and preserve the re-export used by
      serialized embedding. The source file decreased from 331 to 279 lines; the new
      module is 51 lines. Agents typecheck, 87 tests / 248 assertions, ESLint, and
      Prettier pass. The quality inventory decreased from 307 to 306 with no rebaseline
      or exemption.
- [x] **QR-H.** Complete the `.agents` type-definition target manually: extract the
      model union, runtime support types, tool-category unions, and provider options
      from `.agents/types/agent-definition.ts`, preserving its public re-exports.
      The parent decreased from 487 to 257 lines. Four new modules total 214 lines.
      Strict Bundler typecheck, ESLint, and Prettier pass. The quality inventory
      decreased from 306 to 305 with no rebaseline or exemption.
- [x] **QR-I.** Complete `.agents/types/tools.ts` manually: extract the discovery and
      file-operation parameter contracts to `.agents/types/tool-params-discovery.ts`,
      preserve `ToolParamsMap`, `GetToolParams`, and public re-exports. The parent
      decreased from 453 to 200 lines; the new module is 135 lines. Strict Bundler
      typecheck, ESLint, and Prettier pass. The quality inventory decreased from 305
      to 304 with no rebaseline or exemption.
- [x] **QR-J.** Complete the context-pruner Phase 1 test decomposition manually:
      split the 460-line preserved-state/summary suite into shared fixtures plus
      preserved-state and summary test modules, then remove the obsolete duplicate.
      Replacement files are 36, 173, and 239 lines; the focused suite passes 26/26,
      the full agents suite passes 87/87, and the quality inventory decreased from
      304 to 303 with no rebaseline or exemption.
- [x] **QR-K.** Complete the context-pruner Phase 3 test decomposition manually:
      extract shared serialized-runner fixtures and split fold/force, factory wiring,
      lifecycle, and single-trigger suites into 90-, 152-, 155-, 98-, and 135-line
      modules. The focused suite passes 17/17, the full agents suite passes 87/87,
      and the quality inventory decreased from 303 to 302 with no rebaseline or
      exemption.
- [x] **QR-L.** Complete the context-pruner main orchestrator manually: extract the
      P3a fold phase and ordinary summary assembly into serializable modules, preserve
      factory `.toString()`/`eval` embedding, and bring `main.ts` to 299 physical lines
      (300 quality-count lines). Full agents typecheck and 87/87 tests pass; ESLint,
      Prettier, and serialized coverage pass; the quality inventory decreased from
      302 to 301 with no rebaseline or exemption.
- [x] **QR-M.** Complete the `agents/types/tools.ts` public type contract manually:
      split tool names, parameter map, core controls, discovery/filesystem, database,
      and research domains into six modules while preserving the original re-export
      surface. The facade is 54 lines, all extracted modules are under 100 lines,
      agents typecheck and 87/87 tests pass, and the quality inventory decreased from
      301 to 300 with no rebaseline or exemption.
- [x] **QR-N.** Complete the `cli/scripts/build-binary.ts` decomposition manually:
      split env policy, runtime commands, target mapping, asset discovery, OpenTUI
      fetching, and release orchestration while preserving the original facade and
      guarded entrypoint. CLI typecheck and the 17/17 focused tests pass; all modules
      are below 300 lines; the quality inventory decreased from 300 to 299 with no
      rebaseline or exemption.
- [x] **QR-O.** Complete the `cli/src/__tests__/bash-mode.test.ts` decomposition
      manually: preserve its 27 entry/exit, storage/submission/UI, and edge/router
      tests across three focused modules. CLI typecheck and the full CLI suite pass
      (3242 pass / 18 skipped / 0 fail); the quality inventory decreased from 299 to
      298 with no rebaseline or exemption.
- [x] **QR-P.** Complete the credentials-storage integration-test decomposition
      manually: preserve all 20 filesystem/format, permission/capacity, and
      concurrent-operation tests across shared fixtures plus three focused suites.
      The original 453-line file was removed only after focused tests passed 20/20,
      CLI typecheck, ESLint, and Prettier passed; the full CLI suite passed 3242/18/0,
      and the quality inventory decreased from 298 to 297 with no rebaseline or
      exemption.
- [x] **QR-R.** Reconcile the existing local-agent integration-test split:
      read all nine replacement suites and the shared fixture, verify 36 tests /
      99 assertions and CLI typecheck, and record the quality inventory decrease
      from 297 to 296. No exemption or rebaseline was used.
- [x] **QR-S.** Complete the release HTTP proxy-test decomposition manually:
      extract shared fixtures and split the 11 plain HTTP, HTTPS proxy/redirect,
      retry, and resumable-download tests into five files at or below 300 lines.
      Focused tests pass 11/11 with 34 assertions; CLI typecheck, targeted ESLint,
      and Prettier pass; the quality inventory decreases from 296 to 295 with no
      exemption or rebaseline.
- [x] **QR-T.** Complete the release wrapper-safety decomposition manually:
      extract shared wrapper fixtures and split wrapper/package checks from the
      launcher catalog, packaging, consent, and process-cleanup suite. The three
      replacement files are below 300 lines; the focused command passes 32 tests /
      115 assertions, CLI typecheck, targeted ESLint, and Prettier pass; the quality
      inventory decreases from 295 to 294 with no exemption or rebaseline.
- [x] **QR-U.** Complete the generated-agent output decomposition manually:
      review the generator, declaration fallback, and production consumers; change
      the generator to emit a small public index plus one generated data module per
      bundled agent. Prebuild passes, all 40 generated data modules remain below 300
      lines (largest 168), the index is 114 lines, CLI typecheck and 11 roster/model
      regression tests pass, and the quality inventory decreases from 294 to 293
      with no exemption or rebaseline.
- [x] **QR-V.** Complete the `cli/src/app.tsx` decomposition manually: move the
      cohesive authenticated routing surface into a focused component while preserving
      the public `App` entrypoint, auth/project/banner orchestration, session gates,
      chat-history routing, and Chat props. The source decreases from 340 to 241 lines;
      the replacement is 108 lines; the package-scoped CLI suite passes 3242/18/0 with
      9001 assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      293 to 292 with no exemption or rebaseline.
- [x] **QR-W.** Complete the `cli/src/chat/keyboard.ts` decomposition manually:
      move the pure keyboard-state contract/projection into a focused module while
      preserving the existing keyboard-module re-export and handler behavior. The
      source decreases from 330 to 272 lines; the replacement is 61 lines; the focused
      keyboard/bash suite passes 157/0 with 175 assertions, typecheck/ESLint/Prettier
      pass, and the inventory decreases from 292 to 291 with no exemption or rebaseline.
- [x] **QR-X.** Complete the `cli/src/chat/panels.tsx` decomposition manually:
      move the cohesive bottom interaction surface into a focused component while
      preserving the `ChatLayout` export, message/header layout, sidebar, picker
      overlays, and all bottom-branch callbacks. The source decreases from 390 to 208
      lines; the replacement is 253 lines; the chat-focused suite passes 7/0 with
      14 assertions and the full package-scoped CLI suite passes 3242/18/0 with
      9001 assertions; typecheck/ESLint/Prettier pass, and the inventory decreases
      from 291 to 290 with no exemption or rebaseline.
- [x] **QR-Y.** Complete the `cli/src/chat/use-chat-controller.ts` decomposition
      manually: extract the stable `ChatControllerCore` type contract into a focused
      module while preserving the controller re-export and `useChatLayout` consumer.
      The source decreases from 313 to 241 lines; the replacement is 76 lines; the
      full package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 290 to 289
      with no exemption or rebaseline.
- [x] **QR-Z.** Complete the `cli/src/chat/use-chat-interactions.ts` decomposition
      manually: extract its argument contract, local state/history seam, input
      assembly, and suggestion-engine boundary while preserving the public type
      re-export and controller wiring. The source decreases from 375 to 294 lines;
      four replacement modules are 67, 46, 29, and 8 lines; the full package-scoped
      CLI suite passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier
      pass, and the inventory decreases from 289 to 288 with no exemption or
      rebaseline.
- [x] **QR-AA.** Complete the `cli/src/chat/use-chat-keyboard.ts` decomposition
      manually: extract the stable assembly argument contract while preserving its
      type re-export, memo dependency arrays, keyboard dispatcher mount, and disabled
      state behavior. The source decreases from 319 to 240 lines; the replacement is
      81 lines; the full package-scoped CLI suite passes 3242/18/0 with 9001
      assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      288 to 287 with no exemption or rebaseline.
- [x] **QR-AB.** Complete the `cli/src/chat/use-chat-layout.ts` decomposition
      manually: extract the pure controller-to-`ChatLayoutProps` projection while
      preserving hook invocation order, derived values, message-block synchronization,
      and the `chat.tsx` → `ChatLayout` call graph. The source decreases from 340 to
      137 lines; the replacement is 249 lines; the full package-scoped CLI suite
      passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass, and the
      inventory decreases from 287 to 286 with no exemption or rebaseline.
- [x] **QR-AC.** Complete the `cli/src/chat/use-chat-messaging.ts` decomposition
      manually: extract the public argument contract and pending ghost-bash flush
      lifecycle while preserving the messaging hook's prompt routing, queue state,
      attachment restoration, onboarding retirement, and `useChatInteractions` call
      graph. The source decreases from 362 to 292 lines; the replacement modules are
      44 and 59 lines; the full package-scoped CLI suite passes 3242/18/0 with 9001
      assertions, typecheck/ESLint/Prettier pass, and the inventory decreases from
      286 to 285 with no exemption or rebaseline.
- [x] **QR-AD.** Complete the `cli/src/chat/use-chat-overlays.ts` decomposition
      manually: extract its public contracts and follow-up custom-event listener
      while preserving feedback, publish, review, command-result routing, prompt
      submission, analytics, and listener cleanup. The source decreases from 373 to
      279 lines; the replacement modules are 48 and 70 lines; the full
      package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 285 to 284
      with no exemption or rebaseline.
- [x] **QR-AE.** Complete the `cli/src/chat/use-chat-suggestions.ts` decomposition
      manually: extract the public argument/return contracts and the slash/mention
      menu-index reconciliation effects while preserving the suggestion engine wiring,
      slash tracking, mention select/replace, and slash execute/insert helpers, plus
      the `useChatInteractions` call graph. The source decreases from 341 to 270 lines;
      the replacement modules are 53 and 68 lines; the full package-scoped CLI suite
      passes 3242/18/0 with 9001 assertions, typecheck/ESLint/Prettier pass, and the
      inventory decreases from 284 to 283 with no exemption or rebaseline.
- [x] **QR-AF.** Rebaseline the eight ratchet-only baseline entries (auto-drive,
      defs/misc, drive-report, drive-status-panel, presence index/mapper/privacy,
      run-agent-step constants) to their measured counts — all already at or below
      300 lines. No source change, no exemption; the inventory decreases from 283
      to 275 with no remaining ratchet violations.
- [x] **QR-AG.** Complete the `cli/src/hooks/use-message-queue.ts` decomposition
      manually: extract the public `StreamStatus`/`QueuedMessage` type contracts
      while preserving the hook's queue/watchdog/stream orchestration and the
      re-export surface. The source decreases from 302 to 299 lines; the new module
      is 9 lines; focused tests, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 275 to 274 with no exemption or rebaseline.
- [x] **QR-AH.** Complete the `cli/src/hooks/suggestion-engine/filters.ts`
      decomposition manually: extract the self-contained `filterFileMatches` into a
      focused module while preserving the slash/agent filters and the re-export. The
      source decreases from 307 to 171 lines; the new module is 144 lines; the
      focused filter suite passes, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 274 to 273 with no exemption or rebaseline.
- [x] **QR-AI.** Complete the `cli/src/utils/clipboard.ts` decomposition manually:
      extract the renderer contract and registry while preserving OSC 52 copying,
      message state, and the re-export surface. The source decreases from 308 to 284
      lines; the new module is 34 lines; the focused clipboard suite passes,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 273 to 272
      with no exemption or rebaseline.
- [x] **QR-AJ.** Complete the `cli/src/components/message-with-agents.tsx`
      decomposition manually: hoist the duplicated `MessageBlock` element into a
      single shared variable (DRY) while preserving the memoized component, prefix
      branches, and children grid. The source decreases from 309 to 281 lines; the
      full package-scoped CLI suite passes 3242/18/0 with 9001 assertions,
      typecheck/ESLint/Prettier pass, and the inventory decreases from 272 to 271
      with no exemption or rebaseline.
- [x] **QR-AK.** Complete the `cli/src/hooks/activity-query/cache.ts` decomposition
      manually: extract the retry/generation state into a focused module while
      preserving the cache entry/snapshot/GC orchestration and every public re-export.
      The source decreases from 310 to 295 lines; the new module is 35 lines; the
      focused activity-query/usage suites pass 110/0, the full package-scoped CLI
      suite passes 3242/18/0, typecheck/ESLint/Prettier pass, and the inventory
      decreases from 271 to 270 with no exemption or rebaseline.
- [x] **QR-AL.** Complete the `run-agent-step-tools-part-b.test.ts` decomposition
      manually: extract the mock file-context fixture while preserving both
      set_output and handleSteps integration tests. The source decreases from 301
      to 274 lines; the new fixture is 28 lines; the focused suite passes 2/0,
      agent-runtime typecheck/ESLint/Prettier pass, and the inventory decreases
      from 270 to 269 with no exemption or rebaseline.
- [x] **QR-AM.** Complete the `sdk/src/credentials.ts` decomposition manually:
      extract the ChatGPT OAuth schema and credential contract while preserving
      every public re-export and the config-dir/file-path/refresh orchestration.
      The source decreases from 304 to 291 lines; the new module is 18 lines; the
      focused credentials suite passes 15/1/0, SDK typecheck/ESLint/Prettier pass,
      and the inventory decreases from 269 to 268 with no exemption or rebaseline.
- [x] **QR-AN.** Complete the `common/src/browser-actions/schemas.ts` decomposition
      manually: extract the browser-action defaults while preserving the response,
      config, and action schemas plus the re-export. The source decreases from 306
      to 270 lines; the new module is 37 lines; common typecheck/ESLint/Prettier
      pass, and the inventory decreases from 268 to 267 with no exemption or
      rebaseline.
- [x] **QR-AO.** Complete the `packages/agent-runtime/src/llm-api/docset-search.ts`
      decomposition manually: extract the SQL schema and FTS5 match-expression
      builder while preserving build/query/read/meta orchestration and the
      re-export. The source decreases from 306 to 268 lines; the new module is 40
      lines; the focused docset suites pass 14/0, agent-runtime typecheck/ESLint/
      Prettier pass, and the inventory decreases from 267 to 266 with no exemption
      or rebaseline.
- [x] **QR-AP.** Complete the `common/src/mcp/client.ts` decomposition manually:
      extract the timeout and env-substitution utilities while preserving the
      connect/list/call orchestration and error paths. The source decreases from
      309 to 250 lines; the new module is 58 lines; common typecheck/ESLint/Prettier
      pass, and the inventory decreases from 266 to 265 with no exemption or
      rebaseline.
- [x] **QR-AQ.** Complete the `scripts/audit-evidence.ts` and `scripts/fid-ledger.ts`
      decompositions manually: extract the audit type contracts and the shared
      `FidLedgerIssue` contract plus the anti-deferral step-status scan while
      preserving the public re-exports and `validate-repository` call graph. The
      parents decrease from 307 to 277 and 308 to 270 lines; the new modules are
      44, 4, and 43 lines; the audit/ledger suites pass 12/0, ESLint/Prettier pass,
      and the inventory decreases from 265 to 2

## Task 8 — Add KiosAPI provider (2026-09-05) — COMPLETE (closed + archived 2026-09-05)

> Operator wants `https://kiosapi.com/` added as a provider. Research complete
> (agent-reach web via Jina Reader + web search, 2026-09-05): KiosAPI is a
> fully OpenAI-compatible unified gateway (GPT, Claude, Gemini through one
> endpoint + key). No repo references exist yet. Nothing implemented —
> presentation only until the operator confirms the open questions below.

- [x] **K8-A. Confirm service identity: kiosapi.com (not kiosapi.id).**
      CONFIRMED by operator 2026-09-05 ("go").
      Research found TWO different services: `kiosapi.com` (global gateway,
      keys `sk-kilo-…`/`sk-…`, base `https://kiosapi.com/v1/`, docs
      `kiosapi.mintlify.app`, GitHub `kiosapi/docs`) vs `kiosapi.id`
      (Indonesian gateway by PT Mura Teras Kreatif, keys `kios_live_…`, base
      `https://api.kiosapi.id/v1`). Interpreted target is **kiosapi.com** per
      the operator's URL. BLOCKED on operator confirmation.
- [ ] **K8-B. [Post-approval] Add Path-A registry entry** in
      `common/src/providers/registry.ts` (`kiosapi`: gateway, `KIOSAPI_API_KEY`,
      `https://kiosapi.com/v1`, protocol `openai`, idTransform `strip`,
      live catalog `https://kiosapi.com/v1/models`, setupAvailable true,
      domain `kiosapi.com`, order 4). No new shim — generic factory
      (`sdk/src/impl/model-provider/model-factories.ts:58-106`) handles it.
      Derived surfaces (prefixes, domains, validProviders, picker) update
      automatically. **Done 2026-09-05** — entry live at
      `common/src/providers/registry.ts:186-205`; FID-2026-0905-002 Steps
      1-5 `implemented`.
- [x] **K8-C. [Post-approval] Verify**: 2026-09-05 — cli typecheck
      exit 0; sdk typecheck exit 0; common provider suites 21/0 (24/0 at
      closure re-run); catalog family 28/0; gateway 12/0 (16/0 at closure
      re-run, 4 new KiosAPI tests); eslint 7 files exit 0; prettier clean;
      lint:md exit 0; reachability grep proves wiring; `fid:verify` 5 PASS /
      1 FAIL (`typecheck common` — pre-existing, see OOS below). **Live
      verification DONE** — operator confirmed ("kiosapi works")
      2026-09-05: authed `/v1/models` + chat round-trip.
- [ ] **K8-D. Operator answers received 2026-09-05**: kiosapi.com confirmed
      (FID scope); env var **`KIOSAPI_API_KEY`** confirmed; key lives in
      **`.env.local`** AND submittable via **`/provider kiosapi`** CLI
      (both work with zero extra code — FID §Evidence). Remaining defaults
      taken: `/provider` picker visible, live catalog, `strip` transform.
      Only open item: the actual command is **`/model`** (not `/models`) —
      confirm that is what the operator means.
- [x] **K8-E. FID-2026-0905-002 converged, operator said "go", implemented
      2026-09-05.** Live verification received same day ("kiosapi works");
      FID **closed + archived 2026-09-05**.
- [x] **K8-F. HARD REQUIREMENT (operator 2026-09-05): GLM-5.3-free must be
      included.** Parser + 4 tests encode it (shared gateway suite); live
      confirmation received 2026-09-05 ("kiosapi works") — the pass-through
      parser guarantees client-side carriage; escalate-if-absent rule
      stands.

## Task 10 — Zen runtime rejection: recursive JSON schemas (2026-09-05) — CLOSED + ARCHIVED

> Operator live-confirmed the fix ("it works") 2026-09-05:
> FID-2026-0905-004 status `closed`, moved to `dev/fids/archive/`,
> CHANGELOG entry appended, archival logged in the session summary.

> Operator said "go": **implemented 2026-09-05, FID-2026-0905-004 status
> `fixed` (Loop 2 audited); NOT `closed`.** Shared sanitizer
> (`schema-sanitize.ts`) + factory middleware on all 3 SDK branches;
> chat path byte-identical (suite green). Static gates: sdk/llm/cli
> typecheck 0; llm 87/0; zen 10/0; eslint/prettier/lint:md clean;
> `fid:verify` 3/1 (pre-existing). **BLOCKED on operator key**: live
> Spark-with-tools turn to confirm the upstream rejection is gone.
> Scratch repro suite removed after evidence capture (findings in FID).

> Operator testing a Zen model gets `Upstream request failed:
> [invalid_request_error] Recursive JSON schemas are not currently
> supported`. Code homework done (no fix yet): chat-path
> `inlineLocalSchemaRefs`
> (`packages/llm-providers/.../openai-compatible-prepare-tools.ts:34-75`)
> provably cuts `$ref` cycles to `{}` and strips `$defs` — a recursive
> payload CANNOT survive it, so a chat-protocol model should be immune;
> responses/Anthropic paths send SDK-serialized schemas raw (no inlining).
> No `z.lazy` in tool inputs; no `strict:true` injection found;
> `jsonValueSchema` uses are validation-only. BLOCKED on operator facts
> (model id, blast radius, cross-provider comparison) — see questions.

## [OPEN-OUT-OF-SCOPE → RESOLVED via FID-2026-0906-007, 2026-09-06] — desktop sidecar E2E env starvation

> **Discovered 2026-09-06 (T17-A verification leg); RESOLVED same session**
> by FID-2026-0906-007 (closed + archived): `env.ts` gained the `.env.local`
> bootstrap leg (two-pass findUp incl. a cwd fallback for compiled
> artifacts), and desktop joined the root `test` chain (12 workspaces).
> Live acceptance bare: smoke exit 0, sidecar E2E 4/0 in 5.9s, desktop
> suite 420/0 in 6.9s. The operator decision this item requested is
> discharged by the implemented fix — no separate ruling needed.

## [OPEN-OUT-OF-SCOPE] — common typecheck red in untouched test file

`bun run typecheck` in `common/` fails with 30 errors, ALL in
`common/src/__tests__/model-config.test.ts` (TS2593/TS2304 — missing
`bun:test` globals `describe`/`test`/`expect`). Zero errors in any file
touched by the KiosAPI work (verified by filtered re-run). The file was
already modified in the working tree before this session and the error
class cannot be caused by a registry entry. NOT silently fixed (Law 2 —
needs a blocking presentation): operator decides whether to authorize a
fix (likely a tsconfig `types` gap) or leave it. Consequence: `fid:verify`
for FID-2026-0905-002 reports 5 PASS / 1 FAIL and no receipt is stamped.

> **[RESOLVED — closed 2026-09-06]** Operator ruling: close as resolved.
> Live ground truth: `bun run typecheck` in `common/` exits 0 (verified
> 2026-09-06; the 30 errors no longer exist). The blocked receipt is now
> stamped — `bun run fid:verify dev/fids/archive/FID-2026-0905-002-… --write`
> → **6/6 PASS**, fingerprint `sha256:7be7d8ed…`, verified
> 2026-09-06T22:27Z; pending Commit-SHA evidence filled (`cb6288aa`, via
> `git log -S kiosapi`). Item closed with no code change required.

## Task 9 — Add OpenCode Zen provider (2026-09-05) — COMPLETE (closed + archived 2026-09-05)

> Operator wants OpenCode Zen (`https://opencode.ai/zen/v1`) as a provider:
> multi-model incl. free ones; "look into this deeper". Deep research done
> (official `opencode.ai/docs/zen` 0-EOF + live `GET /zen/v1/models` probe:
> HTTP 200, 70 models, public, no auth). This is NOT the existing
> `opencode-go` entry (different base `/zen/go/v1`, subscription-only,
> open-source-only, `OPENCODE_GO_API_KEY`). Nothing implemented — presentation
> only until the operator picks an option below.

- [ ] **Z9-A. Findings.** Zen = pay-per-use gateway, key `OPENCODE_API_KEY`
      (same key works for Go per Docker docs, but separate env var per repo
      convention). 70 live models, bare ids, `owned_by: opencode`. FOUR wire
      formats: chat/completions (~19: DeepSeek, MiniMax, GLM 5/5.1/5.2/5.3/
      5.3-flash, Kimi, Big Pickle free, MiMo/Ling/Nemotron free,
      deepseek-v4-flash-free), Anthropic messages (15: Claude ×11, Qwen ×4),
      Responses API (~29: all GPT/Grok/Muse Spark incl.
      muse-spark-*-contributor-free), Gemini custom path (7). Factory
      supports the first two via protocolMap (opencode-go precedent); the
      latter two have NO factory support (only precedent: ChatGPT-OAuth
      Responses transform, `model-factories.ts:29-52`).
- [ ] **Z9-B. Option A (recommended): Go-mirror Phase 1.** New `opencode`
      entry (label OpenCode Zen, `OPENCODE_API_KEY`, base
      `https://opencode.ai/zen/v1`, protocol `openai-anthropic`, `strip`,
      static catalog of the ~34 factory-supported models, new
      `OPENCODE_ZEN_PROTOCOLS` map + `ProviderProtocolMap` union extension,
      live or static picker catalog). Responses/Gemini models explicitly out
      (documented, fail-closed if requested). Effort ≈ KiosAPI × 3.
- [ ] **Z9-C. Option B: live catalog + map.** Same as A but picker reads
      live `/v1/models` (public, always fresh incl. deprecations) while
      dispatch stays map-gated; unsupported models visible but fail closed
      with a clear error. Risk: picker/requested-model disagreement.
- [ ] **Z9-D. Option C: full Zen (deferred).** Add Responses-API factory
      support for GPT/Grok/Spark + decide Gemini path. Large scope, needs
      its own FID. NOT recommended now.
- [x] **Z9-E. Scope settled 2026-09-05: FULL (option C), no phases.**
      Routing id **`opencode-zen`**, picker visible, GLM rides along.
      Operator said "code": **implemented 2026-09-05; live verification
      discharged by operator confirmation ("zen works") same day;
      FID-2026-0905-003 closed + archived 2026-09-05.** Static gates:
      cli/sdk typecheck 0; common suites 28/0 (24/0 closure re-run);
      gateway 16/0; catalog family + setup combos 59/0; sdk free-mode 13/0
      (all 4 protocols); eslint/prettier/lint:md clean; `fid:verify` 5/1
      (pre-existing). **ATTENTION at commit**:
      `model-config/providers.ts` + `model-config.ts` carry
      `assume-unchanged` bits (edits on disk, invisible to git), and
      several test files present on disk are untracked — see summary.
- [x] **Z9-F. GLM clarification (operator: "glm was completed already?").**
      Resolved 2026-09-05: (i) KiosAPI GLM (K8-F) live-confirmed by the
      operator ("kiosapi works"); (ii) Zen's own glm-5.3 + glm-5.3-flash
      ride the supported chat/completions protocol and were included in the
      shipped scope. Both tracks done.

## Task 12 — Residue-backlog monolith decompositions (2026-09-05)

> Continues the accepted-residue backlog recorded in closed
> `FID-2026-0819-005` (5 source monoliths). Operator approved running the
> Perfection Loop + implementation on `-0905-001` (native.ts) and then
> opening the next monolith FID.

- [x] **R1. FID-2026-0905-001 (native.ts) — Perfection Loop + implementation
      approved and executed 2026-09-05.** RED-first: 12 characterization
      pins green on the 894-line monolith before any extraction. Extracted
      10 stage modules (`gate-context`, `gate-chain`, `pre-dispatch-gates`,
      `ehel-gate`, `hook-gate`, `result-lifecycle`, `client-tool-bridge`,
      `trace`, `steering`, `write-bookkeeping`); facade `native.ts` 894 →
      249 lines. Suite parity 1335/0 (3399 expects) pre/post; barrel
      byte-identical; typecheck/eslint/prettier/lint:md clean; receipt
      stamped 4/4 PASS; baseline 852 → 249. **Step 5 `blocked` (operator):**
      G2 commit hash for closure + archive.
- [x] **R2. Next monolith FID opened + implemented: `FID-2026-0905-004`
      (gateway.ts).** Target chosen over `public-release.ts` (sequencing:
      -0903-001 lands in that file at the next release cut). Measured
      1,327 lines; single production caller (`server-command.ts:17`).
      Perfection Loop ran to convergence (Loop 2: state contract + transport
      stays in facade + fidStatuses encapsulated; Loop 3: <2% delta) and the
      operator approved implementation 2026-09-05. RED: 5 injectTriggerRun
      pins green on the monolith (plus RED finding 5 — a real `request()`
      race in `gateway-test-harness.ts` that made `gateway.test.ts` flaky
      under the repo-root gate runner; fixed by returning the id-matched
      frame). Extracted 8 `gateway/` stage modules; facade 1,327 → 236
      lines; suite parity 35/0 / 163 expects both cwds; receipt 6/6 PASS;
      quality-report unlisted. **Step 6 `blocked` (operator):** G2 commit
      hash for closure + archive.
- [x] **R2.5. Next monolith FID opened: `FID-2026-0905-005`
      (office-scene.tsx).** Measured 2,126 lines; single production caller
      (`deck-view.tsx:24/:164`); RED gap: the scene's pure logic (labelFor,
      makeThinkingPredicate) is module-private, zero direct coverage — RED
      step 1 = minimal verbatim logic extraction + pins before any component
      move. T15-H boundary respected (old stage modules untouched). Gates
      validated live at authoring (desktop typecheck 0, sibling suites
      green). **Implemented 2026-09-05 (operator approved the full loop):**
      RED 13/0 pins; Loop 2 settled bus single-ownership, targetFor
      cohesion, environment promotion; 14 `scene-*` modules + 179-line
      facade (2,126 → 179; four stage modules ceiling-split at audit:
      desk-props, identity, agent-fx); suite parity 413/0 / 5,718 expects;
      receipt 6/6 PASS; quality-report unlisted. **Step 6 `blocked`
      (operator):** G2 commit hash for closure + archive.
- [x] **R3. [RESOLVED 2026-09-05 → FID-2026-0905-007 `fixed`] Remaining
      residue after R1/R2/R2.5:** `desktop/src/floor/office/office-scene.tsx`
      resolved by -0905-005; `scripts/public-release.ts` (3,065 → 178 facade
      over 23 domain modules, largest 294; surface-verified; 57/0/216 parity);
      `scripts/__nt-before-snapshot.ts` (895) deleted as a superseded untracked
      snapshot of pre-decomposition native.ts ("before" state is in git
      history at 2cc377e). **quality:report now 0 violations.** Closure
      awaits the G2 commit hash.
- [x] **R4. [RESOLVED 2026-09-05 → FID-2026-0905-006 `fixed`] Provider-drift
      baseline violations (13):** 10 baseline regenerations, 2 test splits,
      1 data-catalog exemption; env-sanitize lists derived from config
      (leak class eliminated); quality:report 15 → 2. R5 also resolved
      (bun:test imports in common model-config.test.ts; common typecheck 0).
      Closure awaits the G2 commit hash.
- [ ] **R5. [RESOLVED 2026-09-05] `common/` typecheck red (30 errors):**
      missing `bun:test` globals in `model-config.test.ts` — fixed via
      explicit `bun:test` imports (repo convention); common typecheck 0,
      suite 6/0. Recorded in FID-2026-0905-006.

## Task 16 — v0.0.29 release-night audit + desktop release blockers (2026-09-06)

> Operator directive: "we shipped 0.0.29 last night — see where we stand,
> why we had so many issues" then "the real story is the desktop is still
> unreleased — dig deeper" then "make the 2 files, run perfection then
> present". Audit findings (all tool-evidenced): phantom-source
> assume-unchanged incident (fixed at 4d85b6b), gateway watchdog flake
> (gate attempt 1, 2 tests), desktop stages silently skipped
> (SAVANT_CODE_RELEASE_DESKTOP unset), desktop workflow failed on both
> platforms (corrupted signing secret; missing Linux apt deps), latest.json
> never produced. Desktop has never shipped (only 2 runs of
> desktop-release.yml ever, both 2026-09-06).

- [x] **T16-A.** Author `FID-2026-0906-001-desktop-release-workflow-repair.md`
      (signing-secret preflight + Linux system deps) with Perfection Loop
      converged, gates declared and run green (28/0), operator presented.
- [x] **T16-B.** Author `FID-2026-0906-002-release-pipeline-desktop-visibility.md`
      (loud skips + receipt record + flag-independent POST_RELEASE_VERIFY
      assert) with Perfection Loop converged, gates declared and run green
      (28/0), operator presented.
- [x] **T16-C.** Implement FID-2026-0906-001 Steps 1-3 (RED pins → YAML
      edits → audit) — **done 2026-09-06 (automation level 3):** 3 workflow
      pins RED-first (8/3), GREEN edits to both workflows, audit 11/0 +
      YAML parse OK; Loop 4 recorded; receipt stamped 4/4 PASS; status
      `fixed`.
- [x] **T16-D.** Implement FID-2026-0906-002 Steps 1-4 (RED pins →
      catalog/transaction/stages-verify → parity audit) — **done
      2026-09-06 (automation level 3):** 8 pins RED-first, GREEN across
      catalog/desktop-stages/transaction/stages-verify, audit 46/0 +
      sibling parity 44/0 + live `--preview` SKIPPED lines + quality PASS;
      test split for the 300-line ratchet (claim file 136 lines); Loop 4
      recorded; receipt stamped 5/5 PASS; status `fixed`.
- [x] **[OPEN-OUT-OF-SCOPE → resolved]** Release-provenance guard:
      authored 2026-09-06 as
      `dev/fids/FID-2026-0906-003-release-provenance-guard.md` (status
      `analyzed`, receipt 2/2 PASS) after the operator added it to scope.
      Audit corrections vs. this entry's draft claims: tag↔commit binding
      already exists (`git-publish.ts:76`, `github-api.ts:74`) and desktop
      SHA binding partially exists — the real gap is the empty-`head_sha`
      bypass (`desktop-stages.ts:72-74`, `desktop-workflow.ts:75`). The
      three actual guards: hidden index-state detection, clean-checkout
      compile gate, empty-SHA fail-closed. NOT yet implemented.
- [x] **T16-I.** Desktop Linux icon defect (discovered during the T16-F
      scratch run 34044435124, run 3): `tauri-build`'s compile-time macro
      embeds `icons/icon.png` for non-Windows targets; only `icon.ico`
      existed (committed `icon.ico`, no png anywhere — `git ls-files` +
      `ls icons/` empty for pngs), so every Linux build died at
      "failed to open icon .../icon.png: No such file or directory"
      (job 101516846405). Fixed 2026-09-06: generated
      `icon.png`/`128x128.png`/`32x32.png` from the .ico's 48x48 32bpp
      BGRA layer (alpha mask honored; 41.6% opaque; round-trip-verified
      encoder in `dev/scratchpad/generate-desktop-icons.ts`) and extended
      `tauri.conf.json` `bundle.icon` to include them. RED evidence = the
      CI failure log above; GREEN = generator verification output.
- [x] **T16-E.** Signing secret RESOLVED BY RECOVERY 2026-09-06: the
      original keypair was found at `desktop/tauri-key.key` (gitignored,
      never committed), verified paired with the committed updater pubkey
      (`tauri.conf.json`), and re-set via `gh secret set` — proven by three
      consecutive green Windows bundle builds (runs 34042941045 /
      34044435124 / 34045779966 / 34048699120). No regeneration needed;
      existing installs keep trusting the key.
- [x] **T16-J.** Linux AppImage saga (runs 4/5/6) + operator decision:
      linuxdeploy dies without FUSE (fix: APPIMAGE_EXTRACT_AND_RUN), then
      still dies at strip (fix: NO_STRIP), then — with --verbose exposing
      the swallowed stderr — the real crash: the GTK plugin's second
      linuxdeploy pass core-dumps on `ldd` against the patchelf-rewritten
      static bun sidecar (oven-sh/bun#28281 class; tauri-apps/tauri#14796;
      fix pending tauri#12491; a surviving bundling would ship a corrupted
      sidecar; excluding the sidecar breaks the updater key-set/.sig
      contract). Operator chose the WINDOWS-ONLY updater manifest: deb-only
      Linux leg (plain asset), generator key set windows-only, appimage
      dropped from tauri.conf.json targets. 45/0 across the six desktop
      suites.
- [x] **T16-K.** Desktop assets ATTACHED to v0.0.29 (2026-09-06, operator
      approved): run 34050762638's artifacts — signed NSIS+MSI, Linux deb,
      `.sig` sidecars — uploaded via the pipeline's own
      `uploadDesktopAssets` after regenerating `latest.json` locally with
      the fail-closed generator (its exit is the assertion the artifacts
      survived the round-trip). Live-proof caught the updater URL defect
      (GitHub stores spaces as dots; `%20` form 404s) — fixed
      (FID-2026-0906-004), manifest re-uploaded, updater chain verified
      end-to-end: pinned endpoint → manifest → artifact URL HTTP 200 →
      sha256 byte-identical to the CI build. **Windows desktop
      auto-update is live for v0.0.29.** The attach also proved the
      `DESKTOP_RELEASE` download-layout defect RED-first
      (`flattenDownloadedArtifacts`).
- [x] **T16-L.** FID-2026-0906-003 (release-provenance guard)
      IMPLEMENTED 2026-09-06: index-state assertion via `git ls-files -v`
      wired mode-aware into `verifyPreflight`; clean-checkout compile gate
      (detached worktree at HEAD + frozen-lockfile install + typecheck
      chain, removed on every path) wired into the GATES stage before
      evidence finalization; desktop `head_sha: ''` now fails closed.
      48/0 across the six pipeline suites; quality ratchet PASS. Status
      `fixed` — closes on the first cut running all three guards.
- [ ] **T16-F.** Live validation: first green `desktop-release.yml` run
      (FID-001 closure — met, run 34050762638; archived) + next release
      cut's loud desktop decision (FID-002 closure).
- [x] **T16-G.** Session summary `2026-09-06-v0.0.29-release-night-audit.md`
      + LEARNINGS entry (`assume-unchanged-phantom-source`) — written
      2026-09-06; audit trail verified git-committed 2026-09-07 (`git
      ls-files` shows the summary tracked; landing commits 7e441d8/3c4f825
      era).
- [x] **T16-H.** G2 commit hash stamps into both FID Implementation
      Evidence sections + path-scoped commits (G1/G3/G8) — discharged by
      the T17-C closure ceremony (7790bb3): G2 SHAs ground-truth-resolved
      and receipts re-stamped at the archived FID paths; remaining
      path-scoped commits continue per operator approval.

## Task 17 — Operator rulings on the three OPEN-OUT-OF-SCOPE items (2026-09-06)

All three open items presented with current ground truth; operator ruled on
each 2026-09-06. This section is the audit trail.

- [x] **Ruling 1 — desktop bundle size (+R3F deps): AUTHORIZED
      OPTIMIZATION.** Lazy-load the 3D stack in the desktop renderer so the
      initial shell does not carry the R3F/drei/postprocessing bundle
      (~+150KB gz). Reverses the earlier YAGNI acceptance. Contracted as
      **T17-A** (FID-first).
- [x] **Ruling 2 — office visual presentation: AUTHORIZED BUILD.** The
      environment + character presentation layer (walls, room zones, personal
      desk furniture, articulated character detail, in-scene speech bubbles)
      is approved as a work item; visual smoke is re-run after it. T15-F and
      T15-H unblock on a **passing smoke**, not on this authorization.
      Contracted as **T17-B** (FID-first).
- [x] **Ruling 3 — common typecheck red in untouched test file: CLOSED AS
      RESOLVED.** Ground truth 2026-09-06: `bun run typecheck` in `common/`
      exits 0 — the 30 `model-config.test.ts` errors no longer exist. The
      consequence is also gone: `fid:verify
      dev/fids/archive/FID-2026-0905-002-kiosapi-provider.md --write` →
      **6/6 PASS**, fingerprint `sha256:7be7d8ed…` stamped (verified
      2026-09-06T22:27Z), and the FID's pending Commit-SHA evidence filled
      with `cb6288aa` (via `git log -S kiosapi --
      common/src/providers/registry.ts`). No code change was required.

### New work items from the rulings

- [x] **T17-A.** Desktop renderer: lazy-load the 3D stack (R3F + drei +
      postprocessing) behind a dynamic import so first paint of the shell is
      bundle-clean. **Done 2026-09-06 (FID-2026-0906-005):** single seam in
      `office-lazy.tsx` + Suspense placeholder; structural pins hold the
      boundary. Build evidence: eager shell 151.75 kB gz with zero
      three/R3F content; 3D chunk 339.80 kB gz loads on first Deck
      navigation only (~190 kB gz saved, ruling estimated ~150 kB). Closes
      on the v0.0.30 operator smoke.
- [x] **T17-B.** Office environment + character presentation layer —
      **premise superseded, executed as audit + smoke handoff
      (FID-2026-0906-006, converged 2026-09-06):** FID-2026-0905-005
      (2026-09-05) already built and composed the full layer (walls,
      windows, bookshelves, textures, 15-prop layer, 6+9 desks, rigged GLB
      robot cast, in-scene bubbles, neon-noir atmosphere) — the 08-31
      smoke finding predated it. Per-element audit table in the FID;
      re-building rejected (Law 7). Acceptance = the operator visual
      smoke at the v0.0.30 pre-cut; T15-F closes and T15-H unblocks on a
      passing smoke.
- [x] **T17-C. v0.0.30 cut — operator-held (automation level 3: local
      commits only, no push to main).** **Superseded 2026-09-06 by operator
      ruling** ("completed = close + archive + changelog immediately; stop
      worrying about the release"): the ground-truth closure ceremony
      closed + archived all seven then-active FIDs (0903-001, 0905-009,
      0906-002/-003/-004, -005, -006) — G2 SHAs ground-truth-resolved
      (`a7ed2adc`, `8ff0657b`, `6222978`, `bea0188`+`d8514d1b`,
      `dd10723c`), 66/0 consolidated battery, receipts re-stamped at the
      archived paths, CHANGELOG amended. The live validations formerly
      used as closure conditions (first in-cut `DESKTOP_BUNDLES` dispatch,
      `BACKUP_BUNDLE` run, receipt `desktopStagesSkipped` field,
      provenance guards' first cut, lazy-chunk visual smoke) remain on
      the operator's cut-day list as runtime validations — not closure
      gates. `dev/fids/` now holds only the README.

## Task 18 — Three new gateway providers: TabiToken, GoRouter, VyceAI (2026-09-06) — CLOSED (withdrawn 2026-09-07)

Operator directive: add the three gateways researched live this session
(`tabitoken.com`, `gorouter.app`, `vyceai.com`). Executed as
FID-2026-0906-008 (full Perfection Loop, RED-first): all three implemented
2026-09-06 with every static gate green (commit `ff1ea8f`). **Operator
withdrawal 2026-09-07 after live keyed testing** (keys from
`~/.savant-code-dev/credentials.json`): VyceAI disabled by directive;
GoRouter dead per operator; TabiToken auth/catalog/billing all healthy
(200s) but its `/v1/chat/completions` path is Cloudflare-WAF-blocked (403
in every client variant probed) and its catalog serves zero models. Per
operator rulings ("disable the vyce provider", "gorouter is dead", "go
ahead and remove tabi too"), **all three were removed** — registry
entries, exception-manifest entries, fetchers (`tabitoken.ts`/
`gorouter.ts`/`vyceai.ts`), gateway wiring, barrel exports, the cluster
test suite, README lines, generated provider docs. Registry restored to
11 providers / 9 setup providers. Gates at removal: typecheck ×4, common
providers 30/0, cli gateway 16/0, quality ratchet PASS,
`generate:provider-docs:check` exit 0, `lint:md` clean,
`validate:repository` PASS. FID-2026-0906-008 **closed + archived** with
the full evidence matrix in its Resolution + Lessons Learned; CHANGELOG
entry amended. Side-effect bookkeeping: `use-chat-pickers.ts` baseline
bumped 244 → 265 (honest measured count; growth belongs to
FID-2026-0907-001's picker-focus fix, `analyzed`), and the FID index's
stale `fixed` rows for `-0903-001`/`-0905-009` (archived in the T17-C
ceremony) were corrected. `dev/fids/` now holds only the README.
**Amendment 2026-09-07 (post-closure):** FID-2026-0907-001 is now
**closed + archived** (see Task 19) — the baseline growth it carried was
its legitimate implementation.

## Task 19 — Picker dismissal kills chat input focus (2026-09-07)

> Operator report: "after adding a provider, i cannot type or click the
> input box, it seems very random though, i cannot reproduce the issue."
> Diagnosis (all files read 0-EOF this session): dismissing any of the
> three picker overlays (model / provider / rewind) with **Escape or a
> backdrop click** leaves `inputFocused=false` permanently — only the
> select paths restore focus (`use-chat-pickers.ts`), the dismissal paths
> collapse to the raw store close (`build-chat-layout-props.ts:186`), and
> the input cannot self-recover because both the typing gate
> (`use-multiline-keyboard.ts:148`) and the click gate (`mouse.ts:19`)
> early-return on the same `focused` prop. Repro: open `/provider`, press
> Escape → input dead; reopen and select → input returns. Operator chose
> "Implement fix + FID" via ask_user 2026-09-07.

- [x] **T19-A.** Author `FID-2026-0907-001-picker-close-focus-loss.md`
      (RED/GREEN/AUDIT, severity high) and present the fix design. **Done
      2026-09-07** — fix design presented and approved via ask_user
      ("Implement fix + FID") before any code (Law 2). **Self-correction
      recorded:** the FID was initially written with a pre-filled receipt;
      reverted to `analyzed` with an empty receipt before implementation —
      receipts are machine-stamped only after gates run.
- [x] **T19-B.** Implement the single-seam fix: symmetric open/restore
      focus effect in `use-chat-pickers.ts:119-147` + pure predicate
      `cli/src/chat/picker-focus-transition.ts` + regression suite
      `cli/src/chat/__tests__/picker-focus.test.ts` (6/0, RED-first). **Done
      2026-09-07** — typecheck cli 0, eslint clean, prettier clean,
      lint:md clean, `fid:verify` receipt 2/2 PASS, FID status `fixed`.
- [x] **T19-C. Operator live smoke (closure arm):** open `/provider` and
      `/model`, dismiss with Escape AND with a backdrop click; confirm the
      input accepts typing and clicks immediately after each dismissal.
      **Done 2026-09-07** — operator confirmed: "I ran the live smoke —
      Escape and backdrop dismissal both restore the input."
- [x] **T19-D. Close + archive FID-2026-0907-001 + CHANGELOG entry after
      T19-C.** **Done 2026-09-07** — status `closed` with the live
      acceptance recorded in Resolution + Implementation Evidence;
      receipt re-stamped 2/2 PASS after the closure edits;
      moved to `dev/fids/archive/`; CHANGELOG entry added under
      Unreleased.

## Task 20 — Harness-honesty gates: FID-2026-0907-002 (2026-09-07)

> Operator directive: "Implement FID-2026-0907-002's four honesty gates"
> (the FID was authored by a parallel learnings-review session, status
> `analyzed`, Perfection Loop converged 3 loops). Implementation executed
> 2026-09-07 per the converged plan, with one recorded architecture
> correction (Loop 4 in the FID).

- [x] **T20-A. Step 1 — Ripgrep honesty.** Resolver's exhausted-candidates
      throw names every attempted candidate path (never an interpolated
      `undefined`) + remediation; new memoized `probeRipgrepAvailability`
      (`sdk/src/native/ripgrep.ts`); boot-time warn-only probe wired in
      `cli/src/init/init-app.ts:30-44`.
- [x] **T20-B. Step 2 — Edit-size guidance.** Shared truncation constant
      canonicalized in `common/src/constants/read-files.ts` (Loop 4
      correction: the plan's sdk-import would be a workspace cycle — sdk →
      agent-runtime is the dependency direction); sdk re-exports;
      `processStrReplace` appends size context + ranged-read remedy to
      BOTH match-failure shapes over threshold; sibling suite 3/0 (main
      suite at 264 lines — 300 ceiling forbids extending).
- [x] **T20-C. Step 3 — Exit-code audit.** `scripts/audit-exit-codes.ts`
      (pure detector: pipe into tail/head/tee then `echo $?` within 3
      lines; comments exempt; git-ls-files collector per the learnings
      rule); wired into `validate:repository` as `audit.exit-code-masking`;
      suite 8/0.
- [x] **T20-D. Step 4 — Clean-room verify.** `scripts/verify-clean.ts`
      composing `assertCleanCheckoutCompiles` (Law 13); root `verify:clean`
      script; suite 9/0 (mock runner); **live acceptance: `verify:clean
      PASS — ff1ea8f61 (v0.0.30) compiles from a clean checkout (133.9s)`.**
- [x] **T20-E. Gates + receipt.** `fid:verify` receipt **5/5 PASS**
      (typecheck sdk/cli, the three test gates); eslint clean;
      prettier clean; five honest baseline bumps recorded.
- [x] **T20-F. [OPEN-OUT-OF-SCOPE → RESOLVED 2026-09-07 (operator ruling):]
      Parallel-session draft collides with Step 3 and breaks the quality
      gate.** `scripts/audit-silent-failure.ts` (untracked, 364 lines —
      over the 300 absolute ceiling, unwired, no FID, no tests) contained
      its own `checkExitCodeMasking` overlapping T20-C plus three further
      check families (empty-catch, promise-singleton, withTimeoutNoAbort).
      It appeared AFTER the 2026-09-07 A-Z review ran `quality: PASS`.
      **Operator ruling:** the parallel session is no longer running; the
      surviving agent is in the driver's seat. Resolution: QUARANTINED to
      `dev/scratchpad/active/audit-silent-failure-draft.ts` (off the
      gated tree — dev/ is not a quality sourceRoot; the three unwired
      check families preserved as future-FID material; the wired + tested
      T20-C stands as the exit-code guard). Gates post-ruling:
      `quality: PASS (1467 files)`, `validate:repository: PASS`.
- [x] **T20-G. Close + archive FID-2026-0907-002 + CHANGELOG entry.**
      **Done 2026-09-07** — status `closed`, receipt re-stamped 5/5 PASS
      after closure edits, moved to `dev/fids/archive/`, CHANGELOG entry
      added under Unreleased, FID index updated. Commit SHA pending the
      G2 stamp at the archived path.

## Task 21 — NDJSON Phase B emitter: FID-067 v2 delegation transport, child side (2026-09-07)

> Operator directive: implement `dev/build-orders/BO-2026-09-07-ndjson-
> phase-b-emitter.md` (now fully self-contained — the frozen wire contract
> is embedded verbatim as §Frozen Wire Contract; the canonical copies live
> in the Savant parent repo). Five FIDs per the BO's phased build order:
> Phase 1 emit (003 activation+frames, 004 handleEvent tap, 005 artifact+
> error+stdout purity), Phase 2 control (006 stdin reader), Phase 3 prove
> (007 handoff matrix + cross-repo smoke). The operator directive to
> implement converts the BO's planning into approved scope (Law 2).
> Ground-truth discoveries at intake: the child's `PrintModeEvent` stream
> has NO native iteration/tokens/success/duration fields — the frozen
> payload shapes are synthesized child-side (counters, wall-clock, and
> "completed = tool_result arrived; failures arrive as error events"),
> documented per-FID; `runHeadlessPrint` RETURNS the answer (the stdout
> write lives in `cli-command-dispatch.ts`), so artifact emission happens
> in the run and stdout suppression happens in the dispatch.

- [x] **T21-A. FID-2026-0907-003 — JSON-mode activation + frame module**
      (BO Phase 1 FID 1): declared `--json` option (Commander = argv-exact),
      `cli/src/headless-ndjson.ts` frame module (strict envelope
      `{v:1,type,ts,data}`, real epoch-ms, `JSON.stringify`-per-line
      newline escaping, control-frame parser). Gates: unit suite. **Done
      2026-09-07** — module 291 ln + suite 18/0 green (re-run in the
      2026-09-07 repo audit), typecheck cli 0, receipt 2/2 PASS;
      audit-confirmed `fixed`/pending (pure module by design — wiring
      rides FIDs -004/-005/-006, closure sequenced after FID-007's
      cross-repo smoke).
- [x] **T21-B. FID-2026-0907-004 — handleEvent tap → progress frames**
      (BO Phase 1 FID 2): the five ratified kinds mapped from
      `tool_call`/`tool_result`/`activity`/`reasoning_delta` events;
      JSON-mode-only emission; non-JSON path untouched. **Done
      2026-09-07** — pure tap module `headless-ndjson-tap.ts` (96 ln)
      + `runHeadlessPrint` jsonMode wiring + dispatch `--json`
      threading; suites 40/0 across tap/ndjson/run; typecheck cli 0;
      receipt 4/4 PASS; error-event frames deferred to FID-005
      (recorded in both FIDs, discharged there).
- [x] **T21-C. FID-2026-0907-005 — artifact + error frames; stdout purity**
      (BO Phase 1 FID 3): exactly one artifact frame at the answer point,
      dispatch suppresses the raw stdout write in JSON mode, error frames
      before nonzero exits. **Done 2026-09-08** — emitter hoisted above
      every exit boundary (usage/init failures frame too); artifact at
      the answer point carries the exact `--print` answer; error frames
      at all four nonzero boundaries + mid-run error events (FID-004's
      deferral discharged); pure `headless-outcome.ts` seam suppresses
      the raw stdout write in JSON mode while stderr stays
      byte-identical both modes; 50/0 across the four suites; honest
      baseline bump headless-run.ts 284 → 296; receipt 5/5 PASS.
- [x] **T21-D. FID-2026-0907-006 — stdin control-frame reader** (BO Phase 2
      FID 4): cancel → abort at boundary; steer accepted + parked; unknown
      skipped; EOF harmless. **Done 2026-09-08** — authored (full Perfection
      Loop) and implemented RED-first: `headless-control.test.ts` 5 pins
      (2 pass/3 fail pre-wiring → 55/0 across the five headless suites),
      typecheck cli 0, quality PASS after the ceiling-forced
      `headless-answer.ts` seam move (headless-run.ts 294 ln, comment-only
      condensation), receipt 5/5 PASS, **closed + archived** same day per
      the T17-C standing directive. The live parent→child round-trip
      remains FID-007's Phase 3 boundary (T21-E) — never claimed here.
- [x] **T21-E. FID-2026-0907-007 — handoff test matrix, live** (BO Phase 3
      FID 5): the 6-case matrix as real-process tests + the cross-repo
      smoke (operator-assisted). **Done 2026-09-08** — authored (full
      Perfection Loop) and executed live to **6/6** against the actual CLI
      child (deterministic fake gateway + `INFERENCE_BASE_URL` direct-mode
      bare-slug seam). The matrix caught FOUR transport defects the
      in-process DI suites structurally could not see, all fixed forward
      per the BO's Phase 3 contract: (1) the env boot banner polluted
      stdout in both modes (`console.log` → `console.error`); (2) the
      default NDJSON frame writer omitted the `\n` delimiter (frames
      glued on one line); (3) a mid-stream cancel rode the 90s run timeout
      because a held LLM request yields no stream boundaries →
      arrival-time `onCancel` abort (run-side semantics extracted to the
      new `headless-control-plane.ts` for the 300-line ceiling); (4) the
      SDK's generic cancel message masked the parent reason →
      `PARENT_CANCEL_REASON` framed when this child consumed the cancel.
      One test pin corrected to ground truth (v1 emits `answer\n\n`);
      matrix split harness + part-a + part-b. Gates: typecheck cli 0,
      headless suites 56/0, eslint/prettier clean, quality PASS (honest
bump headless-run.ts → 297), receipt 3/3 PASS. **Closed + archived
      2026-09-08** (operator closure directive; receipt re-stamped at the
      archived path with all three gates re-run live); the cross-repo
      smoke (real Savant parent) carries OPEN as the operator-assisted
      boundary — never claimed by this record.

> **2026-09-08 closure amendment (Task 21):** T21-A/-B/-C (FIDs
> -003/-004/-005) were **closed + archived 2026-09-08** by the operator
> closure directive. Each was scope-complete with a green receipt (2/2,
> 4/4, 5/5 PASS); the recorded "archive after FID-007's cross-repo smoke"
> sequencing pointed at a FID that was never authored — the honest options
> were archive-on-own-evidence or hold against a phantom dependency, and
> the operator's standing directive ("completed = close + archive +
> changelog immediately", T17-C) chose the former. Any wire defect found
> at the future live matrix fixes forward against the archived records.
> Receipts re-stamped at the archived paths with all gates re-run live
> (28/28 PASS across the six-FID stamping battery).

## Task 22 — APInex gateway provider: FID-2026-0907-008 (2026-09-07)

> Operator request: "i am interested in adding this provider
> https://apinex.bond/models" (2026-09-07). Contract from the provider's
> machine-readable `llms.txt`: base `https://api.apinex.bond/v1`, Bearer
> auth (`sk-apx…` keys), vendor-slash model ids (`gpt/5.6-luna`),
> authenticated live catalog. The one-entry runbook governed the build
> (`docs/archive/design/Adding New Providers.md`). Same-day repo audit
> (this session) ground-truthed the module, tests, and gates.

- [x] **T22-A. Steps 1-3 (registry + wrapper + docs): `implemented`** —
      `apinex` registry entry (12th provider, post-withdrawal count),
      Nous-shaped wrapper `cli/src/utils/openrouter-models/apinex.ts`
      (`resolveKey: () => process.env.APINEX_API_KEY`), `gateway.ts`
      aggregation, provider-exception-manifest live-catalog entry,
      regenerated provider docs. All 8 static gates green (typecheck ×4,
      4 suites); audit re-ran the apinex + ndjson suites 2026-09-07:
      22/0. Receipt 8/8 PASS (re-stamped after the audit's factual fix:
      provider count 14 → 12).
- [x] **T22-B. Step 4 — keyed live acceptance (closure gate, operator):**
      set `APINEX_API_KEY` (`sk-apx…` from the APInex dashboard), then
      keyed `/v1/models` returns an OpenAI-shaped list; `/model` lists
      `apinex/…` entries; one chat round-trip on a `health: "live"`
      model; missing-key fail-closed message correct. **The FID does not
      close without this** (FID-2026-0906-008's withdrawal vindicated the
      keyed gate). After acceptance: close + archive FID-008, CHANGELOG
      entry. **Done 2026-09-08** — the operator's key (repo `.env.local`)
      drove the real production chain: `fetchGatewayModels` returned
      1,116 combined models incl. **22 `apinex/…` entries**; chat
      round-trip on `free/glm-5.3-flash` (public health table: **live**,
      all 22 rows live) → **HTTP 200, content `"OK"`**; no-key catalog
      probe → **401 fail-closed**. Operator UI observation (zero apinex
      models in `/model`) root-caused to a stale dev session whose
      process env predates the key landing in `.env.local` — a keyed
fetch had already written the same 22 models into the dev disk
      warm-start cache; restart shows them. FID-008 **closed +
      archived 2026-09-08**, receipt re-stamped 8/8 PASS, CHANGELOG
      entry added.

## Task 23 — A-Z repo audit: docs sync + bloat sweep before the v0.0.30 cut (2026-09-08)

> Operator directive (desktop skipped again): "first we need an a-z audit done
> of the entire dir, ensure all docs are fully updated, readme is fully
> updated, no bloat files and everything is fully organized/updated. No dead
> files, no outdated info." Executed as a RED discovery pass (Detective
> evidence sweep + tree inventory + drift gates) → hybrid direct-write
> remediation.

- [x] **T23-A. Drift gates.** version:check PASS, generate:provider-docs:check
      PASS, generate:protocol-bundle:check PASS, learnings:check PASS (16
      entries), hygiene:check PASS. skills:check FAIL (17 errors / 29
      warnings) — repo-scoped: two half-materialized skill dirs
      (`.agents/skills/fid-gates-unfenced-parser-contract/` +
      `minisign-pubkey-vs-secret-key/`: tracked `versions/v1/SKILL.md` +
      `VERSIONS.jsonl` but no top-level SKILL.md) + `.quarantine/` policy
      findings; home-dir findings out of repo scope. **Flagged to the
      operator — skill trust is operator-only, nothing auto-promotes.**
- [x] **T23-B. Stale version claims fixed.** README.md + README.zh-CN.md
      Release badges and hero quotes → v0.0.30 (0.0.29 compressed to
      "previously shipped"), docs/SAVANT-VERSIONING.md, docs/privacy.md.
- [x] **T23-C. Undocumented features added.** `--print ... --json` NDJSON
      delegation transport documented in README.md, README.zh-CN.md,
      docs/features.md, docs/installation.md (FID-2026-0907-003..006);
      APInex added to every provider list it was missing from (README.md,
      README.zh-CN.md, docs/features.md — where KiosAPI + OpenCode Zen were
      also missing — docs/installation.md table, docs/index.md);
      `verify:clean` added to the docs/public-release.md cut-day checks.
- [x] **T23-D. Outdated info fixed.** docs/privacy.md BYOK env-var inventory
      gained `KIOSAPI_API_KEY` + `APINEX_API_KEY`;
      docs/release-notes-v0.0.28.md "Status: pending release" → shipped
      2026-09-03.
- [x] **T23-E. Bloat/dead-file sweep verdict.** Suspected root items are
      load-bearing, NOT dead: `coding-standards/` (ECHO.md ×8 + protocol
      bundle + Verifier), root `ECHO-single-agent.md` (intentional boot-gate
      marker; canonical copy `dev/echo-v0.1.2-single-agent.md`), `assets/`
      (desktop loaders + README banner). `debug/` + `firebase-debug.log` are
      gitignored local runtime files. `art/` is tracked brand assets,
      unreferenced by code — kept (operator may prune). **Zero tracked dead
      files found; zero deletions made.**
- [x] **T23-F. Gates.** lint:md exit 0; version:check PASS;
      validate:repository PASS; quality PASS (1467 baselined files).
