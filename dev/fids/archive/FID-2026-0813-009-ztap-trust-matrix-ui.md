<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: ZTAP Trust Matrix — Live Adversarial Verdict Overlays

**Filename:** `FID-2026-0813-009-ztap-trust-matrix-ui.md`
**ID:** FID-2026-0813-009
**Severity:** medium
**Status:** closed
**Planning Status:** Converged after Perfection Loop; implementation complete.
**Created:** 2026-08-13
**YAGNI-Compliance:** Complete — implementation scope delivered
**Master FID:** FID-2026-0813-001
**Depends On:** FID-2026-0813-004

---

## Summary

Implements the Live Adversarial Trust Matrix (build order P1.C): during AUDIT/ADVERSARIAL, OpenTUI renders diff
overlays with live verdict highlights — Verifier flag = amber, Adversary refutes = green + explanation. The overlays
are **read-only** (zero control surface) and derive **only** from signed `provenance_receipt` events (master D9/D7) —
never from synthetic or local UI state. This is the visible governance surface that makes the moat tangible, and it is
deliberately independent of the crypto (it can ship and be exercised before P1.A lands).

## Environment

- **OS:** Windows (`win32`); cross-platform (Bun)
- **Language/Runtime:** TypeScript, React/OpenTUI (`@opentui/core` 0.2.2, `react` ^19); `cli/` workspace
- **Master:** `FID-2026-0813-001` (D7, D9, D12, P1.C gates)
- **Depends on:** FID-2026-0813-004 (the `provenance_receipt` event contract, which is unconditional per FID-004;
  FID-002 supplies the existing event-stream catalog as context only)

## Detailed Description

### Problem

Governance is invisible: users see a Verifier/Adversary phase happen, but not what was judged, flagged, or refuted.
The build order's P1.C turns the terminal into a mentoring surface — and doubles as the moat (users learn to spot
slop). It must never become a control surface and must never fabricate highlights.

### Expected Behavior

1. A `provenance_receipt` event stream (write receipt / verifier verdict / adversary verdict / supersession notice)
   feeds CLI state subscriptions during AUDIT/ADVERSARIAL.
2. OpenTUI diff overlays render: amber for Verifier flags, green + explanation for Adversary refutations, neutral for
   confirmed verdicts; verdict text displayed verbatim (parsed for display only — D7).
3. Zero control authority: overlay state cannot trigger tools; no write/terminal tool is reachable from overlay
   components or their state.
4. Overlay fidelity gate: every highlight traces to a signed event with a matching receipt `seq`; a synthetic event
   (no matching signed record) renders nothing and logs a warning.
5. The matrix renders even when crypto is `off` (events still flow from the existing phase lifecycle; fidelity checks
   then verify against event-source identity rather than signatures — the overlay is display, the receipt is proof).

### Root Cause

No UI surface streams phase verdicts; the existing panels render chat/diff state only.

### Evidence

- UI surface: `cli/src/components/savant-ui/` (build order touchpoint; exact components pinned at implementation).
- Event contract: `provenance_receipt` defined by FID-2026-0813-004; bounded like `RuntimeTraceEvent`
  (`common/src/types/contracts/trace.ts:4`, `cli/src/utils/trace-writer.ts:31`).
- Verdict text format: `agents/adversary/adversary.ts:64-84` (CONFIRMED/REFUTED/ADJUSTED/NEEDS-REVIEW lines).

## Impact Assessment

### Affected Components

- MODIFY `cli/src/components/savant-ui/` — overlay components + state subscriptions
- MODIFY `cli/src/chat/` state wiring — event subscription (read-only)
- NEW `cli/src/components/savant-ui/__tests__/` — fidelity + zero-control tests
- No runtime/tool-executor changes (read-only display)

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: A UI that fabricates or misattributes verdicts would destroy trust in the entire governance story
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Read-only state flow: events → normalized overlay state (keyed by receipt `seq`) → React components. Fidelity is a
structural property: overlay state is derived by a pure reducer from the event stream only; components receive
verified `{seq, verdictText, phase, status}` tuples. No component holds or mutates tool state.

### Steps

1. Define the overlay state shape + pure reducer (event → overlay row; unknown/unmatched event → dropped + warning).
2. Subscribe to `provenance_receipt` events in chat state (read-only subscription; no emit path).
3. Render diff overlays (amber/green/neutral per verdict classification; verbatim text; per-FID grouping).
4. Fidelity tests: synthetic events render nothing; real fixtures render exactly the matching rows.
5. Zero-control tests: assert overlay components cannot reference tool-execution handlers (static import graph check)
   and no write/terminal tool is in the overlay's reachable toolset.
6. Typecheck + lint + CLI tests (run in tmux per project convention for interactive surfaces).

### Verification

```text
bun test cli/src/components/savant-ui/__tests__/
bun run --cwd=cli typecheck
bun x eslint cli/src/components/savant-ui --max-warnings 0
bunx prettier --check cli/src/components/savant-ui
# interactive smoke per project convention: run interactive CLI tests in tmux
```

## Perfection Loop

### Loop 1 — RED

- **RED:** Build order P1.C named the surface but not the fidelity contract; a naive implementation could render
  highlights from model self-reports or local state, fabricating governance.
- **GREEN:** Read-only reducer architecture; fidelity gate (every highlight traces to a signed event by `seq`);
  zero-control tests; verbatim text; works with crypto off (display vs proof separation).
- **AUDIT:** The overlay's data source is the same event stream the ledger signs (FID-2026-0813-004); the fidelity
  rule is mechanically checkable; static import-graph test enforces zero control authority.
- **ADVERSARIAL:** "Could a malicious event stream fake a highlight?" → The stream is harness-emitted and bounded;
  with crypto on, fidelity re-checks the receipt signature; with crypto off, the overlay is display-only and the
  ledger-independent, which the UI header states. Accepted.
- **CHANGE DELTA:** ~0.

### Missed Questions

1. **Does the matrix pause execution?** → No; it is observational; the loop continues while overlays stream.
2. **Is verdict text rendered raw?** → Yes, verbatim (it is the evidence); the overlay marks it as model output.
3. **Where does the matrix live in the layout?** → In the existing diff/panel area (`savant-ui/`), toggled by
   `/matrix` or auto-shown during AUDIT/ADVERSARIAL; exact placement pinned at implementation.
4. **Does the matrix show unsigned phases when crypto is off?** → Yes, labeled "unverified display" — honesty over
   silence (D12).

### Code Verification Evidence

- [x] UI surface located (`cli/src/components/savant-ui/` exists)
- [x] Event contract defined (FID-2026-0813-004) and bounded-event precedent cited (`trace-writer.ts:31`)
- [x] Verdict text format confirmed (`agents/adversary/adversary.ts:64-84`)
- [x] FID ledger validation passes (master + children set)
- [x] Overlay implementation + fidelity/zero-control tests — 6/6 focused tests passed

### Loop 2 — Independent audit and self-correction

- **RED:** Second pass: "amber/green/neutral" classification from free text is fragile; the reducer could mislabel a
  CONFIRMED line as a refutation.
- **GREEN:** Classification is display-only and conservative: exact-prefix matching on the Adversary's documented
  verdict prefixes (CONFIRMED/REFUTED/ADJUSTED/NEEDS-REVIEW/OMISSION); anything else renders neutral with the raw
  text; the signed payload (not the classification) is the integrity object.
- **AUDIT:** Re-read confirms classification never affects integrity (D7) and conservative matching bounds
  mislabeling.
- **ADVERSARIAL:** A model that stops using documented prefixes degrades to neutral highlights, never fake ones —
  fail-safe direction. Accepted.
- **SELF-CORRECT (post-write adversarial pass):** dependency corrected to FID-2026-0813-004 — this FID's prose already
  named 004 as the owner of the `provenance_receipt` event contract, but the metadata (and the master registry)
  declared 002. 004 now guarantees the event stream is unconditional, which is what the "renders with crypto off"
  property (Expected Behavior 5) rests on (fixes F1).
- **CHANGE DELTA:** <2%.

### Loop 3 — Final convergence

- **RED:** No residual risks.
- **GREEN:** Overlay design final.
- **AUDIT:** Converged; delta <2%.
- **ADVERSARIAL:** No unresolved challenge.
- **CHANGE DELTA:** <2%.

## Implementation Closure — COMPLETE

- **Implemented:** 2026-08-13.
- **Delivered:** The read-only Trust Matrix consumes the existing runtime event path through the chat store and renders conservative phase/verdict overlays; it has no tool, terminal, write, or control authority.
- **Verification:** Trust Matrix reducer/component fidelity suite passed 6/6; common and CLI typechecks passed; static zero-control checks passed.

## Resolution

- **Closed Date:** 2026-08-13.
- **Fix Description:** Event-sourced, read-only live adversarial Trust Matrix implemented.
- **Tests Added:** Event reduction, signed-event fidelity, crypto-off neutrality, dedupe, and control-boundary tests.
- **Verification Evidence:** Focused suite 6/6 and full repository gates passed.
- **Archived:** Yes — moved to `dev/fids/archive/`.

## Lessons Learned

- A governance display must derive from the same event stream the ledger signs, or it is decoration.
- Classification for display must fail safe (neutral), never fabricate a verdict.
