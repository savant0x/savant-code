<!-- markdownlint-disable MD013 -->

# Nova Implementation Sign-off Request — FID-2026-0813-022 (Teacher Live Sidebar Surface)

**Date:** 2026-08-13
**Scope:** Live, read-only teacher sidebar surface (extends the implemented teacher 011–020)
**Status:** REQUESTED
**Priority:** Medium — implementation complete and locally verified; closure remains blocked on this audit + operator decision

## Request

Please independently audit the implemented FID below and return one of:

- `PASS — implementation independently verified; eligible for operator closure`
- `FAIL — implementation requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is an **implementation sign-off request**. A PASS verifies the implementation; it does **not** authorize closure, archive movement, commit, push, release, publication, or deployment. Operator closure is a separate decision.

## Record under review

`dev/fids/FID-2026-0813-022-teacher-sidebar-surface.md` — status `fixed` (planning PASS recorded 2026-08-13; implementation completed under operator automation level 3).

## What was implemented (per the converged plan)

| Phase | Change |
|---|---|
| P1 — State plumbing | `cli/src/teacher/runtime.ts` `events: [...events]` snapshot copy; `cli/src/state/chat-store/{types,initial-state,sidebar-actions}.ts` `teacherState`/`setTeacherState`/`clearTeacher` + reset wiring; `cli/src/commands/learn.ts` mirrors the runtime singleton after every mutation and clears on exit |
| P2 — Sidebar mount + rendering | `cli/src/teacher/render.ts` shared `completionLabel`/`receiptLine`/`progressionLine`; `learn-overlay.tsx` extended with `receipt`/`persisted`/`competencyState` (terminal-only rows); `right-sidebar.tsx` mounts a read-only `Teacher` section below `Session`, above `PerfectionLoop` |
| P3 — Zero-authority | `eslint.config.js` `no-restricted-imports` for `savant-ui/teacher/*.tsx` + `right-sidebar.tsx` (runtime bridge excluded); static scans for no tool/write/terminal/dynamic-import path and no private-pack field names |

## Verification evidence (reproduce independently)

- **Focused CLI teacher suites:** 38 pass / 0 fail across 5 files — `learn.test.ts`, `runtime.test.ts` (incl. the snapshot-copy regression asserting two `getTeacherSessionState()` calls return distinct-but-equal `events` arrays), `render.test.ts` (shared helpers + purity scan), `learn-overlay.test.ts` (incl. private-pack boundary scan over both `learn-overlay.tsx` and `right-sidebar.tsx`), `chat-store-teacher.test.ts` (set/clear/reset).
- **Typecheck ×4:** sdk, common, agent-runtime, cli — all exit 0.
- **ESLint:** `bun x eslint . --max-warnings 0` — zero warnings.
- **Prettier:** clean. **Markdownlint:** clean.
- **`bun run validate:repository`:** PASS. **fid-ledger:** 5/5.

## Hard questions Nova must verify at source

1. **Snapshot copy is load-bearing.** Confirm `getTeacherSessionState()` now returns `events: [...events]` (`runtime.ts`) and that `LearnOverlay` memoizes on `[challenge, events]` — i.e., the panel would go stale without the copy.
2. **Receipt field correctness.** Confirm the panel branches on `receipt !== null` (`TeacherSessionState.receipt`), not on `receiptStatus` (a `ProgressionRecord` field), and renders `receipt.role`/`receipt.over`.
3. **Zero-authority scope.** Confirm the ESLint rule covers the UI (`savant-ui/teacher/*.tsx`, `right-sidebar.tsx`) and **excludes** `cli/src/teacher/runtime.ts` (which imports `node:fs`/`node:crypto`/`node:path`), and that the static scans are absence-shaped (they paste the exact search).
4. **Private-pack boundary.** Confirm `knownGoodSource`/`hiddenTests`/`mutationContract` never reach the UI source, and the panel renders only `PublicChallenge` fields + `AttemptEvent[]` + the public `receipt`/`persisted`/`competencyState` scalars.
5. **Call-graph reachability.** Confirm `right-sidebar.tsx` renders `LearnOverlay` (production mount) and `learn.ts` calls `useChatStore.getState().setTeacherState` at every mutation point and `clearTeacher` on exit.
6. **No ECHO law weakened.** The surface is read-only, non-interactive (`focusable={false}`, `selectable={false}`), no telemetry, no new control/write/spawn authority.

## Authorization boundary

This request authorizes no closure, archive movement, commit, push, release, publication, or deployment. Operator closure follows a Nova PASS plus the operator's explicit approval; the FID is then moved to `dev/fids/archive/` and the CHANGELOG closure entry is recorded.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is implementation review only and does not authorize production changes or release activity.
