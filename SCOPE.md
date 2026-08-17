# SCOPE — UI Overhaul Planning Session (2026-08-16)

> Single-agent ECHO protocol scope artifact. Items below are the interpreted
> scope for the current task. Operator confirmation converts interpreted scope
> into approved scope. Any drop/deferral requires a blocking presentation.

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

## Out-of-scope issues discovered

- [OPEN-OUT-OF-SCOPE] **savant-free e2e test suite** — `bun test e2e/tests/`
  fails for reasons unrelated to the Phase 0 upgrade: (1)
  `getSavantFreeBinaryPath()` returns `cli/bin/savant-free` without `.exe` on
  Windows (the binary is `savant-free.exe`); (2) a `SavantFreeSession` export
  is missing from the e2e utils. The `SAVANT_FREE_MODE=true` build compiles
  (binary produced) — only the test harness is broken. Fixing it is a separate
  task, not Phase 0.
- [OPEN-OUT-OF-SCOPE] **Interactive Phase 0 acceptance** (tmux smoke in WSL,
  Windows Terminal visual pass, ConHost guard check) cannot be run in this
  headless session — deferred to operator/runtime verification before FID-003
  closes.
