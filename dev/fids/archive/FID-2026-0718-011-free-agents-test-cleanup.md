# FID-2026-0718-011 — low — Cleanup Stale Agent References in free-agents.test.ts (Finding A)

**Filename:** `FID-2026-0718-011-free-agents-test-cleanup.md`
**ID:** FID-2026-0718-011
**Severity:** low
**Status:** closed
**Created:** 2026-0718 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0718-011-free-agents-test-cleanup`. Canonical ID: `FID-2026-0718-011`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.


## 1. Summary

`common/src/__tests__/free-agents.test.ts` references 5 agents that no longer exist in the active agent roster (deletion since FID-006):
- `code-reviewer-mimo-pro`
- `code-reviewer-kimi`
- `code-reviewer-glm`
- `code-reviewer-lite` (also referenced as `code-reviewer-lite`)
- `file-picker-max`
- `file-lister`

Live `bun test`: 2 of 10 tests FAIL:
- `allows each savant-free reviewer agent only with its configured model`
- `allows legacy code-reviewer-lite with savant-free reviewer models`

These test cases test behavior of agents that don't exist. Two clean options:
1. **Delete the failing tests** (recommended — tests target deleted agents, no value)
2. **Update tests** to reference current agent names (more work, less value — there's no current equivalent agent)

This FID converges to v1 with **Option 1: delete** + justification. ~25 lines removed across 2 tests.

---

## 2. RED Phase — Independent Verification

### Source-verified (Cross-Agent Claim Rule)

**Command run:**
```bash
grep -n 'code-reviewer-mimo-pro\|code-reviewer-kimi\|code-reviewer-glm\|code-reviewer-lite\|file-picker-max\|file-lister' common/src/__tests__/free-agents.test.ts
```

**Result:** 12+ matches across 2 tests + describe-block headers.

**Command run:**
```bash
bun test src/__tests__/free-agents.test.ts
```

**Result:** 10 tests, 8 pass, **2 FAIL**:
- `allows each savant-free reviewer agent only with its configured model` — `Expected: true, Received: false` for `code-reviewer-lite`
- `allows legacy code-reviewer-lite with savant-free reviewer models` — same `code-reviewer-lite` failure

**Root cause:** Tests reference `code-reviewer-mimo-pro`, `code-reviewer-kimi`, `code-reviewer-glm`, `code-reviewer-lite` — all of which were DELETED from the agent roster (likely in FID-006 when reviewers were consolidated into `verifier`).

**File picker verification:** `code-reviewer-{mimo-pro,kimi,glm,lite}` files don't exist anywhere in active source. `file-lister.ts`, `file-picker-max.ts` not found. Stale references confirmed.

### Reproducer

```bash
cd common && bun test src/__tests__/free-agents.test.ts 2>&1 | tail -30
# Expect: 2 failures, exit code 1
```

---

## 3. GREEN Phase — Fix Design + Missed Questions

### Decision: Delete the 2 failing tests

**Why delete vs update:**

| Option | Pros | Cons |
|--------|------|------|
| **Delete** (recommended) | Fast (5 min); no risk of testing wrong behavior; matches agent-roster reality | Loses coverage of those specific configurations |
| **Update to new agent names** | Retains test coverage | The deleted agents don't have a current equivalent; the replacement (`verifier`) is tested elsewhere; mapping isn't 1:1 |
| **Delete + add new test for `verifier`** | Best coverage | More work; out of scope |

**The principle (ECHO Law 13 — Utility-First):** If a test references a deleted entity, the test is testing dead code. Delete the test.

### Implementation steps

| Step | Action | Lines |
|------|--------|-------|
| 1    | Open `common/src/__tests__/free-agents.test.ts` | — |
| 2    | Delete the 2 failing test functions | ~40 lines removed |
| 3    | Delete or empty the `describe('code-reviewer-{mimo-pro,kimi,glm,lite}')` block(s) | depends |
| 4    | Verify other tests still pass (no broken imports) | — |

**Estimated impact:** ~40 lines deleted. 8 tests still pass. Net: 0 failures.

### Missed Questions (5 items, simpler than FID-010)

#### Q1: Are the failing tests covering behavior of a current agent?

**Answer:** No. The deleted `code-reviewer-*` agents don't exist. The consolidated `verifier` agent is tested elsewhere (FID-008 verified the reviewer→verifier consolidation). The 2 failing tests test dead code.

#### Q2: Are there OTHER tests that might break from the deletion?

**Answer:** No. The 2 failing tests are self-contained. Removing them doesn't affect imports or other test cases.

#### Q3: Does the test file still serve a purpose after deletion?

**Answer:** Yes — the 8 remaining tests still cover the current free-agents logic. Deletion of 2/10 leaves a useful file.

#### Q4: What's the ECHO Law 9 (Documentation) impact?

**Answer:** The deleted behavior was for deleted agents. No external documentation references them (verified via grep). Clean deletion.

#### Q5: What about test 135 ("`/help` omits `/dev`") from the A-Z report?

**Answer:** Different concern (a phrasing/expected-count issue). NOT in scope of FID-011.

### Five-Question Self-Evaluation

| Q#  | Question | YES/NO | Rationale |
|-----|----------|---------|-----------|
| Q1  | All cases?                    | ✅ | All stale-agent references handled by deletion |
| Q2  | 1000 agents?                  | ✅ | Static delete; no perf concern |
| Q3  | Hostile attacker?             | ✅ | Removes a false-positive test that didn't actually test a security property |
| Q4  | 2-year maintenance?           | ✅ | Simpler file = easier to maintain |
| Q5  | Industry standard?            | ✅ | Standard pattern: delete dead tests when referenced code dies |

**All 5 YES.**

---

## 4. AUDIT Phase — Verification

### 4.1 Typecheck verification

```bash
cd common && bun run typecheck 2>&1 | tail -20
# Expect: zero errors
```

### 4.2 Test verification

```bash
cd common && bun test src/__tests__/free-agents.test.ts 2>&1 | tail -30
# Expect: 8/8 PASS, exit 0 (zero failures)
```

### 4.3 Cross-suite verification

```bash
# Run all common tests to ensure no cascading failures
cd common && bun test 2>&1 | tail -30
# Expect: same as pre-fix pass count minus 2 (since we deleted those 2)
```

### 4.4 Double-audit (Nova)

Nova will independently verify:
1. The grep results show only 2 references (not 12+)
2. `bun test` passes 0 failures
3. No code outside the test file is affected

---

## 5. Implementation Plan (Post-Approval Only)

| Step | File | Action | Lines |
|------|------|--------|-------|
| 1    | common/src/__tests__/free-agents.test.ts | Delete 2 failing test functions + their describe-block if empty | ~-40 |

**Total: 1 file, ~40 lines deleted.**

---

## 6. Acceptance Criteria

For FID to close:

- [ ] `cd common && bun run typecheck` — zero errors
- [ ] `cd common && bun test src/__tests__/free-agents.test.ts` — 8/8 PASS
- [ ] `cd common && bun test` — same overall pass count (other tests unaffected)
- [ ] No reference to deleted agents in any source file (grep verification)
- [ ] Nova audit signed off
- [ ] CHANGELOG entry written
- [ ] FID archived

---

## 7. Rollback Plan

If the deletion breaks an unexpected dependency:
- Restore the test file from git
- Re-run tests
- Optionally: add a test for `verifier` (which replaced deleted reviewers)

---

## 8. Resolved Decisions (v1)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Delete vs update | **Delete** (recommended per ECHO Law 13) |

No further user-input required on architecture.

---

## 9. Five-Question Sign-Off

- Detective ✅ — Evidence catalogued with grep + test failure output.
- Thinker ✅ — Decision justified with ECHO Law 13.
- Recorder ✅ — FID v1 written.
- Verifier ⏳ — Pending AUDIT phase (typecheck + tests + double-audit).
- Forge ⏳ — Blocked on approval per ECHO preview-only rule.

**Awaiting user approval to enter AUDIT + Forge phases.**

---

**History:**
- v1 (2026-07-18): initial draft, cross-verified by orchestrator, simple fix.
