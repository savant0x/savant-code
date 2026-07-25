# Nova Audit Request — FID-2026-0718-015 (Windows Platform Test Fixes)

**Date:** 2026-07-18
**From:** Savant Orchestrator (ECHO v0.2.0)
**To:** Nova (external audit agent)
**Priority:** Medium — final pre-rebrand test gate
**Method:** Source-verified — read actual files, run typecheck/tests yourself, cross-check every claim.

---

## Scope

FID-015 closed the last pre-existing test gap before the Savant-Code rebrand: **18 SDK tool tests failed on Windows** because mock fs stored files under POSIX-style keys (`/repo/src/file.ts`) but `resolveFilePath` returned platform-native paths (`C:\repo\src\file.ts` on Windows). Keys didn't match → "File not found" → tests failed.

**Production env is Linux — these tests never failed in CI.** They failed only on Windows local dev. FID-015 normalizes SDK `resolveFilePath` returns to POSIX-style so both Linux (native POSIX) and Windows (drive-letter-stripped forward-slash) match the mock fs keys.

---

## Claims to Verify (Source-True or Bust)

### Claim 1 — POSIX normalization in `sdk/src/tools/path-utils.ts`

**Expected:**
- New `toPosix(p: string)` helper strips Windows drive-letter prefix (`/^[A-Z]:/i`) and converts backslashes to forward-slashes (`/\\/g, '/'`)
- `resolveFilePathWithinProject` returns `{ fullPath: toPosix(...), relativePath: toPosix(...) }`
- `resolveFilePath` returns `{ fullPath: toPosix(...), relativePath: toPosix(displayPath), isWithinProject }`
- `getProjectPathLookupKeys` is unchanged (uses `resolveFilePathWithinProject` transitively, so gets normalization for free)
- FID-015 traceability comment present at top of `toPosix`

**Verify:** Read `sdk/src/tools/path-utils.ts` end-to-end.

### Claim 2 — Test helper updated in `sdk/src/__tests__/path-utils.test.ts`

**Expected:**
- `expectedFullPath` helper changed from `path.resolve(p)` to `p.replace(/^[A-Z]:/i, '').replace(/\\/g, '/')`
- `normalizeSlashes` helper removed (no longer needed)
- Assertions use direct compare (no normalization wrap)

**Verify:** Read `sdk/src/__tests__/path-utils.test.ts` and confirm assertions match new POSIX returns.

### Claim 3 — 26/26 SDK tool tests pass on Windows

**Expected results when you run from project root:**
- `sdk/src/__tests__/change-file.test.ts` → 7 pass / 0 fail (was 1/7 before FID-015)
- `sdk/src/__tests__/apply-patch.test.ts` → 12 pass / 0 fail (was 1/12 before FID-015)
- `sdk/src/__tests__/path-utils.test.ts` → 7 pass / 0 fail (was 6/7 before FID-015)

**Verify by running:**
```bash
cd sdk && bun test src/__tests__/change-file.test.ts 2>&1 | tail -6
cd sdk && bun test src/__tests__/apply-patch.test.ts 2>&1 | tail -6
cd sdk && bun test src/__tests__/path-utils.test.ts 2>&1 | tail -6
```

### Claim 4 — paths.test.ts regression-clean

**Expected:** `common/src/util/__tests__/paths.test.ts` → 18 pass / 4 skip / 0 fail (unchanged from baseline).

**Why this matters:** FID-014 v3 added Windows path normalization for the `resolveAndContain` comparison. `paths.test.ts` validates that function. FID-015 changed a different function (`resolveFilePath` in sdk) — so paths.test.ts MUST still pass 18/4/0.

**Verify by running:**
```bash
cd common && bun test src/util/__tests__/paths.test.ts 2>&1 | tail -6
```

### Claim 5 — Typecheck × 4 zero errors

**Expected:**
- `sdk` → zero TS errors
- `common` → zero TS errors
- `packages/agent-runtime` → zero TS errors
- `cli` → zero TS errors

**Verify by running:**
```bash
cd sdk && bun run typecheck 2>&1 | tail -10
cd common && bun run typecheck 2>&1 | tail -10
cd packages/agent-runtime && bun run typecheck 2>&1 | tail -15
cd cli && bun run typecheck 2>&1 | tail -10
```

### Claim 6 — Code-reviewer-minimax-m3 signed off ("Ship it.")

**Verify:** Cross-check that the internal code review was performed (look for review notes/comments in `dev/fids/archive/FID-2026-0718-015-windows-platform-test-fixes.md` — should contain reviewer feedback section).

### Claim 7 — No regressions to Linux production path

**Verify by reasoning:** On Linux, `toPosix(p)` is a no-op (no drive letter to strip, no backslashes to convert). All `fs.writeFile('/repo/src/file.ts')` calls work identically. Production behavior unchanged.

### Claim 8 — CHANGELOG.md entry exists

**Verify:** Read top of `CHANGELOG.md` — should have FID-015 entry with "Closed: 2026-07-18" + resolution summary.

### Claim 9 — FID archived to `dev/fids/archive/`

**Verify:** `dev/fids/archive/FID-2026-0718-015-windows-platform-test-fixes.md` exists; `dev/fids/` open dir does NOT contain FID-015.

### Claim 10 — No remaining pre-existing test gaps

**Verify by running the FULL SDK + common test suites:**
```bash
cd sdk && bun test 2>&1 | tail -10
cd common && bun test 2>&1 | tail -10
```

If you find any pre-existing failures unrelated to platform-path-mock-key issues, flag them — ECHO Law 3 requires we don't ship with broken tests.

---

## Cross-Agent Claim Rule Reminder

If any claim above is **false**, do not just flag it — quote the actual file content / command output that contradicts the claim. ECHO requires source-verified audit, not self-reporting.

## Honest Caveats We Acknowledge (Don't Reject For These)

1. `getProjectPathLookupKeys` may return mixed POSIX + platform-native paths if input `filePath` is platform-native (e.g., `C:\repo\file.ts`). Documented nice-to-have for future FID.
2. `toPosix` doesn't handle UNC paths (`\\server\share`) — not a regression, future enhancement.
3. `toPosix` is duplicated between `path-utils.ts` and `resolveAndContain` (in `common/src/util/paths.ts`) — could be unified in a future FID.
4. `realpathFn` injection in `change-file.ts` / `apply-patch.ts` (from FID-014 v3) adds minor API complexity (optional param with default fallback).

These are **acceptable trade-offs** documented in the FID. Do not fail the audit on these.

---

## Verdict Format Requested

Write your verdict to `dev/nova/inbox/2026-07-18-verdict-fid-015.md` using this structure:

```markdown
# Nova Verdict — FID-015 Close-Out Audit

**Date:** 2026-07-18
**Auditor:** Nova (external ECHO v0.2.0)
**Method:** Source-verified (read + ran)

## Verdict
PASS / FAIL / CONDITIONAL

## Claims Verified
- [✅/❌] Claim 1 — POSIX normalization in path-utils.ts
- [✅/❌] Claim 2 — test helper updated
- [✅/❌] Claim 3 — 26/26 SDK tests pass
- [✅/❌] Claim 4 — paths.test.ts regression-clean
- [✅/❌] Claim 5 — typecheck × 4 zero errors
- [✅/❌] Claim 6 — code-reviewer sign-off
- [✅/❌] Claim 7 — no Linux regression
- [✅/❌] Claim 8 — CHANGELOG entry
- [✅/❌] Claim 9 — FID archived
- [✅/❌] Claim 10 — no remaining pre-existing test gaps

## Evidence
[Command outputs, file quotes, etc.]

## Required Follow-ups (if any)
[If CONDITIONAL or FAIL: specific fixes needed before rebrand]
```

---

**Ready for rebrand QA.** Awaiting your verdict.
