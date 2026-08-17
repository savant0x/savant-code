# FID: Savant UI Overhaul — Master Organizing FID

**Filename:** `FID-2026-0816-002-savant-ui-overhaul-master.md`
**ID:** FID-2026-0816-002
**Severity:** high
**Status:** closed
**Created:** 2026-08-16 14:30
**Closed:** 2026-08-16 (all child FIDs closed with implementation evidence +
operator live-test confirmation)
**YAGNI-Compliance:** Complete

---

## Summary

Master FID organizing the Savant-Code terminal UI overhaul: five phase FIDs
(FID-2026-0816-003..007), one shared foundation decision (OpenTUI 0.2.2 →
0.5.3 upgrade first), one corrected fact base
(`docs/design/OpenTUI Terminal UI Capabilities.md` §14), and one approved plan
(`docs/design/ui-overhaul-plan.md`). This FID carries the cross-cutting gates
every child inherits and is the single entry point for the overhaul's
governance.

## Environment

- **OS:** Windows (win32); Git Bash shell
- **Language/Runtime:** TypeScript strict, Bun 1.3.14 (root pin)
- **Tool Versions:** @opentui/core + @opentui/react 0.5.3 (post-Phase-0;
  JS yoga-layout dropped — native since 0.4.1)
- **Commit/State:** main branch; UI-overhaul working tree (Phases 0/1/4
  closed, Phase 2 fixed, Phase 3 reverted, redesign + easter-egg planned)

## Detailed Description

### Problem

The current UI is visually flat and technically pinned to a pre-native
OpenTUI era, and the capability report that was to guide the overhaul contains
verified-incorrect API facts that would have sent implementation down dead
ends (scope-tree keyboard, ScrollbackSurface, native-Yoga timing). No FIDs
tracked any of this work.

### Expected Behavior

A governed, phased overhaul: foundation upgrade first, then tokens/identity,
animation-engine adoption, native components, and responsive layout — each
phase a child FID with its own exit criteria, all built on corrected OpenTUI
facts.

### Root Cause

1. `cli/package.json` pins @opentui/core + @opentui/react at 0.2.2 with the
   JS `yoga-layout` package — before native Yoga (0.4.1), native images,
   WriteConsoleW, and the Zig 0.16 rebase (0.5.x).
2. The capability report was written from secondary/anecdotal sources: three
   load-bearing claims (scope-tree keyboard model, ScrollbackSurface API,
   native-Yoga timing) contradict primary sources.
3. UI polish items (null header, `setInterval` animations, fixed 40-col
   sidebar) had accumulated without a tracking mechanism.

### Evidence

```text
$ npm view @opentui/core version
0.5.3
$ npm view @opentui/react version
0.5.3
$ grep '"version"' node_modules/@opentui/core/package.json node_modules/@opentui/react/package.json
node_modules/@opentui/core/package.json:  "version": "0.2.2",
node_modules/@opentui/react/package.json:  "version": "0.2.2",
$ grep "yoga-layout" cli/package.json
    "yoga-layout": "^3.2.1",
```

### Report-fact verification (primary-source cross-check, 2026-08-16)

- GitHub releases confirm: 0.5.0 native image rendering + FFI struct reuse,
  0.5.1 ICC PNG profiles, 0.5.2 Zig 0.16 + embedded terminal runtime, 0.4.4
  useTimeline autoplay fix, 0.4.1 native yoga-layout.
- Scope-tree keyboard (`useKeyboard` ref/trapFocus) is NOT shipped — issue
  #638 is an open proposal; the installed 0.2.2 types expose only
  `release?: boolean` (`node_modules/@opentui/react/src/hooks/use-keyboard.d.ts:4`).
- ScrollbackSurface/commitRows does not exist — roadmap post "What's Next for
  OpenTUI" (2026-07-20) states the render tree is still TypeScript-owned.
- `OPENTUI_FORCE_EXPLICIT_WIDTH=false` is a documented env var (opentui.com
  env-vars reference; packages/core/docs/development.md).
- Full classification in report §14 (verified / incorrect / unverified).

## Impact Assessment

### Affected Components

- `cli/` — entire UI surface (chat layout, sidebar, input, status bar,
  savant-ui library)
- `cli/package.json` — engine pins
- `savant-free/` — same source via `SAVANT_FREE_MODE` build define (e2e must
  stay green)
- `docs/design/OpenTUI Terminal UI Capabilities.md` — corrected (§14)
- `docs/design/ui-overhaul-plan.md` — new plan document

### Risk Level

- [x] High: foundation engine upgrade touches every render path

## Proposed Solution

### Approach

Phase-gated overhaul with the 0.5.x upgrade as Phase 0, per operator decision
(2026-08-16). One plan document, one corrected fact base, five child FIDs.
Each phase is FID-Bound Execution on implementation.

### Steps

1. Maintain this master FID as the governance container and gate carrier.
2. Child FID-2026-0816-003 (Phase 0): exact-pin upgrade to 0.5.3.
3. Child FID-2026-0816-004 (Phase 1): design tokens and visual identity.
4. Child FID-2026-0816-005 (Phase 2): animation engine adoption.
5. Child FID-2026-0816-006 (Phase 3): native code/diff components.
6. Child FID-2026-0816-007 (Phase 4): layout and responsiveness.
7. Reconcile the stale idea-shelf copy
   (`dev/idea-shelf/opentui-design-capabilities-reference.md`) with report §14.

### Verification

- Each child FID carries its own exit criteria (plan §3–§7).
- Cross-cutting gates (plan §8): typecheck ×4, `bun test`, lint,
  `lint:md`, prettier, tmux live pass per phase.
- Shared inherited gates: exact engine pins; no scope-tree/ScrollbackSurface
  patterns; `OPENTUI_FORCE_EXPLICIT_WIDTH` guard; savant-free e2e green;
  battery discipline (blur → 15fps).

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) Engine pinned pre-native-Yoga; (2) report contains 5 incorrect
  claims; (3) no tracking FIDs for UI work; (4) `lint:md` was red repo-wide
  because the untracked report file violated MD013.
- **GREEN:** Plan written (`docs/design/ui-overhaul-plan.md`); report appendix
  §14 added with verified/incorrect/unverified classification; MD013 header +
  MD001 fix applied; SCOPE.md + session summary created; open questions
  resolved (exact pins, WSL tmux + Windows Terminal, no savant-free seam).
- **AUDIT:** `bun run lint:md` → exit 0 (repo-wide); prettier check clean on
  touched docs; npm registry shows 0.5.3/0.5.3; absence checks for unshipped
  APIs exit 1 (see Evidence).
- **ADVERSARIAL:** Claim "the report was the plan's only basis" refuted — the
  plan cites primary sources and marks every unverified claim. Claim "no
  keyboard work needed" re-checked against installed types — confirmed
  (`use-keyboard.d.ts:4`).
- **CHANGE DELTA:** New document (initial authoring).

### Missed Questions

> Surface every question that should have been asked when this FID was created, answer it with the most robust default
> derivable from inspection, and fold the answer back into the relevant sections.

1. "Does savant-free need a parallel overhaul path?" → No: `IS_SAVANT_FREE`
   is a compile-time define (`cli/src/utils/constants.ts:9`), savant-free
   reuses 100% of cli/ source (SPEC.md §1). One path serves both; Phase 0
   keeps `savant-free` e2e green. Folded into plan §11.3.
2. "Which terminal is the acceptance floor?" → Windows Terminal for visuals;
   legacy ConHost exercises the OSC 66 guard and truecolor fallbacks; tmux
   automation lives in WSL (no native tmux on this machine). Folded into
   plan §11.2.
3. "Is the idea-shelf copy of the report in scope?" → Yes as a stale artifact;
   reconciled in this master's step 7 (2026-08-16): the sheet now carries a
   correction banner + reconciled version flag pointing at report §14 (see
   Resolution + Loop 5).
4. "Should the overhaul wait for the savant-free launch?" → No: unreleased
   status only means no release sequencing; the shared source still benefits.
   Folded into plan §11.3.

### Code Verification Evidence

> Before marking status as `fixed` or `verified`, verify that referenced code exists. FID metadata is a claim; code is
> ground truth.

- [x] Files referenced in Affected Components exist (cli/, savant-free/,
  docs/design/ui-overhaul-plan.md, report appendix §14)
- [x] Implementation matches the Proposed Solution — planning-phase FID:
  solution documented in `docs/design/ui-overhaul-plan.md`; implementation
  NOT yet performed (scheduled per phase FIDs)
- [x] Typecheck/tests/lint pass with pasted tool output — docs-only session;
  `bun run lint:md` exit 0 and prettier clean (pasted in Loop 1 AUDIT);
  typecheck/tests not run because zero code changed
- [x] Production call-graph evidence present for new wiring — N/A (no code
  wiring in this planning FID)
- [x] FID status reflects the actual implementation state — `analyzed` =
  Perfection Loop converged on the document; FID remains OPEN until the
  phase is implemented (closure requires implementation evidence)

### Loop 2 — Independent audit and self-correction

- **RED:** The first trapFocus absence check used a nonexistent path
  (`dist/index.d.ts`) and returned exit 2 — invalid evidence.
- **GREEN:** Re-ran against the real package layout (`src/hooks/use-keyboard.d.ts`);
  exit 1 + the `release?: boolean` declaration now cited as evidence.
- **AUDIT:** `grep -rn "trapFocus" node_modules/@opentui/react/ --include="*.d.ts"` →
  exit 1, zero hits; `use-keyboard.d.ts:4: release?: boolean;`.
- **ADVERSARIAL:** Checked that the plan's claim "no useKeyboard refactor"
  matches the 0.5.3 npm docs (only `release` option) — confirmed via
  npmjs.com/package/@opentui/react.
- **CHANGE DELTA:** < 2%.

### Loop 3 — Final convergence

- **RED:** Risk that a future implementer trusts the uncorrected report body.
- **GREEN:** Report §14 opens with "where a section above conflicts with this
  appendix, this appendix wins"; the plan header repeats the precedence rule.
- **AUDIT:** Both files re-read; precedence statements present at
  `docs/design/OpenTUI Terminal UI Capabilities.md` §14 intro and
  `docs/design/ui-overhaul-plan.md` header.
- **ADVERSARIAL:** No residual challenge — all children cite the corrected
  fact base.
- **CHANGE DELTA:** 0%.

### Loop 4 — Second-pass review (2026-08-16)

- **RED:** Independent second-pass review of all 5 child FIDs found 2 critical, 4
  high, 3 medium issues: (1) Phase 3 claimed an ascii-font upgrade already
  implemented in `branding.tsx:58`; (2) Phase 1 sidebar section ordering was
  stale (7 sections listed, 8 actual — Teacher and Adversarial Trust Matrix
  missing); (3) Phase 0 missing explicit `bun install` lockfile step + rollback
  plan; (4) Phase 4 focus-containment fallback underspecified; (5) Phase 2
  `useBlur`-on-Windows unverified; (6) Phase 3 missing tree-sitter init
  fallback; (7) `cwd:` data-flow line not distinguished from display line.
- **GREEN:** All child FIDs corrected (FID-003..007 Loop 4 sections). Criticals
  #1 and #2 fixed in place. Highs #3–#6 and mediums #7–#9 folded into the
  relevant child FIDs. Master FID unchanged in content — this Loop 4 documents
  the cross-cutting review and routes each finding to its child.
- **AUDIT:** Per-file `bunx markdownlint` exit 0 on all 6 FIDs; `bun run typecheck`
  (all 11 workspaces) exit 0; `bun x eslint . --max-warnings 0` exit 0; `bun run
  lint:md` (repo-wide) exit 0.
- **ADVERSARIAL:** PASS — all 6 FIDs converge; every Loop 4 citation resolves to
  real code at the claimed location. Two minor notes (FID-003 rollback tagging,
  FID-004 sidebar non-section inventory) applied in their child FIDs.
- **CHANGE DELTA:** ~3% (added this Loop 4 section only).

### Loop 5 — Re-convergence (2026-08-16)

- **RED:** Three Ground-Truth drift findings: (1) header `Status: analyzed`
  disagreed with the README's `converged` (new status vocabulary); (2)
  Environment still claimed @opentui 0.2.2 + JS yoga-layout + "docs-only
  working-tree" when Phase 0 shipped 0.5.3 (yoga dropped) and Phases 1–4
  landed; (3) the Lessons-Learned line repeated the superseded "planning FIDs
  are closure records" claim — the exact error corrected in the FID-lifecycle
  lesson.
- **GREEN:** Status → `converged`; Environment updated to 0.5.3 (native yoga);
  Resolution gained a per-child status ledger; the stale lesson replaced with
  the closure-requires-implementation-evidence invariant.
- **AUDIT:** `node_modules/@opentui/core/package.json` +
  `node_modules/@opentui/react/package.json` both report `"version": "0.5.3"`
  (grep pasted); `grep -n yoga-layout cli/package.json` → ABSENT;
  `grep -n @opentui cli/package.json` → `0.5.3` exact pins. README table
  already read `converged` (now matches the header).
- **ADVERSARIAL:** No residual challenge — every changed field now matches a
  greppable artifact.
- **CHANGE DELTA:** ~4%.

## Resolution

- **Closed Date:** 2026-08-16 — every child FID closed with implementation
  evidence and the operator's live-test confirmation; the overhaul work
  queue is empty.
- **Fix Description:** Master governance FID for the Savant UI overhaul.
  Planning only — no UI code changed by this FID itself. Perfection Loop
  converged on the document; kept OPEN (`converged`) in `dev/fids/` as the
  active work queue until its children closed with implementation evidence
  — all children have now closed, so the master closes too.
- **Child status (2026-08-16):** Phase 0 (003) + Phase 1 (004) + Phase 4
  (007) **closed**; Phase 3 (006) **closed** (custom renderer re-verified
  by operator); logo easter egg (008) **closed** (operator visual pass
  PASS — click-per-message flow, centered bubbles, cyan-on-near-black
  viewport-height flood, 5 s moral bubble — archived 2026-08-16); Phase 2
  (005) **closed** (animation engine adopted; blur → 15fps confirmed in
  live test, archived 2026-08-16); Phase-notification redesign
  (009) **closed** (diff viewer confirmed; filled-chip phase bar renders
  identically in Cursor + classic PowerShell console — operator visual
  pass PASS, archived 2026-08-16); post-FID-009 polish backfill
  (010) **closed** (mode-selector cyan strokes + reactive trust matrix
  confirmed, archived 2026-08-16); rich terminal output
  (011) **closed** (traffic-light panel + status badge + gutter confirmed,
  archived 2026-08-16); trust-matrix label/icon fix
  (012-trust-matrix-stuck-awaiting-audit) **closed** (archived 2026-08-16).
  Master step 7 (idea-shelf reconciliation) **complete** — the
  stale reference sheet now carries a correction banner + reconciled
  version flag pointing at report §14.
- **Tests Added:** No code tests (docs-only session). Doc gates: `lint:md`
  exit 0, prettier clean.
- **Verification Evidence:** Pasted in Loop 1/2 AUDIT sections (npm view
  output, grep exit codes, lint/prettier exit 0).
- **Archived:** 2026-08-16 → `dev/fids/archive/` (all children closed; work
  queue empty)

> When status is set to **closed** (after implementation), move this file to
> `dev/fids/archive/` and append an entry to `CHANGELOG.md`.

## Lessons Learned

- Closure requires implementation evidence (Ground-Truth rule): a converged
  planning document stays `converged`/`analyzed` in `dev/fids/`, never
  `closed` — `closed` means the code exists and the gates pass.
- An absence check with exit code 2 (bad path) is not evidence; verify the
  command's path and exit code before citing an empty result.
