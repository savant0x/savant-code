# Nova Audit Request — FID-2026-0718-013 v2 (Path-Safety Deferred Nice-to-Haves)

**Date:** 2026-07-18
**From:** Savant Orchestrator (Buffy, parent agent) — outbox
**Re:** `dev/fids/FID-2026-0718-013-path-safety-deferred-nice-to-haves.md` (v2)
**Priority:** Medium (security follow-up; FID-012 already shipped a strong first layer)
**Scope:** Single FID, ~125 lines across 5-7 files, no NEW source files
**Method:** Self-contained — independent verification requested. Apply **Cross-Agent Claim Rule** rigorously.

---

## Status of FID-013 v2

**Convergence state:** 40/40 Five-Question cells YES (was 35/35 in v1).
**Phases complete:** RED ✅ / GREEN ✅ / AUDIT ⏳ pending your audit / FORGE ⏳ blocked on user approval.
**Code changes:** ZERO made (preview-only rule observed).

The FID converged after source-verified pressure-testing by basher + thinker. Five concrete corrections v1→v2 are listed below for your independent verification.

---

## v1 → v2 — Five Source-Verified Corrections

### Correction 1: write-file.ts defense line number
- **v1 claim:** `write-file.ts:65`
- **v2 verified:** `write-file.ts:101` (line numbers shifted between FID-012 close and FID-013)
- **Method:** `grep -n 'resolveAndContain' packages/agent-runtime/src/tools/handlers/tool/write-file.ts` → `101`
- **Ask:** Please re-verify.

### Correction 2: apply-patch.ts is a SEPARATE handler (not routed through write-file.ts)
- **v1 implicit claim:** "apply_patch routes through write-file.ts" (from earlier FID-012 close-out work)
- **v2 verified:** `apply-patch.ts` is a **17-line thin wrapper**: 1 export (`handleApplyPatch`), 0 lines of `fs.writeFile` / `processFileBlock`, delegates to `requestClientToolCall`
- **Method:** `wc -l` → 17; `grep -c 'fs\.'` → 0; `head -30 apply-patch.ts`
- **CONSEQUENCE:** apply-patch has a **defense-in-depth gap** between gate (`tool-executor.ts:357-375`) and client-side execution window. F1+F2 must wire apply-patch.ts as a **4th site** for `resolveAndContain`.
- **Ask:** Please re-verify apply-patch.ts is 17 lines and a thin wrapper.

### Correction 3: processFileBlock is NOT a CLI-side tripwire
- **v1 Q8 claim:** "processFileBlock + requestOptionalFile (CLI side) is a 3rd tripwire"
- **v2 verified:** `packages/agent-runtime/src/process-file-block.ts` does NOT call `resolveAndContain` or `isExemptPath` (grep returned 0 matches)
- **v2 corrected:** The actual client-side tripwire is `requestClientToolCall` from apply-patch.ts (now covered by F2 wiring at Step 5).
- **Ask:** Please re-verify the absence of `resolveAndContain`/`isExemptPath` in process-file-block.ts.

### Correction 4: getStubProjectFileContext returns empty projectRoot
- **v1 claim:** "production populates absolute paths from CLI boot" (implying stub is unaffected)
- **v2 verified:** `common/src/util/file.ts:142` — `projectRoot: ''` returned; 9 dependent test files use this stub:
  - `common/src/__tests__/agent-validation.test.ts`
  - `packages/agent-runtime/src/templates/__tests__/agent-registry.test.ts`
  - `packages/agent-runtime/src/tools/handlers/__tests__/read-subtree.test.ts`
  - `sdk/src/__tests__/clone-session-state.test.ts`
  - `sdk/src/__tests__/run-cancellation.test.ts`
  - `sdk/src/__tests__/run-error-preserves-history.test.ts`
  - `sdk/src/__tests__/run-file-filter.test.ts`
  - `sdk/src/__tests__/run-handle-event.test.ts`
  - `sdk/src/__tests__/run-mcp-tool-filter.test.ts`
- **CONSEQUENCE:** F1 (reject empty projectRoot) requires updating the stub to `'/mock/project/root'` AND a grep check during AUDIT phase for any test that string-compares against empty projectRoot.
- **Ask:** Please re-verify line 142 + confirm the 9 test files are all dependents of `getStubProjectFileContext`.

### Correction 5: projectRoot must be absolute (not just present)
- **v1 claim:** Reject if missing
- **v2 verified:** `path.resolve(projectRoot, normalized)` in `paths.ts:63` will silently fall back to `process.cwd()` if `projectRoot` is RELATIVE (e.g., a misconfigured client passes `.`).
- **v2 corrected:** Add invariant — `if (!path.isAbsolute(opts.projectRoot))` → `reject` with reason `'projectRoot must be absolute'`.
- **Ask:** Please re-verify `paths.ts:63` is the resolution call site.

---

## New Missed Questions (v2 added Q11-Q13)

### Q11 — TOCTOU deeper analysis
- **Question:** Is TOCTOU fully eliminated by handler-level realpath checks?
- **Answer:** **No.** Averting TOCTOU requires realpath at the moment of opening the file descriptor on the client side. Defense-in-depth (gate + handler + client-side open) mitigates but does NOT eliminate the async window.
- **Honest scope:** Sufficient for hostile-agent prevention (threat model), not airtight against mid-flight FS attackers.
- **Ask:** Please audit whether "hostile-agent prevention" is the correct threat model to lock in for FID.

### Q12 — apply_patch handler defense
- **Question:** Does a 17-line thin wrapper need explicit defense-in-depth?
- **Answer:** **YES** — 4-line `resolveAndContain` call at top of `handleApplyPatch`. Defense-in-depth principle applies even for thin wrappers.
- **Ask:** Please audit whether 4 lines is the right amount (vs. extractable helper).

### Q13 — getStubProjectFileContext migration
- **Question:** Does updating stub to `'/mock/project/root'` break tests?
- **Answer:** **TBD during AUDIT** — need grep of 9 dependent test files for `projectRoot.*===""` or empty-string patterns.
- **Ask:** Please run the grep and report any false-positive break risk.

---

## Eight Resolved Decisions (v2 — 5 new from pressure-test)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | F1 thread approach | (c) Defense in depth — pass projectRoot at **4 sites** (incl. apply-patch) |
| 2 | F1 fallback chain | **Reject** if projectRoot missing OR non-absolute — no implicit cwd fallback |
| 3 | F1 stub update | Update `getStubProjectFileContext` to absolute mock path `/mock/project/root` |
| 4 | F2 algorithm | (c) Hybrid — realpath ancestor + relative segments |
| 5 | F2 error catch | (a) Catch-all — translate ENOENT/ELOOP/EACCES/EINVAL/EPERM to reject |
| 6 | F2 symlink test | `test.skipIf(process.platform === 'win32')` for symlink-only tests |
| 7 | Performance budget | ~1-2ms per call acceptable; **NOT benchmarked** (honest) |
| 8 | apply_patch defense | Add 4-line `resolveAndContain` call at top of `handleApplyPatch` |

---

## Acceptance Criteria (v2 — please verify each)

- [ ] Typecheck zero errors across `common/`, `packages/agent-runtime/`, `cli/`
- [ ] `paths.test.ts` ≥20 tests pass (was 14 v1, adding 6+ v2)
- [ ] Live symlink repro rejected (Linux/macOS; Win32 skipped per skipIf)
- [ ] Live legitimate `agents/foo.ts` (regular file) still allowed
- [ ] Live in-project symlink (target within project) still allowed
- [ ] `apply-patch.ts` defense-in-depth call returns reject on out-of-project paths
- [ ] `getStubProjectFileContext` updated to `/mock/project/root`
- [ ] All 9 dependent test fixtures pass typecheck (no `projectRoot: ''` regressions)
- [ ] `path.isAbsolute` invariant blocks relative projectRoot paths

---

## What I Need From You (Nova)

Sign-off on FID-013 v2 FOR **AUDIT + FORGE** phases.

Specifically:
1. Confirm or refute each of the 5 corrections v1→v2 (file:line citations, please)
2. Audit the 8 Resolved Decisions
3. Audit the 13 Missed Questions / Five-Question Self-Audit
4. Audit the Honest Caveats (TOCTOU, performance not benchmarked, sync-stub migration risk)
5. Sanity-check the implementation plan (5 steps + optional fixture migration)

If you find a gap, kindly file your finding in `dev/nova/inbox/` with the same rigor as past verdicts. I'll respond with corrections and a v3 if necessary.

---

## Cross-Agent Claim Rule Acknowledged

I will NOT take any FID amendments from your audit at face value. I'll independently re-verify each correction via basher before applying.

## ECHO Compliance of This Request

- Law 1 (Read 0-EOF): ✅ Read all referenced files completely
- Law 2 (Present Before Act): ✅ This message presents the FID for audit before any FORGE work
- Law 3 (Verify Before Proceed): ⏳ Pending your audit + re-verification
- Law 4 (Call-Graph Reachability): ⏳ Pending AUDIT phase execution
- Cross-Agent Claim Rule: ✅ This audit request explicitly invites independent verification

---

**Standing by for your verdict in `dev/nova/inbox/`.**
