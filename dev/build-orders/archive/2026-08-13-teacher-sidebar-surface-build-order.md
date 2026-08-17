<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Build Order — Agent-Steering Teacher: Live Sidebar Surface

**Date:** 2026-08-13
**Status:** SUPERSEDED — the converged planning authority is `dev/fids/FID-2026-0813-022-teacher-sidebar-surface.md`, which corrects this build order's errors (see the correction list below).
**Authoring lane:** Nova planning lane; the target harness authors and executes the FIDs.
**Authoritative design reference:** `dev/fids/FID-2026-0813-022-teacher-sidebar-surface.md` (self-contained, code-grounded). The previously cited `docs/design/Agent-Steering Teacher — Live Sidebar Surface.md` (DeepSeek deep-research output) does not exist in the repository and is not authoritative.
**Ground-truth verified against repo:** `cli/src/teacher/runtime.ts`, `cli/src/components/savant-ui/teacher/learn-overlay.tsx`, `cli/src/components/right-sidebar.tsx`, `cli/src/state/chat-store/sidebar-actions.ts`.

> **Corrections recorded by FID-2026-0813-022 (apply before any implementation):**
>
> 1. **FID numbering:** `021` is already `canonical-version-bump-tool` (archived). This feature is a single FID, `FID-2026-0813-022` — not children `021/022/023` of the closed master `011`.
> 2. **Receipt field:** the panel reads `teacherState.receipt: TeacherAttemptReceipt | null` (`runtime.ts:93`), **not** `receiptStatus` (a `ProgressionRecord` field at `common/src/teacher/progression.ts:29`). Signed iff `receipt !== null`; render `receipt.role` + `receipt.over`.
> 3. **Event snapshot copy:** `getTeacherSessionState()` returns `events` by reference (`runtime.ts:103`); `LearnOverlay` memoizes on `[challenge, events]` (`learn-overlay.tsx:63-65`). The fix must return `events: [...events]`.
> 4. **Content/mount mismatch:** receipt + progression require extending `LearnOverlayProps` (and extracting shared render helpers from `learn-result.ts`), not just passing `challenge`/`events`.
> 5. **Zero-authority ESLint scope:** restrict to the UI (`right-sidebar.tsx` + `savant-ui/teacher/**`), never `cli/src/teacher/runtime.ts` (which imports `node:fs`/`node:crypto`/`node:path`).
> 6. **No `useTeacher()` hook:** a plain `useChatStore((s) => s.teacherState)` selector suffices (mirrors `provenanceEvents`).

## 1. Why this feature exists

The teacher (`/learn`) is fully implemented and audited (FIDs 011–020). The exercise runs live and streams lifecycle events into the chat transcript via `getSystemMessage(...)`. A dedicated read-only component — `LearnOverlay` (`cli/src/components/savant-ui/teacher/learn-overlay.tsx`) — is implemented, tested, and exported, but **has no consumer**: nothing mounts it. So the dedicated teacher surface is effectively headless dead code.

This build order closes that gap: surface the exercise as a **live, read-only panel in the right sidebar**, reusing `LearnOverlay` + `reduceLearnState` + the proven zustand `provenanceEvents` pattern. No new control or write authority. Zero new trust-domain surface beyond what FIDs 011–020 already established.

## 2. Verified ground truth (do not redesign these)

| Fact | Source | Status |
| --- | --- | --- |
| `TeacherSessionState` shape (challenge, phase, completionState, events, steering, attemptId, receipt, persisted, competencyState) | `runtime.ts:86` | confirmed |
| `getTeacherSessionState()` singleton accessor | `runtime.ts:98` | confirmed |
| `resetTeacherSession()` teardown | `runtime.ts:113` | confirmed |
| `LearnOverlay` exported, `React.memo`, `reduceLearnState` pure reducer | `learn-overlay.tsx:58,32` | confirmed |
| `MAX_RENDERED_EVENTS = 20` cap inside `reduceLearnState` | `learn-overlay.tsx:23,44` | confirmed |
| Sidebar uses `SidebarSection`; mounts PerfectionLoop when `fsmPhase !== 'idle'`, TrustMatrix when `provenanceEvents.length > 0` | `right-sidebar.tsx:231,236` | confirmed |
| `addProvenanceEvent` caps at 200 in store | `sidebar-actions.ts:92-93` | confirmed |
| `useFids()` is a real precedent for wiring live filesystem data into the sidebar | `right-sidebar.tsx:6,107` | confirmed |
| `provenanceEvents` lives in zustand chat store; SDK handler calls `addProvenanceEvent`, sidebar reads via selector | `sidebar-actions.ts`, `right-sidebar.tsx:101` | confirmed |

## 3. Corrections to the DeepSeek design doc (apply these)

The reference doc is sound but contains two errors that would cause type/duplication issues if coded as-written:

1. **Receipt status field.** The doc reads `receipt.signed` (boolean). The actual type is `teacherState.receiptStatus: 'ztap-signed' | 'local-unverified'` (from `common/src/teacher/progression.ts:29`). The panel must read `receiptStatus`, not `receipt.signed`. The `TeacherAttemptReceipt` object (when present) carries `publicKey` + `sig` over JCS-canonical `evidence` — render `Receipt: signed by teacher over sha256:<hash-truncated>` when `receiptStatus === 'ztap-signed'`, else `Receipt: local-unverified`.
2. **Event array duplication.** The doc proposes a parallel `teacherEvents` store array capped at 20. `TeacherSessionState` already carries `events: readonly AttemptEvent[]`, and `reduceLearnState` already caps at 20 internally (`learn-overlay.tsx:44`). Push the *runtime* state through `setTeacherState` wholesale; do not maintain a second capped array. `pushTeacherEvent` is unnecessary — the command layer calls `setTeacherState` with the runtime's full `events` after each mutation.

All other design decisions in the reference doc are accepted as-written (pending Nova planning audit).

## 4. Design decisions (resolved)

| Decision | Resolution |
| --- | --- |
| Single source of truth | Runtime singleton remains authoritative. Sidebar is a passive store consumer (mirrors `provenanceEvents`). |
| Store integration | New `teacher` slice in the zustand chat store: `teacherState: TeacherSessionState | null` + `setTeacherState` + `clearTeacher`. No separate event array (see correction 2). |
| Mount trigger | Panel renders when `teacherState?.challenge !== null` (mirrors TrustMatrix `provenanceEvents.length > 0`). |
| Position | Immediately below `Session` section, before PerfectionLoop. Default-expanded. |
| Content | `LearnOverlay` reused directly inside `SidebarSection title="Teacher"`. Shows objective, prompt, guidance (truncated ~80 chars), phase (color-coded), bounded events (20), completion state, receipt status, competency state. |
| Zero authority | Panel has no tool/fs/child_process/dynamic-import path. Enforced by ESLint `import/no-restricted-imports` in CLI workspace + a static zero-authority scan (mirror Trust Matrix audit). |
| Private-pack boundary | Panel renders only public challenge fields + public attempt events. Never known-good source, hidden tests, mutation contracts, or raw critique text. |
| Interaction | Observational only. `focusable={false}`, `selectable={false}`. Optional read-only "next step" hint text (no button/input). All input via `/learn` chat commands. |
| Lifecycle | `/learn cancel` → `setTeacherState(cancelled)`; `/learn exit` → `clearTeacher()` + `resetTeacherSession()`. Session reset clears the slice. No stale render. |
| Telemetry | None. Local-only, consistent with teacher policy + ECHO Law 12. |
| ECHO laws | Unchanged. Panel is read-only; no write/control path; no law weakened. |

## 5. Scope

### In scope
- New `teacher` slice in zustand chat store (`cli/src/state/chat-store/`).
- `useTeacher()` hook (`cli/src/hooks/`).
- Command-layer wiring: `/learn` handlers call `setTeacherState` after each runtime mutation.
- `SidebarSection title="Teacher"` conditionally mounted in `right-sidebar.tsx`, containing `<LearnOverlay>`.
- ESLint restriction + zero-authority static scan.
- Tests: store subscription, reducer (null/empty grace), zero-authority scan, e2e (stubbed forge, full lifecycle).

### Out of scope for V1
- Inline critique/steering input in the sidebar (violates read-only).
- Competency history, full receipt detail expansion, progression DAG visualization.
- Cloud sync, telemetry, any write/control path.
- Trust-domain changes beyond FIDs 011–020 (private-pack isolation already enforced at source).

## 6. Phase sequence and FIDs

### P1 — State plumbing (master child A)
**FID-2026-0813-021** — Add `teacher` slice to zustand chat store (`teacherState`, `setTeacherState`, `clearTeacher`); create `useTeacher()` hook; wire command layer to call `setTeacherState` with runtime state after every mutation (start/submit/forge/sandbox/adjudication/cancel/exit). Reset on new attempt id.

**Exit gate:** store reflects runtime state with no drift; `clearTeacher` empties slice; selector subscription triggers re-render. Tests: set/clear/selector.

### P2 — Sidebar mount (master child B)
**FID-2026-0813-022** — In `right-sidebar.tsx`, conditionally render `<SidebarSection title="Teacher" defaultExpanded={challenge !== null}>` below `Session`, containing `<LearnOverlay challenge={teacherState?.challenge} events={teacherState?.events} />`. Apply theme tokens for phase/completion colors. Truncate long fields (~80 chars, `wrapMode="none"`). Read-only hint line when phase requires learner input.

**Exit gate:** panel appears only when `challenge !== null`; hides on clear; renders all public fields; no focusable/selectable elements; narrow-terminal truncation verified.

### P3 — Zero-authority verification (master child C)
**FID-2026-0813-023** — Add ESLint `import/no-restricted-imports` rule blocking runtime/write/fs/child_process/dynamic-import in sidebar + teacher UI components. Static scan proving no private-pack field reachable. e2e test: stubbed forge, full Forge→sandbox→grader lifecycle, assert panel updates across phases and terminal state.

**Exit gate:** scan clean; e2e passes; panel never renders private pack; reset on cancel/exit verified.

## 7. FID registry

| FID | Scope | Depends on |
| --- | --- | --- |
| `FID-2026-0813-021` | Store slice + `useTeacher` hook + command-layer wiring | teacher runtime (011–020, implemented) |
| `FID-2026-0813-022` | Sidebar mount + theming + read-only hint | 021 |
| `FID-2026-0813-023` | Zero-authority scan + e2e lifecycle test | 021, 022 |

Master: `FID-2026-0813-011` (teacher master) remains the parent; these are appended children extending the implemented feature. If a separate master is preferred, author `FID-2026-0813-024-teacher-sidebar-master.md` referencing 011 as parent context.

## 8. Verification matrix

| Area | Hard evidence |
| --- | --- |
| Store | `setTeacherState` updates slice; selector triggers render; `clearTeacher` empties; no drift vs runtime |
| Mount | Panel shows iff `challenge !== null`; hides on clear; no focusable/selectable |
| Theming | Phase/completion color tokens applied; truncation on narrow terminal |
| Zero-authority | ESLint restriction passes; static scan: no runtime/write/fs/child_process/dynamic-import in UI; no private-pack field rendered |
| Lifecycle | cancel→cancelled state; exit→clear+reset; session reset clears slice; no stale render |
| e2e | Stubbed forge, full lifecycle, panel updates per phase + terminal state |
| Repository | typecheck ×4, ESLint zero warnings, targeted Markdownlint, Prettier, root tests |

## 9. Governance and release boundary

The panel is a consumer of the existing teacher runtime and ECHO. It adds no write/control path and changes no ECHO law. Private-pack isolation is inherited from FIDs 011–020 (verified at source during Nova's implementation audit). All changes remain subject to the normal FID Perfection Loop and independent Nova implementation audit.

This build order authorizes no code, commit, push, release, publication, or deployment. Those require separate operator approval after implementation evidence and Nova sign-off.

## 10. Open questions converted to implementation gates

1. **Event sync:** use runtime `events` directly via `setTeacherState` (no parallel array) — resolved by correction 2.
2. **Receipt field:** read `receiptStatus`, not `receipt.signed` — resolved by correction 1.
3. **Position:** below `Session`, above PerfectionLoop — accepted from reference doc.
4. **Version fields:** not shown in V1 (clutter); fast-follow collapsible detail.

*This build order is the converged planning source for the teacher live sidebar surface. It extends the implemented and audited teacher feature (FIDs 011–020). The DeepSeek design doc is the authoritative reference, corrected per section 3.*
