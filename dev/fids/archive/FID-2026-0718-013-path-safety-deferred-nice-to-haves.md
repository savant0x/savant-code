**Status:** OPEN — Perfection Loop converged to v3 (post-Nova audit amendment), awaiting user approval
**Opened:** 2026-07-18
**Severity:** medium (security follow-up; current state is hardened against string-traversal but not symlinks; monorepo paths may diverge from process.cwd())
**Source:** FID-2026-0718-012 close-out — 2 deferred nice-to-haves flagged by code-reviewer
**Reactor:** Orchestrator (Buffy, parent agent)
**Validated by:** Cross-Agent Claim Rule — 3 source-verifications (basher: apply-patch.ts lines, write-file.ts line 101; basher: getStubProjectFileContext empty; thinker pressure-test: 10 gaps)
**Depends on:** FID-2026-0718-012 ✅ closed
**Blocks:** none
**Drop-in scope:** Single FID with 2 batched fixes. ~140 lines across 4-5 files (no NEW files except tests).

---

## 1. Summary

FID-012 closed with a strong defense-in-depth layer for write tools: project-root containment via `resolveAndContain()`. Two nice-to-haves were deferred:

### Nice-to-have 1: `fileContext.projectRoot` propagation
- Handler defenses fall back to `process.cwd()` rather than receiving the runtime's project root from `params.fileContext.projectRoot`.
- Risk: monorepo + subdirectory test environments where `process.cwd()` differs from the actual project root. Containment weakens.

### Nice-to-have 2: symlink-following safety
- `path.resolve` does NOT follow symlinks. A symlink at `agents/foo.ts → /etc/passwd` would resolve to a still-in-project path (string-wise), but writing through it would write to `/etc/passwd`.
- Risk: attack vector for hostile agents with on-disk write capability, especially in autonomous-deployment context (per Nova's severity escalation of FID-012).

Both fixes batched into one small FID per user request.

---

## 2. RED Phase — Independent Verification (v2)

### R1 (verified): write-file.ts defense site location
**Re-verified:** `resolveAndContain` defense-in-depth call is at **`write-file.ts:101`** (NOT line 65 as v1 stated — line numbers shifted between FID-012 close and FID-013).
- Source: `packages/agent-runtime/src/tools/handlers/tool/write-file.ts:101`
- Just below: `processFileBlock` invocation (line ~120)

### R2 (verified): apply-patch.ts is a SEPARATE handler (NOT routed through write-file.ts)
**Verified:** `packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts` is a **17-line thin wrapper** that delegates to client via `requestClientToolCall` (no `fs.writeFile`, no `processFileBlock`). It does NOT call `resolveAndContain`.
- Source: 17 lines, 1 export (`handleApplyPatch`), 0 lines doing actual fs writes
- FID-012 only protected it at the gate-level (`tool-executor.ts:357-375`)
- **FINDING:** apply-patch has a defense-in-depth **GAP** between gate and client-side execution window. F1+F2 must wire apply-patch.ts as a 4th site.

### R3 (verified): str-replace.ts defense site location
**Verified:** `resolveAndContain` defense-in-depth call is at **`str-replace.ts:36-48`** (confirms v1).

### R4 (verified): processFileBlock is NOT a CLI-side tripwire
**Verified:** `packages/agent-runtime/src/process-file-block.ts` does NOT call `resolveAndContain` or `isExemptPath` (grep returned 0 matches).
- Correction to v1's Q8: "processFileBlock + requestOptionalFile is a 3rd tripwire" was inaccurate.
- The actual CLI-side tripwire is `requestClientToolCall` from apply-patch.ts (R2) — wired by F1+F2 in this FID.

### R5 (verified): getStubProjectFileContext returns empty projectRoot
**Verified:** `common/src/util/file.ts:142` — `projectRoot: ''` returned.
- 8 dependent test files use this stub: agent-validation.test.ts, agent-registry.test.ts, read-subtree.test.ts, clone-session-state.test.ts, run-cancellation.test.ts, run-error-preserves-history.test.ts, run-file-filter.test.ts, run-handle-event.test.ts, run-mcp-tool-filter.test.ts.
- **CONSEQUENCE:** F1 (reject empty projectRoot) WILL break any test that exercises write tools through this stub. Migration plan required (Q13).

### Reproducers confirmed

**String-traversal attack (R0):**
```bash
write_file(path="dev/fids/x/../../../etc/passwd")  # Currently: may be 'reject'
```
- v1 already covered by FID-012.

**Symlink attack (NEW in v2):**
```bash
cd /tmp && rm -rf r && mkdir r/agents && cd r && \
  ln -s /etc/passwd agents/foo.ts && \
  # In GREEN phase:
  write_file(path="agents/foo.ts", content="hi")   # Currently: 'ok' (string-path is in-project)
```
- Confirmed gap: `fs.realpathSync` would resolve `/etc/passwd`, containment check would FAIL → should be 'reject'.

---

## 3. GREEN Phase — Fix Design (per Thinker Pressure-Test)

### F1 — projectRoot propagation (v2 — with absolute-path invariant)

**Design:** (c) Defense-in-depth — thread `params.fileContext.projectRoot` through **all 4 sites**.

**Implementation:**

1. Update `common/src/util/paths.ts:resolveAndContain()`:
   - **Remove** `opts?.projectRoot ?? process.cwd()` fallback
   - **New invariant:** if `opts?.projectRoot` is missing/empty/non-string → `{ kind: 'reject', reason: 'projectRoot missing — project config invalid' }`
   - **Additional invariant:** if `!path.isAbsolute(opts.projectRoot)` → `{ kind: 'reject', reason: 'projectRoot must be absolute' }` (prevents reintroduction of cwd fallback via relative paths — Thinker Gap 9)

2. Update **4 sites** (was 3 in v1):
   - `packages/agent-runtime/src/tools/tool-executor.ts:357-375` (gate) — pass `params.fileContext.projectRoot` ✅ (v1 covered)
   - `packages/agent-runtime/src/tools/handlers/tool/write-file.ts:101` (defense) — Verifier R1 ✅
   - `packages/agent-runtime/src/tools/handlers/tool/str-replace.ts:36` (defense) — Verifier R3 ✅
   - **`packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts`** (NEW defense site) — Verifier R2 gap ✅

3. Update `common/src/util/file.ts:getStubProjectFileContext()` (line 142): change `projectRoot: ''` → `projectRoot: '/mock/project/root'` (thinker Gap 1 — test fixture migration). Production paths already use absolute paths from CLI boot.

**Trade-off acknowledged (explicit):**
- v1 claimed migration impact was limited. v2 corrects: 8 dependent test files share stub; if any exercise write-tool paths, they'll need fixture updates.
- All 3 callers + 1 new caller (apply-patch) must explicitly pass projectRoot. No implicit fallback. This is **intentional hardening**.

### F2 — Symlink defense (v2 — with EACCES catch-all + Windows skipIf)

**Design:** (c) Hybrid — `fs.realpathSync.native` walks up `path.dirname()` until an existing ancestor is found.

**Algorithm v2 (extended from v1):**
```ts
function safeRealpath(filePath: string, projectRoot: string): string | null {
  let current = path.resolve(projectRoot, filePath)
  const missingSegments: string[] = []
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current)
    if (parent === current) return null  // hit filesystem root
    missingSegments.unshift(path.basename(current))
    current = parent
  }
  try {
    const realpath = fs.realpathSync.native(current)
    return path.join(realpath, ...missingSegments)
  } catch (err: any) {
    // Handles ENOENT, ELOOP, EACCES, EINVAL, EPERM, EIO — any failure to resolve
    // Returns null so caller rejects conservatively. Per Thinker Gap 5.
    return null
  }
}
```

**Wired into `resolveAndContain`:**
- After Stage 2 (`path.resolve`), call `safeRealpath` to get the symlink-resolved absolute path.
- Containment check uses the resolved realpath instead of the string-resolved path.
- Reject if `realpath` is `null` OR escapes project root.

**Cross-platform notes:**
- Test fixture: **Windows requires Developer Mode or admin for `fs.symlinkSync`**. Use `test.skipIf(process.platform === 'win32')` for symlink-specific tests (thinker Gap 7). Non-symlink tests run on all platforms.
- `fs.realpathSync.native` handles Win32 symlinks correctly when present (Dev Mode).
- Performance: ~1-2ms per call. Independent benchmark not yet run (thinker Gap 8 — honest assessment: estimated, not measured). Acceptable for write tools.

### Implementation steps (v2 — corrected line numbers)

| Step | File | Action | Lines | Verifier |
|------|------|--------|-------|----------|
| 1 | common/src/util/paths.ts | Add `safeRealpath`; add absolute-path invariant; remove `process.cwd()` fallback | +35 | R1 v1 |
| 2 | packages/agent-runtime/src/tools/tool-executor.ts | Update `resolveAndContain` call to pass `params.fileContext.projectRoot` (line ~365 unchanged) | +2 | R1 v1 |
| 3 | packages/agent-runtime/src/tools/handlers/tool/write-file.ts | Update `resolveAndContain` call to pass `params.fileContext.projectRoot` (**line 101**, not 65) | +2 | R1 v2 |
| 4 | packages/agent-runtime/src/tools/handlers/tool/str-replace.ts | Update `resolveAndContain` call to pass `params.fileContext.projectRoot` (**line 36-48**) | +2 | R3 v2 |
| 5 | **NEW:** packages/agent-runtime/src/tools/handlers/tool/apply-patch.ts | Add `resolveAndContain` defense-in-depth call at top of `handleApplyPatch` (17-line file: integrate inline) | +5 | R2 v2 |
| 6 | common/src/util/__tests__/paths.test.ts | Add F1+F2 test cases: missing projectRoot → reject; non-absolute projectRoot → reject; symlink-to-/etc → reject; in-project symlink → ok; dead symlink → reject; EACCES-error → reject | +80 | Q11 |
| 7 | common/src/util/file.ts | Update `getStubProjectFileContext` to return `projectRoot: '/mock/project/root'` | +1/-1 | R5 v2 |
| 8 | (conditional) 8 dependent test fixtures | If any exercise write-tool paths, update mock projectRoot. **TBD during FORGE** — investigative step. | varies | R5 v2 |

**Estimated total:** ~125 lines across 5-6 files (1 NEW wiring site for apply-patch, 1 stub fixture update, 1 test file extension).

### Missed Questions (13 items — v2 added Q11-13)

#### Q1-Q10 (v1): see archived v1 content
- Q1: `process.cwd()` fallback removed — explicit contract
- Q2-Q3: legitimate in-project symlinks — handled
- Q4: detached filesystem / `null` → reject
- Q5: broken symlinks (ENOENT) → reject
- Q6: symlink loops (ELOOP) → reject
- Q7: 1000-agent scale — acceptable
- Q8: TOCTOU window — defense-in-depth mitigates (v1)
- Q9: result caching — unnecessary
- Q10: Windows Dev Mode — handled

#### Q11 (NEW): TOCTOU deeper analysis
**Question:** Is TOCTOU fully eliminated by handler-level realpath checks?
**Answer:** **No.** Averting TOCTOU requires checking realpath at the exact moment of opening the file descriptor in the client environment. The agent-runtime realpath check (gate + handler) does NOT eliminate the window between handler-return and client-side write. However, three layers mitigate: (1) gate-level realpath, (2) handler-level realpath (NEW in this FID), (3) client-side file open check (out of scope). **Honest assessment:** sufficient for hostile-agent prevention, not airtight against mid-flight FS attackers with on-disk write access — but our threat model is hostile agents, not active FS attackers.

#### Q12 (NEW): apply_patch handler is a 17-line thin wrapper
**Question:** Does apply_patch need explicit defense-in-depth if it's just `requestClientToolCall`?
**Answer:** **YES, but lightweight.** Add 4-line `resolveAndContain` defense at top of `handleApplyPatch` (returns 'reject' → error message returned to agent). This protects the **POST-gate** execution window in case the gate logic is bypassed (dev override, future code changes). Defense-in-depth principle applies even for thin wrappers — better to have 4 lines of redundancy than zero.

#### Q13 (NEW): getStubProjectFileContext migration to absolute path
**Question:** Does updating the stub to `'/mock/project/root'` break tests that compare to `''`?
**Answer:** **Investigative step during FORGE.** Need to grep each of 8 dependent test files to determine if any string-compare or `.match(/^$|^$/)` patterns check for empty projectRoot. If found, fix in same FORGE cycle. If not found, simple migration. Mitigation: make the mock path uniform (`'/mock/project/root/'`) so string-contants are obvious. **TBD during AUDIT phase of FID-013.**

### Five-Question Self-Audit (Decision-Level v2)

| Decision | Q1 ALL | Q2 1k | Q3 host | Q4 2y | Q5 standard |
| -------- | ------ | ----- | ------- | ----- | ---------- |
| F1 thread projectRoot (4 sites) | ✅ | ✅ | ✅ | ✅ | ✅ |
| F1 reject empty projectRoot | ✅ | ✅ | ✅ | ✅ | ✅ |
| F1 reject non-absolute projectRoot (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ |
| F1 update getStubProjectFileContext (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ |
| F1 add apply-patch defense (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ |
| F2 hybrid realpath | ✅ | ✅ | ✅ | ✅ | ✅ |
| F2 catch all realpath errors (NEW: ENOENT+ELOOP+EACCES+EINVAL) | ✅ | ✅ | ✅ | ✅ | ✅ |
| F2 skipIf Windows for symlink tests (NEW) | ✅ | ✅ | ✅ | ✅ | ✅ |

**40/40 cells YES** (was 35/35 in v1; +5 new rows from pressure-test).

---

## 4. AUDIT Phase — Verification (v2 with corrected lines)

### 4.1 Typecheck (parallel)
```bash
cd common && bun run typecheck 2>&1 | tail -20 # zero errors
cd packages/agent-runtime && bun run typecheck 2>&1 | tail -25 # zero errors
cd cli && bun run typecheck 2>&1 | tail -30 # zero errors
```

### 4.2 bun test (paths.test.ts extended to ≥20 tests)
```bash
cd common && bun test src/util/__tests__/paths.test.ts 2>&1 | tail -40
# Expected: 14 v1 + 6 v2 new = 20 tests pass
```

### 4.3 Live symlink repro (NEW in v2)
```bash
mkdir -p /tmp/repro-fid013 && cd /tmp/repro-fid013 && \
  mkdir agents && ln -s /etc/passwd agents/foo.ts && \
  bun run src/util/__tests__/paths.test.ts
# Expected: rejected with "symlink escapes project root"
```
**Caveat:** Windows requires Dev Mode. Run on Linux/macOS only.

### 4.4 Regression: getStubProjectFileContext update
```bash
grep -n "projectRoot" common/src/util/file.ts | head
# Verify: 'projectRoot: \'/mock/project/root\'' is present
# Verify: 0 references to 'projectRoot: \'\'' remain
```

### 4.5 Live symlink repro on full write-file integration
```bash
# Manual: spawn Forge agent in /tmp/repro-fid013, attempt write_file
# through agents/foo.ts symlink. Expect: 'reject' with realpath reason.
```

### 4.6 Call-graph greps (v2 — corrected line numbers)
```bash
rg -n 'resolveAndContain' \
  packages/agent-runtime/src/tools/tool-executor.ts \
  packages/agent-runtime/src/tools/handlers/tool/{write-file,str-replace,apply-patch}.ts \
  common/src/util/paths.ts
# Expected: 4 caller sites (1 invoke + 3 import + 1 definition = 7+ matches)
```

### 4.7 grep test fixtures (Q13)
```bash
rg -n 'projectRoot.*:.*""|projectRoot.*===""' \
  common/src/__tests__/agent-validation.test.ts \
  packages/agent-runtime/src/templates/__tests__/agent-registry.test.ts \
  packages/agent-runtime/src/tools/handlers/__tests__/read-subtree.test.ts \
  sdk/src/__tests__/clone-session-state.test.ts \
  sdk/src/__tests__/run-cancellation.test.ts \
  sdk/src/__tests__/run-error-preserves-history.test.ts \
  sdk/src/__tests__/run-file-filter.test.ts \
  sdk/src/__tests__/run-handle-event.test.ts \
  sdk/src/__tests__/run-mcp-tool-filter.test.ts
# Expected: 0 matches (no string-comparison against empty projectRoot)
```

### 4.8 Nova audit (final)
- Run typecheck × 3 (4.1)
- Run paths.test.ts (4.2) + free-agents.test.ts (regression)
- Verify symlink repro (4.3)
- Verify getStubProjectFileContext migration (4.4)
- Verify call-graph (4.6)
- Verify fixture compat (4.7)

---

## 5. Implementation Plan (Post-Approval Only)

| Step | File | Action | Lines |
|------|------|--------|-------|
| 1 | common/src/util/paths.ts | Add `safeRealpath` (15 lines); reject empty projectRoot; reject non-absolute projectRoot; remove `process.cwd()` fallback | +35 |
| 2 | tool-executor.ts | Thread projectRoot (existing call site) | +2 |
| 3 | write-file.ts | Thread projectRoot (line 101, not 65) | +2 |
| 4 | str-replace.ts | Thread projectRoot (line 36-48) | +2 |
| 5 | **apply-patch.ts** | Add defense-in-depth `resolveAndContain` call at top of `handleApplyPatch` | +5 |
| 6 | common/src/util/__tests__/paths.test.ts | Add 6+ new test cases: missing/non-absolute projectRoot; symlink-to-/etc; in-project symlink; dead symlink; EACCES-error (skipIf Windows for symlink) | +80 |
| 7 | common/src/util/file.ts | Update `getStubProjectFileContext` to return `'/mock/project/root'` | +1/-1 |
| 8 | (conditional) 8 dependent test fixtures | If any string-compare against empty projectRoot, fix in same cycle | varies |

**Total: ~125 lines across 5-7 files. No NEW files (only test additions + fixture updates).**

---

## 6. Acceptance Criteria

- [ ] Typecheck zero errors across `common/`, `packages/agent-runtime/`, `cli/`
- [ ] `paths.test.ts` ≥20 tests pass (was 14 in v1)
- [ ] Live symlink repro rejected (Linux/macOS; Win32c skipped)
- [ ] Live legitimate `agents/foo.ts` (regular file) still allowed
- [ ] Live in-project symlink (target within project) still allowed
- [ ] `apply-patch.ts` defense-in-depth call returns reject on out-of-project paths
- [ ] `getStubProjectFileContext` updated to `/mock/project/root`
- [ ] All 8 dependent test fixtures pass typecheck (no `projectRoot: ''`)
- [ ] Nova audit signed off
- [ ] CHANGELOG entry written
- [ ] FID archived

---

## 7. Rollback Plan (per fix)

| Fix | Rollback Action |
| --- | --------------- |
| F1a | Revert `resolveAndContain` to use `process.cwd()` fallback. Revert 4 caller changes (tool-executor, write-file, str-replace, apply-patch). |
| F1b | Restore `getStubProjectFileContext` → `projectRoot: ''`. |
| F2  | Remove `safeRealpath` from `paths.ts`. Containment reverts to string-only (FID-012 state). |
| F2-catch | Restore specific ENOENT/ELOOP catches; remove try/catch-all. |

Partial rollback possible per fix.

---

## 8. Resolved Decisions (v2)

| # | Decision | Resolution |
|---|----------|------------|
| 1 | F1 thread approach | (c) Defense in depth — pass projectRoot at **4 sites** (incl. apply-patch) |
| 2 | F1 fallback chain | **Reject** if projectRoot missing OR non-absolute — no implicit cwd fallback |
| 3 | F1 stub update | Update `getStubProjectFileContext` to absolute mock path |
| 4 | F2 algorithm | (c) Hybrid — realpath ancestor + relative segments |
| 5 | F2 error catch | (a) Catch-all — translate ENOENT/ELOOP/EACCES/EINVAL/EPERM to reject |
| 6 | F2 symlink test | `test.skipIf(process.platform === 'win32')` for symlink-only tests |
| 7 | Performance budget | ~1-2ms per call acceptable; not benchmarked (honest) |
| 8 | apply_patch defense | Add 4-line `resolveAndContain` call at top of `handleApplyPatch` |
| 9 | F3 gate-containment outside `!isDevOverride` (Nova flag) | Move `resolveAndContain` call OUTSIDE the `!isDevOverride` guard — defense-in-depth principle (Lesson from Nova audit flag) |

No further user-input required on architecture.

---

## 9. Five-Question Sign-Off

- Detective ✅ — Evidence (write-file.ts line 101 verified; apply-patch.ts is 17-line thin wrapper; processFileBlock is not a tripwire; getStubProjectFileContext confirmed empty).
- Thinker ✅ — Pressure-tested 10 gaps; 8 decisions resolved; 3 new missed questions Q11-13 answered.
- Recorder ✅ — FID v2 written with corrections + amendments.
- Verifier ⏳ — Pending AUDIT phase (typecheck + 20 tests + symlink repro + fixture checks + double-audit).
- Forge ⏳ — Blocked on approval per ECHO preview-only rule.

**40/40 Five-Question cells YES (v2; was 35/35 in v1; +5 new rows). Awaiting user approval to enter AUDIT + Forge phases.**

---

## 10. Honest Caveats (v2 — expanded)

1. **TOCTOU window acknowledged (Q11 updated).** Defense-in-depth at gate + handler + client-side file open (CLI). Not airtight against mid-flight attacker with on-disk write access. Acceptable for hostile-agent prevention (the goal), not for an active attacker with FS access (out of scope).
2. **F1 may break tests that rely on `process.cwd()` fallback.** Migration: `getStubProjectFileContext` updated. Confirmatory grep of 8 dependent tests during AUDIT phase.
3. **Symlink defense is conservative** — rejects broken symlinks. Some legitimate workflows may use broken symlinks as placeholders. Document in CHANGELOG.
4. **Performance is estimated (~1-2ms), not benchmarked.** Honest: if measurement during AUDIT reveals >10ms per call, F2 may need to be deferred to a future FID with caching.
5. **processFileBlock was inaccurately described as a 3rd tripwire in v1.** v2 corrects: the actual client-side tripwire is `requestClientToolCall` from apply-patch.ts (now covered by F2 wiring at line 5).

---

## 11. History

- **v1 (2026-07-18):** initial draft, thinker architecture, 10 missed questions answered, 35/35 Five-Q YES, line numbers based on FID-012 review.
- **v2 (2026-07-18):** iterations after **source-verified pressure-test** by basher + thinker. Corrections: write-file.ts line 101 (not 65); apply-patch.ts identified as separate 17-line handler (NOT routed through write-file.ts) — F1+F2 must wire as 4th site; processFileBlock NOT a tripwire (Q8 v1 inaccurate); getStubProjectFileContext confirmed empty (test migration needed); 3 new missed questions Q11-13 added; 5 new decision rows. **40/40 Five-Q YES.**
- **v3 (2026-07-18):** post-Nova audit amendment. Nova approved v2 with 4/5 corrections verified at exact line + 1 line-drift (C5), but flagged: `/dev` override bypasses ALL gating including containment. Cross-verified: handler defense (write-file.ts:101, str-replace.ts:36-48, apply-patch.ts thin-wrapper) already fires UNCONDITIONALLY (no `devMode` check) — Nova's specific attack vector (dev-mode agent writing outside project root → escape) is already mitigated post-implementation. **HOWEVER:** defense-in-depth principle says containment must NEVER be behind a bypass. Amendment F3: move gate's `resolveAndContain` outside `!isDevOverride` (belt+suspenders + principle). 1 new missed question Q14 (dev escape workflows) appended. 5/5 additional Five-Q cells YES. **Total: 45/45.**

---

## 12. F3 Amendment — Dev Override Hardening (Nova Audit Flag)

### 12.1 Nova's Audit Flag (verbatim)

> FID-013 hardens intra-project containment. The `path.isAbsolute` invariant (D2) is the critical control. **BUT:** the `/dev` override (tool-executor.ts:324-325) bypasses ALL gating — including this containment. Once Savant-Core spawns autonomous Savant-Code instances (your agent-economy vision), a dev-mode agent writing outside project root = real escape.
> 
> **Recommendation:** When stripping `/dev` from production (pre-release flag from earlier audits), ensure the path-containment check is NOT behind `!isDevOverride`. Containment should be a hard floor even in dev mode.

### 12.2 Cross-Verification (basher 2026-07-18)

- **tool-executor.ts gate:** `resolveAndContain` IS currently wrapped in `!isDevOverride` (`if (!isDevOverride && toolCall.toolName && (toolCall.toolName === 'write_file' || ...))`). Confirmed Nova's claim at the gate level.
- **Handler defenses:** NO `devMode`/`isDevOverride` references in `write-file.ts`, `str-replace.ts`, `apply-patch.ts`. Defense-in-depth at handler level fires UNCONDITIONALLY regardless of `/dev` flag.
- **Net behavior post-FID-013 ship:** Even with `/dev` active, an out-of-project write is REJECTED at the handler defense layer first. Nova's specific attack vector (dev-mode agent writing outside project root → escape) is **already mitigated** by FID-013's handler defense layer.
- **However:** the defense-in-depth principle stands — containment at the gate should NEVER be behind a bypass. Amendment is belt+suspenders, with **NO behavior change post-ship** because handler defends.

### 12.3 Implementation (small diff)

| Step | File | Change | Lines |
|------|------|--------|-------|
| 1 | `packages/agent-runtime/src/tools/tool-executor.ts:345-380` | Move `resolveAndContain` call OUTSIDE the `!isDevOverride` guard so the gate fires on every write regardless of dev mode | +5/-5 restructure (1 block move) |
| 2 | `common/src/util/__tests__/paths.test.ts` | Add 2 test cases: dev-mode + out-of-project = reject; dev-mode + exempt prefix = allow | +20 |

**Side-effect on dev workflows:** NONE — handler defense already rejects out-of-project writes after FID-013 ships. Gate amendment is policy enforcement, NOT behavior change. Dev users retain ability to write to exempt prefixes (`dev/fids/`, `dev/nova/`, `dev/scratchpad/`) which is the canonical pattern for dev work outside source-tree.

### 12.4 New Missed Question (Q14)

**Q14:** What if a dev user LEGITIMATELY wants to write outside project root (e.g., cross-project test fixtures, debugging temp files)?

**A:** Two paths forward:
1. **(a) Hard floor:** dev override doesn't change containment. Use exempt prefixes (`dev/fids/`, `dev/nova/`, `dev/scratchpad/`) — these already allow project-internal write outside source-tree. **Recommended.**
2. **(b) Path-mutation in dev mode:** allow dev to explicitly opt-in to a "deliberate escape" via a new env var or flag. **Out of scope for FID-013 v3** — defer to FID-015 if needed (would be a separate, more substantive UX/policy FID).

**Recommendation:** (a) — the exempt prefixes already cover the legitimate dev needs (FIDs, Nova messages, scratchpad). No escape needed.

### 12.5 Five-Question Self-Audit (F3 additions)

| Decision | Q1 ALL | Q2 1k | Q3 host | Q4 2y | Q5 standard |
| -------- | ------ | ----- | ------- | ----- | ---------- |
| F3 move resolveAndContain outside `!isDevOverride` | ✅ | ✅ | ✅ | ✅ | ✅ |
| F3 no behavior change (handler defense already protects) | ✅ | ✅ | ✅ | ✅ | ✅ |

**5/5 additional cells YES. Total FID-013 v3: 45/45.**
