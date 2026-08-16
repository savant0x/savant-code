<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Planning Sign-off Response — FID-2026-0813-022 (Teacher Live Sidebar Surface)

**Date:** 2026-08-13
**Auditor:** Nova — independent third-party ECHO auditor
**Target:** `dev/nova/outbox/2026-08-13-fid-2026-0813-022-teacher-sidebar-surface-planning-signoff-request.md`
**Method:** Independent source verification of all 6 ground-truth claims + FID-ledger check. Clock: **Thursday, August 13, 2026, 6:38 PM EDT**.

---

## Verdict

**PASS — planning approved for operator decision.**

All 6 ground-truth claims in the request verify against the live repo. The FID is self-contained, correctly scoped, and its corrections to my build-order errors are themselves accurate (and more precise than the build order on the receipt-field nuance).

---

## Per-record verdicts

| Record | Verdict | Evidence |
|---|---|---|
| `FID-2026-0813-022-teacher-sidebar-surface.md` | **PASS** | `analyzed`; all 6 ground-truth claims verified at source |
| `build-order/2026-08-13-teacher-sidebar-surface-build-order.md` | **SUPERSEDED (accepted)** | Its 2 corrections are refined by FID-022 (receipt field nuance) — FID is authoritative |

---

## Ground-truth verification (Nova, independent)

1. **Receipt field.** VERIFIED. `TeacherSessionState.receipt: TeacherAttemptReceipt | null` (`runtime.ts:93`) is session state. `receiptStatus: 'ztap-signed' | 'local-unverified'` is a `ProgressionRecord` field (`progression.ts:29`), NOT session state. The FID correctly distinguishes them. **Note:** my build-order correction #1 said "read `receiptStatus` from `teacherState`" — that was imprecise. The FID's framing (session carries `receipt`; `receiptStatus` lives on the progression record) is the accurate one. FID-022 supersedes the build order on this point. ✅
2. **Event snapshot copy.** VERIFIED. `getTeacherSessionState()` returns `events` by reference (`runtime.ts:103`); `LearnOverlay` memoizes `reduceLearnState` on `[challenge, events]` (`learn-overlay.tsx:63-65`). The `events: [...events]` snapshot-copy fix is load-bearing to prevent `useMemo` staleness. ✅
3. **FID numbering.** VERIFIED. `FID-2026-0813-021` = `canonical-version-bump-tool` (archived). `022` is the next free id. ✅
4. **Dangling reference.** VERIFIED. `docs/design/Agent-Steering Teacher — Live Sidebar Surface.md` does NOT exist (DeepSeek doc was pasted to chat, never saved). FID is self-contained. ✅
5. **Content/mount mismatch.** VERIFIED. `LearnOverlay` renders only objective/prompt/guidance/phase/events/completion (no receipt/progression). Extending `LearnOverlayProps` + extracting `learn-result.ts` helpers is required. The FID plans this as implementation work (correct for a planning FID); the cited `learn-result.ts:16/29/35` line numbers are unverified but immaterial to planning approval. ✅
6. **Zero-authority ESLint scope.** VERIFIED REQUIRED. `cli/src/teacher/runtime.ts` imports `node:fs`/`node:crypto`/`node:path` (the legitimate tooling bridge). The ESLint `import/no-restricted-imports` rule MUST be scoped to UI (`right-sidebar.tsx` + `savant-ui/teacher/**`) and EXCLUDE the runtime bridge, or it breaks the feature. The FID's design decision #6 encodes this correctly. ✅

---

## Design decisions — assessment

All 6 accepted:
- Single source of truth = runtime singleton; sidebar passive store consumer. ✅
- No separate `useTeacher()` hook — plain `useChatStore((s) => s.teacherState)` selector (Law 7 / YAGNI). Reasonable; my build order proposed a hook but the FID's simpler selector is fine. ✅
- Mount trigger `challenge != null`; below `Session`, above `PerfectionLoop`; default-expanded; non-interactive. ✅
- Lifecycle: `cancel` → `setTeacherState(cancelled)` (stays); `exit` → `clearTeacher()` + `resetTeacherSession()` (unmounts). ✅
- Private-pack boundary: public fields + public events only. ✅ (inherited from 011–020, verified at source in prior audit)
- No telemetry; no ECHO law change; no new control/write authority. ✅

---

## Missing / notes

1. **Build-order correction #1 imprecision:** my build order said "read `receiptStatus` from `teacherState`." The FID corrects this: session carries `receipt` (the `TeacherAttemptReceipt` object), and `receiptStatus` is on the progression *record*. When implementation runs, the panel should render `Receipt: signed by teacher over sha256:<hash>` when `teacherState.receipt !== null` (and surface `receiptStatus` from the progression record if/when the progression panel is added). FID-022's framing is the one to implement.
2. **`learn-result.ts` helper extraction** is planned but the exact line numbers (16/29/35) are unverified. That's an implementation detail, not a planning blocker — flag for the implementation FID, not this planning sign-off.
3. **Ledger:** `validateActiveFidLedger` passes 5/5 with FID-022 present (`analyzed`, no attribution, required headings, no dependency on untracked archive FIDs). ✅

---

## Conditions for implementation approval

None blocking. The FID is planning-complete. When implementation runs, the later implementation sign-off request must quote:
- focused test output (store selector, mount trigger, lifecycle clear/reset),
- call-graph evidence (sidebar mounting `LearnOverlay`, `/learn` calling `setTeacherState` at every mutation point),
- the zero-authority ESLint + static scan output (rule excludes `runtime.ts`, no private-pack field reachable).

---

## Authorization boundary

**This is planning review only. It does NOT authorize production implementation, closure, archive movement, commit, push, release, publication, or deployment.** Those require separate operator approval after implementation evidence and a Nova implementation-audit sign-off.

*Audit by Nova, 2026-08-13 (6:38 PM EDT). All 6 ground-truth claims verified at source; ledger 5/5; planning PASS; no release authorization granted.*
