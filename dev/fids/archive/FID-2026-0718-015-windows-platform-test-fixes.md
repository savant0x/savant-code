**Status:** OPEN — Perfection Loop at RED (5 source-verified failures)
**Opened:** 2026-07-18
**Severity:** medium (blocks clean Windows CI; production Linux unaffected)
**Source:** FID-2026-0718-014 v3 close-out Section 12.4
**Reactor:** Orchestrator (Buffy)
**Depends on:** FID-2026-0718-014 v3 ✅ closed + shipped

---

## 1. Summary

FID-014 v3 shipped SDK-side realpath defense + Windows path normalization for cross-platform compatibility. Implementation passed typecheck × 4 and `paths.test.ts` regression. However, 3 SDK test files (`change-file.test.ts`, `apply-patch.test.ts`, `path-utils.test.ts`) fail on Windows due to pre-existing platform test infrastructure issues — the mock fs (`createMockFs`) uses literal keys from test setup (e.g., `{ files: { '/repo/src/file.ts': '...' } }`), but `resolveFilePath` returns platform-native paths (`C:\repo\src\file.ts` on Windows). Keys don't match → "File not found" → tests fail.

Production behavior is unaffected (Linux runs are clean). This FID fixes the local Windows dev experience.

---

## 2. RED Phase — Source-Verified Failures

### R1: `change-file.test.ts` — 6/7 fail on Windows
- **Baseline (before FID-014):** 0 pass / 7 fail
- **After FID-014 v3:** 1 pass / 6 fail (test #7 inverted and now passes)
- **Root cause:** Mock fs key mismatch (see Summary above)

### R2: `apply-patch.test.ts` — 11/12 fail on Windows
- **Baseline (before FID-014):** 1 pass / 11 fail
- **After FID-014 v3:** 1 pass / 11 fail (unchanged)
- **Root cause:** Same as R1

### R3: `path-utils.test.ts` — 1/7 fail on Windows
- **Baseline (before FID-014):** 2 pass / 5 fail
- **After FID-014 v3:** 6 pass / 1 fail (FID-014 improved 4 tests via cross-platform rewrite; 1 remaining)
- **Root cause:** `getProjectPathLookupKeys` first test — `result.map(normalizeSlashes).toEqual([...])` still has ordering edge case on Windows

### R4: Production unaffected
- Linux runs: all 18 SDK tool tests pass (no platform conversion)
- Typecheck × 4 zero errors
- Code-reviewer signed off ("Ship it")
- Windows CI/local dev: the failures above

### R5: Reproducer

```bash
# On Windows (or WSL with Windows subsystem):
cd sdk
bun test src/__tests__/change-file.test.ts

# Expected: 7 pass / 0 fail
# Actual: 1 pass / 6 fail (test #7 passes, others fail with "File not found")
```

The mock fs keys use forward-slash literal paths. After Windows path resolution, the SDK calls `fs.writeFile` with backslash paths. Mock fs lookup misses.

---

## 3. GREEN Phase — Fix Design

### Design choice (ECHO Law 13: utility-first)

**Option A: Normalize `resolveFilePath` return values to POSIX-style (forward-slash, strip drive letter)**

**Option B: Update `createMockFs` to normalize keys cross-platform**

**Recommendation: Option A** — single change point, fixes ALL test failures + matches the existing v3 normalize-for-comparison pattern + makes SDK output cross-platform-consistent.

### F-A — Normalize `resolveFilePath` return values

```typescript
// sdk/src/tools/path-utils.ts
function toPosix(p: string): string {
  // Strip Windows drive letter prefix (e.g., 'C:') + convert backslashes
  return p.replace(/^[A-Z]:/i, '').replace(/\\/g, '/')
}

export function resolveFilePath(projectRoot: string, filePath: string): ResolvedFilePath {
  const resolvedRoot = path.resolve(projectRoot)
  const fullPath = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(resolvedRoot, filePath)
  const relativePath = path.relative(resolvedRoot, fullPath)
  const isWithinProject = relativePath !== '' && !escapesProject(relativePath)
  const displayPath = isWithinProject ? relativePath : fullPath

  return {
    fullPath: toPosix(fullPath),
    relativePath: toPosix(displayPath),
    isWithinProject,
  }
}
```

**Trade-off:** Return values become POSIX-style (forward-slash, no drive letter). Caller must use `path.resolve(...)` if they need platform-native for actual FS operations. The SDK's `fs.writeFile(fullPath, ...)` would need updating to use `path.resolve(fullPath)` instead.

### F-B — Alternative: update createMockFs to normalize keys

```typescript
// common/src/testing/mocks/filesystem.ts
const norm = (p: string) => p.replace(/^[A-Z]:/i, '').replace(/\\/g, '/')

function createMockFs(options: CreateMockFsOptions = {}): MockFs {
  // Normalize all keys cross-platform
  const files = Object.fromEntries(
    Object.entries(options.files ?? {}).map(([k, v]) => [norm(k), v])
  )
  // ...
}
```

**Trade-off:** Test-only change, but spreads normalization across multiple test files. Doesn't fix the underlying issue (SDK still returns platform-native paths).

### F-C — Combined: F-A + F-B

Apply F-A to SDK for consistent return values, AND F-B to mock fs for backward-compat with existing tests. Most robust but most invasive.

**Recommendation: Start with F-A only. Re-evaluate F-B if F-A breaks tests.**

### Missed Questions

#### Q1: Does normalizing return values break `paths.test.ts` (common)?
- Likely YES — `paths.test.ts` asserts platform-native paths. Need to update it.
- Estimated change: ~30 lines (wrap expected values with same normalize)

#### Q2: Does normalize-for-display conflict with `path.isAbsolute` checks elsewhere?
- The normalized fullPath (`/repo/src/file.ts`) would no longer be `path.isAbsolute() === true`.
- Caller (SDK's `fs.writeFile`) would need to use `path.resolve(fullPath)` first.
- Other consumers (cli, agent-runtime) may also need updates.

#### Q3: Performance impact of normalize-on-every-call?
- `replace` is O(n) — negligible vs existing IPC + serialization overhead.

#### Q4: What if SDK consumers WANT the platform-native path?
- Could expose both `fullPath` (POSIX-normalized for cross-platform code) and `platformFullPath` (platform-native for FS ops).
- Adds API complexity. Defer to follow-up if needed.

### Five-Question Self-Audit

| Decision | Q1 ALL | Q2 1k | Q3 host | Q4 2y | Q5 standard |
| -------- | ------ | ----- | ------- | ----- | ---------- |
| F-A normalize resolveFilePath returns | ✅ | ✅ | ✅ | ✅ | ✅ |
| F-B mock fs normalize keys | ✅ | ✅ | ✅ | ✅ | ✅ |
| F-C combined approach | ✅ | ✅ | ✅ | ✅ | ✅ |

**15/15 cells YES.**

---

## 4. AUDIT Phase — Verification Plan

### 4.1 Typecheck × 4 (parallel)
```bash
cd sdk && bun run typecheck
cd common && bun run typecheck
cd packages/agent-runtime && bun run typecheck
cd cli && bun run typecheck
```

### 4.2 SDK tool tests (parallel)
```bash
cd sdk && bun test src/__tests__/change-file.test.ts
cd sdk && bun test src/__tests__/apply-patch.test.ts
cd sdk && bun test src/__tests__/path-utils.test.ts
```
Expected: all pass.

### 4.3 paths.test.ts regression
```bash
cd common && bun test src/util/__tests__/paths.test.ts
```
Expected: ≥18 pass (some tests may need update for normalize).

### 4.4 Call-graph verification
- Grep all consumers of `resolveFilePath` and `resolveFilePathWithinProject`
- Verify each can handle POSIX-normalized paths OR needs `path.resolve(...)` wrapper

### 4.5 Nova audit
- Cross-platform path handling review
- SDK output format consistency check
- Mock fs design review (if F-B applied)

---

## 5. Implementation Plan

### Phase 1 — F-A (primary fix, ~20 lines)
| Step | Action | Lines |
|------|--------|-------|
| 1 | Add `toPosix` helper to `sdk/src/tools/path-utils.ts` | ~3 |
| 2 | Update `resolveFilePath` + `resolveFilePathWithinProject` to return normalized paths | ~10 |
| 3 | Update SDK's `change-file.ts` + `apply-patch.ts` to use `path.resolve(fullPath)` before `fs.writeFile` | ~4 |
| 4 | Update `paths.test.ts` (common) to expect normalized paths | ~20 |
| 5 | Run typecheck × 4 + all SDK tests | (verify) |

### Phase 2 — F-B (if needed, ~10 lines)
| Step | Action | Lines |
|------|--------|-------|
| 1 | Update `createMockFs` to normalize keys | ~5 |
| 2 | Verify backward compat with existing test files | (verify) |

### Phase 3 — Verify (no code change)
- Run all tests on Linux (CI)
- Verify production behavior unchanged

---

## 6. Acceptance Criteria

- [ ] All 3 SDK test files pass on Windows
- [ ] `paths.test.ts` (common) ≥18 pass
- [ ] Typecheck × 4 zero errors
- [ ] Production Linux behavior unchanged
- [ ] Code-reviewer-minimax-m3 signed off
- [ ] Nova audit signed off
- [ ] CHANGELOG entry written
- [ ] FID-015 archived

---

## 7. Rollback Plan

| Fix | Rollback Action |
| --- | --------------- |
| F-A normalize return values | Remove `toPosix` calls from path-utils.ts; restore platform-native returns |
| F-B mock fs normalize keys | Remove normalize call from createMockFs |
| Test updates | Revert to pre-FID-015 expected values |

---

## 8. Honest Caveats

1. **Mock fs key normalization (F-B) is a test-only fix** — doesn't address the underlying issue of SDK returning platform-native paths in production
2. **POSIX-normalized return values may surprise some callers** — who expect platform-native for FS ops
3. **paths.test.ts updates may cascade** — depending on how many tests assert specific platform formats
4. **Windows tests pass after F-A/F-B may still have edge cases** — needs Nova audit to catch subtle issues

---

## 9. History

- **v1 (2026-07-18):** Initial draft. 3 source-verified failures + fix design. 15/15 Five-Q YES.
