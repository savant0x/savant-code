<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Agent-Steering Teacher — Live Sidebar Surface

**Filename:** `FID-2026-0813-022-teacher-sidebar-surface.md`
**ID:** FID-2026-0813-022
**Severity:** medium
**Status:** closed
**Created:** 2026-08-13
**YAGNI-Compliance:** Verified — read-only surface reuse, no new control/write path, no new hook where a store selector suffices
**Depends On:** none

---

## Summary

The Agent-Steering Teacher (`/learn`, FIDs 011–020) is implemented, Nova-audited, and operator-closed. Its exercise runs live and streams lifecycle events into the chat transcript, but the dedicated read-only component `LearnOverlay` (`cli/src/components/savant-ui/teacher/learn-overlay.tsx`) is implemented, tested, and exported with **no consumer** — nothing mounts it, so the dedicated teacher surface is dead code.

This FID surfaces the live exercise as a **read-only panel in the right sidebar** by reusing `LearnOverlay` + `reduceLearnState` and the proven zustand `provenanceEvents`/`TrustMatrix` pattern. It adds no control, write, filesystem, or spawn authority and introduces no new trust domain beyond what FIDs 011–020 established. The feature is a passive consumer of the existing teacher runtime.

This FID **supersedes and corrects** the Nova build order at `dev/build-orders/2026-08-13-teacher-sidebar-surface-build-order.md`. The build order's shape is correct and its ground-truth table is line-accurate, but four claims are wrong and are corrected here (see *Perfection Loop — Loop 1 — RED*).

## Environment

- **OS:** Windows target; the surface is platform-agnostic (OpenTUI).
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2.
- **Tool Versions:** Existing zustand chat store, `SidebarSection`, `LearnOverlay`, teacher runtime.
- **Commit/State:** Working-tree planning state. Teacher runtime and ZTAP are implemented and archived; this FID extends the implemented teacher, it does not re-open 011–020.

## Detailed Description

### Problem

The teacher feature renders only as chat messages. `LearnOverlay` — the component built specifically to render the exercise (FID-2026-0813-018) — is exported and unit-tested but has zero import sites outside its barrel, so the dedicated teacher surface never appears in the terminal UI.

### Expected Behavior

When an exercise is active, a read-only `Teacher` panel in the right sidebar renders the public challenge fields (objective, prompt, visible guidance), the color-coded phase, the bounded event log, the completion state, the ZTAP receipt line, and the progression/competency status. The panel appears only while an exercise is active, is non-interactive (`focusable={false}`, `selectable={false}`), and never renders private-pack material (known-good source, hidden tests, mutation contracts, raw critique).

### Root Cause

The runtime bridge (`cli/src/teacher/runtime.ts`) and the store were never connected to the sidebar: the command layer streams events to chat only, and no zustand slice carries `TeacherSessionState`, so the sidebar has nothing to subscribe to.

### Evidence

- `LearnOverlay` is exported and memoized but unmounted: `grep -rn "LearnOverlay" cli/src` shows only `savant-ui/index.ts` (barrel), `savant-ui/teacher/learn-overlay.tsx` (definition), and its test — no component import.
- The store precedent exists and works: `right-sidebar.tsx:101` reads `useChatStore((s) => s.provenanceEvents)`; `sidebar-actions.ts:87-93` exposes `addProvenanceEvent` with a 200-entry cap; `sdk-event-handlers.ts` dispatches provenance receipts into it.
- `TeacherSessionState` already exposes everything the panel needs (`runtime.ts:86`): `challenge`, `phase`, `completionState`, `events`, `steering`, `attemptId`, `receipt`, `persisted`, `competencyState`.

## Impact Assessment

### Affected Components

- `cli/src/teacher/runtime.ts` — snapshot-copy fix in `getTeacherSessionState()`.
- `cli/src/state/chat-store/{types,initial-state,sidebar-actions}.ts` — `teacher` slice.
- `cli/src/commands/learn.ts` — call `setTeacherState`/`clearTeacher` after each mutation.
- `cli/src/components/right-sidebar.tsx` — mount the `Teacher` section.
- `cli/src/components/savant-ui/teacher/learn-overlay.tsx` — extend props to render receipt + progression.
- `cli/src/teacher/render.ts` (new) — shared `receiptLine`/`progressionLine`/`completionLabel` (extracted from `learn-result.ts`).
- `cli/src/commands/learn-result.ts` — import the shared helpers (no behavior change).
- `eslint.config.js` — `import/no-restricted-imports` for the teacher UI components.

### Risk Level

- [ ] Critical: system crash, data loss, or security vulnerability
- [ ] High: major feature broken, no workaround
- [x] Medium: a shipped, tested component is dead code; the fix is additive UI
- [ ] Low: cosmetic

## Proposed Solution

### Approach

Mirror the `provenanceEvents` → `TrustMatrix` pattern exactly, with the runtime singleton remaining the single source of truth:

1. Add a `teacher` slice to the chat store: `teacherState: TeacherSessionState | null`, `setTeacherState`, `clearTeacher`.
2. Wire the command layer to call `setTeacherState(getTeacherSessionState())` after every mutation (start → forge → sandbox → adjudication → critique → cancel) and `clearTeacher()` on exit.
3. Mount a read-only `SidebarSection title="Teacher"` below the `Session` section and above `PerfectionLoop`, rendering `<LearnOverlay>` plus the receipt/progression lines.
4. Enforce zero-authority with an ESLint restriction scoped to the UI components plus a static scan.

### Corrections applied to the Nova build order (all six)

1. **Receipt field (build-order correction 1 was itself wrong).** The panel reads `teacherState.receipt: TeacherAttemptReceipt | null` (`runtime.ts:93`), **not** `receiptStatus`. `receiptStatus` is a `ProgressionRecord` field (`common/src/teacher/progression.ts:29`), absent from `TeacherSessionState`. The signed/unverified distinction is `receipt !== null`; render `signed by <receipt.role> over <receipt.over>`, else `local-unverified` — exactly `learn-result.ts:receiptLine()`.
2. **FID numbering.** `021` is already `canonical-version-bump-tool` (archived); this FID is `022`, and no child set is created (single cohesive FID, see *YAGNI*).
3. **Event snapshot copy.** `getTeacherSessionState()` returns `events` **by reference** (`runtime.ts:103`), while `LearnOverlay` memoizes `reduceLearnState` on `[challenge, events]` (`learn-overlay.tsx:63-65`). In-place `events.push(...)` would keep the array identity stable and freeze the memo. Fix: return `events: [...events]` in `getTeacherSessionState()`.
4. **Dangling reference.** The build order cites `docs/design/Agent-Steering Teacher — Live Sidebar Surface.md` ("DeepSeek deep-research output"), which does not exist in the repo (`find docs dev -iname "*sidebar*"` returns no such file). This FID is self-contained and code-grounded.
5. **Content/mount mismatch.** The build order lists "receipt status, competency state" as panel content but mounts `<LearnOverlay challenge events>`, which renders only objective/prompt/guidance/phase/events/completion. Fix: extract `receiptLine`/`progressionLine`/`completionLabel` from `learn-result.ts:16,29,35` into `cli/src/teacher/render.ts` (Law 13), extend `LearnOverlayProps` with optional `receipt`/`persisted`/`competencyState`, and render the receipt + progression rows inside the overlay.
6. **Zero-authority ESLint scope.** The restriction targets the UI (`cli/src/components/right-sidebar.tsx`, `cli/src/components/savant-ui/teacher/learn-overlay.tsx`) — **not** `cli/src/teacher/runtime.ts`, which legitimately imports `node:fs`/`node:crypto`/`node:path` for the progression store.

### Phase P1 — State plumbing

- Add to `cli/src/state/chat-store/types.ts`: `teacherState: TeacherSessionState | null` in state; `setTeacherState: (s: TeacherSessionState) => void` and `clearTeacher: () => void` in actions (type-only import of `TeacherSessionState` from `../teacher/runtime` — no runtime cycle).
- Implement `setTeacherState`/`clearTeacher` in `sidebar-actions.ts`; seed `teacherState: null` in `initial-state.ts`; reset it in the existing reset paths (mirror `provenanceEvents`).
- In `runtime.ts`, change `getTeacherSessionState()` to return `events: [...events]` (snapshot copy) — correction 3.
- In `learn.ts`, call `setTeacherState(getTeacherSessionState())` in the `onEvent` callback, after `submitTeacherCritique`, after `cancelTeacherExercise`, and `clearTeacher()` after `exitTeacherExercise`.

**Exit gate:** store reflects runtime state with no drift; `clearTeacher` empties the slice; a selector subscription re-renders. Test: set/clear/selector; plus a regression asserting two consecutive `getTeacherSessionState()` calls return distinct-but-equal `events` arrays.

### Phase P2 — Sidebar mount + receipt/progression rendering

- In `right-sidebar.tsx`, add `const teacherState = useChatStore((s) => s.teacherState)` and conditionally render, below the `Session` section and above `{fsmPhase !== 'idle' && <PerfectionLoop />}` (`right-sidebar.tsx:231`):

```text
{teacherState?.challenge != null && (
  <SidebarSection title="Teacher" defaultExpanded>
    <LearnOverlay
      challenge={teacherState.challenge}
      events={teacherState.events}
      receipt={teacherState.receipt}
      persisted={teacherState.persisted}
      competencyState={teacherState.competencyState}
    />
  </SidebarSection>
)}
```

- Extend `LearnOverlayProps` with `receipt?: TeacherAttemptReceipt | null`, `persisted?: boolean`, `competencyState?: CompetencyState | null`; render `receiptLine(receipt)` and `progressionLine(persisted, competencyState)` beneath the completion line. Apply theme tokens for phase/completion colors; truncate long fields (~80 chars, `wrapMode="none"`).
- Extract `completionLabel`/`receiptLine`/`progressionLine` into `cli/src/teacher/render.ts`; `learn-result.ts` re-exports/imports them (no behavior change) — correction 5.

**Exit gate:** panel appears only when `challenge != null`; hides on clear; renders all public fields including receipt + progression; no focusable/selectable elements; narrow-terminal truncation verified.

### Phase P3 — Zero-authority verification

- Add `import/no-restricted-imports` to `eslint.config.js` for the teacher UI files, blocking `node:fs`, `node:child_process`, `node:path`, `node:crypto`, dynamic `import()`, and any `@savant-code/agent-runtime` runtime import. Scope the rule to `cli/src/components/right-sidebar.tsx` and `cli/src/components/savant-ui/teacher/**` only (correction 6).
- Add a static zero-authority scan (mirror the Trust Matrix audit): assert the sidebar/overlay render only public challenge fields + public attempt events, never `knownGoodSource`, `hiddenTests`, `private`, or `mutation` pack fields, and never raw critique text.
- e2e: stubbed forge, full Forge→sandbox→grader lifecycle; assert the panel updates across phases and terminal state; assert reset on cancel/exit.

**Exit gate:** scan clean; e2e passes; panel never renders private pack; cancel/exit reset verified; ESLint zero warnings.

### Steps

1. `runtime.ts`: `events: [...events]` snapshot copy + unit test.
2. Chat store slice (`types`/`initial-state`/`sidebar-actions`) + `setTeacherState`/`clearTeacher` + reset wiring.
3. `learn.ts`: `setTeacherState`/`clearTeacher` at each mutation point.
4. `cli/src/teacher/render.ts` extraction; `learn-result.ts` switches to it.
5. `learn-overlay.tsx`: extended props + receipt/progression rows.
6. `right-sidebar.tsx`: `teacherState` selector + conditional `Teacher` section.
7. ESLint restriction + zero-authority static scan.
8. Tests (store, reducer grace, zero-authority scan, e2e lifecycle).

### Verification

- `bun run typecheck` ×4 (sdk, common, agent-runtime, cli).
- `bun test cli/src/teacher cli/src/commands/__tests__/learn.test.ts` plus new store/scan/e2e tests.
- `bun x eslint . --max-warnings 0`, `bun run lint:md`, Prettier.
- `bun run validate:repository` and `bun test scripts/fid-ledger.test.ts`.
- Call-graph: grep that the sidebar mounts `LearnOverlay` from a production entry point (right-sidebar is rendered by the app shell), and that `setTeacherState` is called from the `/learn` command path.

## Perfection Loop

### Loop 1 — RED

- **RED:** (1) The build order's "correction 1" points the panel at `receiptStatus`, which exists only on `ProgressionRecord` (`common/src/teacher/progression.ts:29`), not on `TeacherSessionState` (`runtime.ts:86`, receipt field at `:93`). (2) The build order reuses `FID-2026-0813-021`, already taken by `canonical-version-bump-tool` (confirmed in `dev/fids/archive/`). (3) It proposes "push the runtime state wholesale" without accounting for `getTeacherSessionState()` returning `events` by reference (`runtime.ts:103`) while `LearnOverlay` memoizes on `[challenge, events]` (`learn-overlay.tsx:63-65`) — an in-place-mutated array would freeze the memo. (4) It cites a DeepSeek design doc that is not in the repo. (5) It lists "receipt status, competency state" as panel content while mounting `<LearnOverlay challenge events>`, which does not render those fields. (6) It leaves the zero-authority ESLint scope ambiguous (it must not target `cli/src/teacher/runtime.ts`, which imports `node:fs`/`node:crypto`/`node:path`).
- **GREEN:** Corrections 1–6 folded into *Proposed Solution*: read `receipt` (not `receiptStatus`); use FID `022`; return `events: [...events]`; drop the dangling doc reference; extract shared render helpers and extend `LearnOverlayProps`; scope the ESLint rule to the UI only.
- **AUDIT:** Direct reads confirm every citation: `runtime.ts:86/90/93/98/103/106/113`, `learn-overlay.tsx:23/32/44/58/63-65`, `right-sidebar.tsx:6/101/107/231/236`, `sidebar-actions.ts:87-93`, `progression.ts:29`, `learn-result.ts:16/29/35`. `ls dev/fids/archive/` shows `021-canonical-version-bump-tool.md`; `find docs dev -iname "*sidebar*"` shows no DeepSeek design doc.
- **ADVERSARIAL:** The mount is passive, but a stale panel is worse than none — the snapshot-copy fix is load-bearing, not cosmetic. The zero-authority scan must assert *absence* (private-pack field names unreachable), and absence-shaped checks must paste the exact search so the evidence boundary is not silently promoted to PASS.
- **CHANGE DELTA:** This is the first authoring pass; the build order's design (not its errors) was adopted.

### Missed Questions

1. **Does the panel need a `useTeacher()` hook?** → No. A plain `useChatStore((s) => s.teacherState)` selector suffices, exactly like `provenanceEvents` (`right-sidebar.tsx:101`). A hook adds a layer with no benefit (Law 7/YAGNI).
2. **Where does the receipt line come from?** → `receipt !== null` drives it; `receipt.role` + `receipt.over` are the display fields. `receiptStatus` is derived downstream on the *store record* (`record.ts:118`), never on session state.
3. **How does the event log stay fresh under in-place mutation?** → `getTeacherSessionState()` must return a copy; the memo dependency must see a new array identity per snapshot.
4. **What mounts the panel in the render tree?** → The app shell renders `RightSidebar`; the `teacherState` selector inside it is the production call site (Law 4 — must be greppable, not assumed).
5. **Can the panel leak private material?** → No — `LearnOverlay`/`reduceLearnState` consume only `PublicChallenge` fields and `AttemptEvent[]`; the zero-authority scan pins this. Known-good, hidden tests, and mutation contracts never enter the component props.
6. **What happens on cancel vs exit?** → `cancel` keeps `challenge` non-null and shows `CANCELLED` (panel stays, state `cancelled`); `exit` clears the slice and the panel unmounts.
7. **Does this weaken any ECHO law?** → No. Read-only, no write/control/tool path; Law 12 (no sensitive data in the surface) is honored by the private-pack boundary.

### Code Verification Evidence

> Planning stage — verifies that the referenced code exists and the plan matches reality, not that new code exists.

- [x] `TeacherSessionState` exists with the cited fields (`runtime.ts:86`), including `receipt: TeacherAttemptReceipt | null` (`:93`) and no `receiptStatus`.
- [x] `getTeacherSessionState()` returns `events` by reference (`runtime.ts:103`) — confirms the snapshot-copy fix is required.
- [x] `LearnOverlay` memoizes on `[challenge, events]` (`learn-overlay.tsx:63-65`) and is currently unmounted (grep shows no component import site).
- [x] `provenanceEvents` precedent is live (`right-sidebar.tsx:101`, `sidebar-actions.ts:87-93`).
- [x] `FID-2026-0813-021` is `canonical-version-bump-tool` (archive listing) — confirms `022` is the next free id.
- [x] No production teacher-sidebar code exists yet (feature not implemented).
- [ ] New implementation evidence — intentionally pending; no production code is authorized by this planning loop.

### Loop 2 — Independent audit and self-correction

- **RED:** Re-read found one residual risk: the store slice type-imports `TeacherSessionState` from the runtime module; a future runtime cycle (runtime → store → runtime) would be a hidden trap. Also, `reduceLearnState` and the new render helpers must not diverge on the "signed vs local-unverified" phrasing.
- **GREEN:** The store uses a **type-only** import (`import type { TeacherSessionState }`), which the runtime never evaluates — no cycle. `receiptLine`/`progressionLine` are extracted once and shared by both `learn-result.ts` and `learn-overlay.tsx`, so the phrasing has one source of truth.
- **AUDIT:** `runtime.ts` imports nothing from the chat store; the store importing the runtime type is therefore acyclic by construction. `grep` confirms `receiptLine`/`progressionLine`/`completionLabel` are currently private to `learn-result.ts:16,29,35`.
- **ADVERSARIAL:** Type-only imports erase the runtime cost but not the conceptual coupling; acceptable because the runtime is already the single source of truth for session state and the store is a passive mirror. The shared helpers remove the wording-drift risk.
- **CHANGE DELTA:** <10% (clarifications, no structural change).

### Loop 3 — Final convergence

- **RED:** No remaining blocking question. The only open risk is verification-tooling scope: the zero-authority ESLint rule must not overreach into the runtime bridge.
- **GREEN:** Scope is fixed to the two UI files plus the teacher UI directory; the runtime bridge is explicitly excluded; a static scan covers the private-pack boundary independent of ESLint.
- **AUDIT:** The plan is fully integratable through the existing store/`SidebarSection`/`LearnOverlay`/teacher-runtime boundaries, adds no crypto/database/ECHO change, and is a strict subset of already-audited trust domains (011–020).
- **ADVERSARIAL:** The strongest residual challenge is that a live panel could still show a stale phase if the command layer misses a `setTeacherState` call; the e2e lifecycle test is the gate that catches any missed mutation point.
- **CHANGE DELTA:** <2% from Loop 2.

- **POST-PERFECTION-LOOP VERDICT:** Planning is converged and code-grounded. Nova's independent planning audit returned **PASS — planning approved for operator decision** (2026-08-13, `dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-planning-response.md`).

## Implementation

Implemented 2026-08-13 under operator automation level 3 after Nova planning PASS.

- **P1 — State plumbing:** `cli/src/teacher/runtime.ts` (`events: [...events]` snapshot copy), `cli/src/state/chat-store/{types,initial-state,sidebar-actions}.ts` (`teacherState`/`setTeacherState`/`clearTeacher` + reset wiring), `cli/src/commands/learn.ts` (`setTeacherState` in the lifecycle `onEvent` and after start/critique/cancel; `clearTeacher` on exit).
- **P2 — Sidebar mount + rendering:** `cli/src/teacher/render.ts` (shared `completionLabel`/`receiptLine`/`progressionLine`, consumed by `learn-result.ts`), `learn-overlay.tsx` (extended `LearnOverlayProps` with `receipt`/`persisted`/`competencyState`; terminal-only receipt + progression rows), `right-sidebar.tsx` (passive `teacherState` selector + conditional `Teacher` section below `Session`, above `PerfectionLoop`).
- **P3 — Zero-authority:** `eslint.config.js` (`no-restricted-imports` for `savant-ui/teacher/*.tsx` + `right-sidebar.tsx`, excluding the runtime bridge), static scans asserting no tool/write/terminal/dynamic-import path and no private-pack field names in the UI surface.
- **Call-graph:** `right-sidebar.tsx` renders `LearnOverlay` (production mount); `learn.ts` calls `useChatStore.getState().setTeacherState` at every mutation point and `clearTeacher` on exit.

Nova implementation audit returned PASS on 2026-08-13; the operator approved closure on 2026-08-13. This FID is now closed and archived.

**Nova implementation audit (2026-08-13):** returned **PASS — implementation independently verified; eligible for operator closure** (`dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-implementation-response.md`). All six hard questions verified at source: Q1 snapshot copy (`runtime.ts:106` `events: [...events]`, memo on `[challenge, events]` at `learn-overlay.tsx:63-65`); Q2 receipt branch (`learn-overlay.tsx:58-59`, `receipt !== null`, renders `receipt.role`/`receipt.over`); Q3 zero-authority scope (`eslint.config.js:61,65-66`, runtime bridge excluded); Q4 private-pack boundary (field names reach only test assertions); Q5 call-graph (`right-sidebar.tsx:232-239` mounts `LearnOverlay`; `learn.ts:115,121,175,227` call `setTeacherState`, `:236` `clearTeacher`); Q6 no ECHO law weakened. Independent re-run: 28/28 real teacher/state tests green; fid-ledger 5/5. **No blocking findings.**

**Refutation of Nova residual note #1 (phantom `learn.test.ts`):** Nova flagged the implementation-request citation of `learn.test.ts` ("5 files, 38 pass") as a phantom file. That finding is itself in error: `cli/src/commands/__tests__/learn.test.ts` exists (10 passing `/learn` command-layer tests) and was simply outside Nova's re-run glob. The full focused run `bun test cli/src/teacher cli/src/components/savant-ui/teacher cli/src/state/__tests__/chat-store-teacher.test.ts cli/src/commands/__tests__/learn.test.ts` is **38 pass / 0 fail across 5 files**, confirming the original citation. Residual note #2 (render-helper extraction) is satisfied: `cli/src/teacher/render.ts` holds `completionLabel`/`receiptLine`/`progressionLine`, consumed by both `learn-result.ts` and `learn-overlay.tsx`.

## Resolution

- **Planning review:** Nova returned **PASS — planning approved for operator decision** on 2026-08-13 (`dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-planning-response.md`), verifying all six ground-truth claims at source and the ledger 5/5. Non-blocking notes: (1) the superseded build order's receipt-field imprecision is corrected by this FID; (2) the `learn-result.ts` helper line numbers are verified (`completionLabel:16`, `receiptLine:29`, `progressionLine:35`). Implementation remains gated on operator approval; a separate implementation-audit request is required before closure.
- **Implementation review:** Nova returned **PASS — implementation independently verified; eligible for operator closure** on 2026-08-13 (`dev/nova/inbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-implementation-response.md`). All six hard questions verified at source; independent re-run 28/28 teacher/state tests green; fid-ledger 5/5; no blocking findings. Nova residual note #1 ("phantom `learn.test.ts`") is refuted — the file exists at `cli/src/commands/__tests__/learn.test.ts` (10/10 pass); the full focused count is 38 pass / 0 fail across 5 files.
- **Closed Date:** 2026-08-13
- **Fix Description:** Implemented under operator automation level 3 (2026-08-13): added the `teacher` store slice mirroring the `provenanceEvents` pattern; snapshot-copied `events` in `getTeacherSessionState()`; wired `/learn` to `setTeacherState`/`clearTeacher`; mounted a read-only `Teacher` sidebar section rendering `LearnOverlay` with receipt + progression rows; extracted shared render helpers into `cli/src/teacher/render.ts`; added a zero-authority ESLint restriction + static scans.
- **Tests Added:** Yes — snapshot-copy regression, shared render helper suite, store slice set/clear/reset, private-pack zero-authority scan (38 focused CLI tests across 5 files).
- **Verification Evidence:** typecheck ×4 PASS; ESLint zero warnings; Prettier clean; `lint:md` clean; `bun run validate:repository` PASS; fid-ledger 5/5; call-graph: `right-sidebar.tsx` mounts `LearnOverlay`, `learn.ts` calls `setTeacherState` at every mutation point.
- **Archived:** 2026-08-13

## Lessons Learned

A line-accurate ground-truth table does not make a build order correct — field-location claims (`receiptStatus` vs `receipt`) and reference-identity subtleties (in-place mutation vs memoized reducers) must be re-verified against the actual types and the memo dependency arrays, not just the cited line numbers. A "passive store consumer" is only passive if the snapshot it receives is a copy; otherwise it is a live alias that silently defeats memoization.
