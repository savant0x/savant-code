<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0813-022 (Teacher Live Sidebar Surface)

**Date:** 2026-08-13
**Scope:** Read-only live sidebar surface for the implemented Agent-Steering Teacher (extends FIDs 011–020, closed/archived)
**Status:** REQUESTED
**Priority:** Medium — planning convergence complete; implementation remains blocked pending Nova planning review and operator decision

## Request

Please independently audit the converged planning FID below. Return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request only**. A PASS does not authorize implementation, closure, archive movement, release, commit, push, publication, or deployment. Operator approval is a separate decision. After approved implementation/evidence work, a separate Nova implementation-audit request is required before the FID is marked closed and archived.

## Records under review

| Record | Role | Current status | Narrowed remaining boundary |
|---|---|---|---|
| `dev/fids/FID-2026-0813-022-teacher-sidebar-surface.md` | Standalone planning FID | `analyzed` | Store slice + `setTeacherState` wiring, sidebar mount + receipt/progression rendering, zero-authority ESLint + static scan, snapshot-copy fix |
| `dev/build-orders/2026-08-13-teacher-sidebar-surface-build-order.md` | Superseded planning source | SUPERSEDED | Its errors are corrected by FID-022 (correction list in the build-order header) |

The implemented teacher runtime (FIDs 011–020) and ZTAP are closed/archived and are **context**, not re-opened scope. This FID is a passive consumer of that runtime.

## What Nova must verify

### Ground-truth accuracy of the FID's corrections

1. **Receipt field.** The FID asserts the panel reads `teacherState.receipt: TeacherAttemptReceipt | null` (`cli/src/teacher/runtime.ts:93`), and that `receiptStatus` is a `ProgressionRecord` field (`common/src/teacher/progression.ts:29`), not session state. Verify the type definitions match this claim.
2. **Event snapshot copy.** The FID asserts `getTeacherSessionState()` returns `events` by reference (`runtime.ts:103`) while `LearnOverlay` memoizes `reduceLearnState` on `[challenge, events]` (`learn-overlay.tsx:63-65`), so the `events: [...events]` fix is load-bearing. Confirm the reference-identity analysis is correct.
3. **FID numbering.** Confirm `FID-2026-0813-021` is already `canonical-version-bump-tool` (archive) and `022` is the next free id.
4. **Dangling reference.** Confirm `docs/design/Agent-Steering Teacher — Live Sidebar Surface.md` does not exist and the FID is self-contained.
5. **Content/mount mismatch.** Confirm `LearnOverlay` currently renders only objective/prompt/guidance/phase/events/completion and does not render receipt or progression, so extending `LearnOverlayProps` (and extracting `learn-result.ts:16/29/35` helpers) is required to satisfy the build order's content list.
6. **Zero-authority ESLint scope.** Confirm the rule is scoped to the UI (`right-sidebar.tsx` + `savant-ui/teacher/**`) and correctly excludes `cli/src/teacher/runtime.ts` (which imports `node:fs`/`node:crypto`/`node:path`).

### Design decisions

1. Single source of truth = runtime singleton; sidebar is a passive store consumer (mirrors `provenanceEvents`/`TrustMatrix`).
2. No `useTeacher()` hook — a plain `useChatStore((s) => s.teacherState)` selector suffices (Law 7/YAGNI).
3. Mount trigger `teacherState?.challenge != null`; position below `Session`, above `PerfectionLoop`; default-expanded; non-interactive (`focusable={false}`, `selectable={false}`).
4. Lifecycle: `cancel` → `setTeacherState(cancelled)` (panel stays, `CANCELLED`); `exit` → `clearTeacher()` + `resetTeacherSession()` (panel unmounts); no stale render.
5. Private-pack boundary: the panel renders only public challenge fields + public attempt events, never known-good source, hidden tests, mutation contracts, or raw critique.
6. No telemetry; no ECHO law changed; no new control/write/spawn authority.

## Evidence and adversarial checks

For every PASS or FAIL, cite the exact record and current source/evidence path. Specifically challenge:

- whether the `receipt` field (not `receiptStatus`) is the correct session-state field;
- whether the in-place `events` mutation actually freezes `LearnOverlay`'s `useMemo`;
- whether the zero-authority ESLint rule would silently cover the runtime bridge and break it;
- whether any private-pack field could reach the component props through the planned wiring;
- whether the e2e lifecycle test covers every `setTeacherState` mutation point (start/forge/sandbox/adjudication/critique/cancel/exit);
- whether `validateActiveFidLedger` passes with the FID present (status `analyzed`, no attribution, required headings present, no dependency on untracked archive FIDs).

## Operator and implementation boundaries

- No production implementation has been authorized by this request.
- No release, commit, push, publication, deployment, or archive move is authorized.
- Operator approval must explicitly name the approved scope after Nova responds.
- A later implementation sign-off request must quote focused test output, call-graph evidence (sidebar mounting `LearnOverlay`, `/learn` calling `setTeacherState`), and the zero-authority scan output before closure.

## Expected response

Please return:

1. Overall verdict.
2. Verdict per record (FID-022; build order as superseded).
3. Any missing citation, scope contradiction, type/field error, or unverified claim.
4. Exact conditions required for implementation approval, if any.
5. Explicit confirmation that this is planning review only and does not authorize production changes or release activity.
