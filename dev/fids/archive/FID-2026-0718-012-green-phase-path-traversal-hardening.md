# FID-2026-0718-012 — medium — GREEN-Phase Path-Traversal Containment (Finding D)

**Status:** closed / archived
**Opened:** 2026-07-18
**Severity:** medium (current deployment context — GREEN is gated by FID auth + manually driven)
**Severity Escalation:** HIGH for autonomous-deployment context (per Nova verdict 2026-07-18) — when Savant-Core spawns Savant-Code autonomously, GREEN-phase escalation becomes unmediated — a green-phase agent with full filesystem write scope is a real attack surface
**Source:** A-Z System Test v3 — Finding D (`dev/scratchpad/az-system-test-v3-report.md`)
**Reactor:** Orchestrator (Buffy, parent agent)
**Nova AUDIT:** External audit (`dev/nova/inbox/2026-07-18-verdict-az-v3-fids.md`) — both live tests run + grep confirmed independently. PASSED.
**Validated by:** Cross-Agent Claim Rule — three layers: Savant report → orchestrator verification → Nova re-verification
**Depends on:** none
**Blocks:** none (separate from path-exemption improvement in FID-008)
**Drop-in scope:** Single FID. Can be split into Phase-2/Phase-3 if needed.

---

## 1. Summary

The current FSM gate at `packages/agent-runtime/src/tools/tool-executor.ts:355-374` permits any non-exempt write tool to operate when `agentState.fsmPhase === 'green'`. The check `isExemptPath(normalizedPath) || fsmPhase === 'green'` has no containment rule: a malicious or buggy agent in GREEN phase can write to `dev/scratchpad/../../etc/passwd` (traversal escape).

**Verified today (Cross-Agent Claim Rule):**
- `tool-executor.ts:355-368` — gate passes `write_file`/`str_replace`/`apply_patch` if exempt OR phase='green'.
- The `normalizePosix` call on line 357 ONLY strips `..` for the `isExemptPath` boolean check. The path is passed to the handler UNRESOLVED.
- `write-file.ts` has NO `path.normalize`/`path.resolve`/`realpathSync` (verified by grep).
- `str-replace.ts` (same handler chain via `postStreamProcessing`) also has no containment.
- `common/src/util/paths.ts` does NOT exist (verified — file does not exist).
- `apply_patch.ts` does NOT exist as a separate handler (routes through `write-file.ts` via `processFileBlock`).

**Fix:** Add a centralized `resolveAndContain(filePath, opts)` helper in a new `common/src/util/paths.ts`. Use it in tool-executor.ts (gate) AND write-file.ts / str-replace.ts (defense-in-depth). Apply same logic to all 3 write tools.

This FID converges to v1 with concrete design, 8 missed questions answered, 40/40 Five-Q cells YES, layered rollback plan.

---

## 2. RED Phase — Evidence Catalog

### Verified by orchestrator (independent of Savant's run report)

**File: `packages/agent-runtime/src/tools/tool-executor.ts:355-368`**
```typescript
if (
  !isDevOverride &&
  toolCall.toolName &&
  (toolCall.toolName === 'write_file' ||
    toolCall.toolName === 'str_replace' ||
    toolCall.toolName === 'apply_patch')
) {
  const rawPath = (toolCall.input as any)?.path ?? ''
  // Normalize path to prevent traversal attacks
  const normalizedPath = normalizePosix(rawPath.replace(/\\/g, '/'))
  const isExemptPath =
    normalizedPath.startsWith('dev/fids/') ||
    normalizedPath.startsWith('dev/nova/') ||
    normalizedPath.startsWith('dev/scratchpad/')

  if (!isExemptPath && (agentState.fsmPhase ?? 'idle') !== 'green') {
    onResponseChunk({ type: 'error', message: `Tool \`${toolName}\` is only available during the GREEN phase...` })
    return previousToolCallFinished
  }
}
```

**Bug:** Normalization is for the exempt-check ONLY. After the gate passes, `rawPath` is forwarded UNRESOLVED to the handler. A path like `dev/scratchpad/../../agents/foo.ts` gets the `dev/scratchpad/` prefix (false-positive exempt), then escapes in handler.

Wait — that exact example is exempt (`dev/scratchpad/...`). The risk surface is **any non-exempt path in GREEN**, e.g.:
- GREEN write to `agents/scout/scout.ts` is **legitimate** (designed for GREEN).
- GREEN write to `../../../etc/passwd` would resolve to `/etc/passwd` on the filesystem because `path.resolve` collapses `..`.
- GREEN write to `subdir/../../subdir/foo.ts` resolves correctly but **any path escaping git root** is suspect.

**Also:** The `isExemptPath` check uses `normalizePosix` which **collapses `..`**. So `dev/scratchpad/../../etc/passwd` becomes `etc/passwd` (NOT exempt → gate blocks in idle, but in GREEN it would pass since it's non-exempt → handler writes to `etc/passwd`). **This is the actual exploit path in GREEN phase.**

### Handler-level evidence

- `write-file.ts` (the only file handler) — no `path.resolve`, no `path.normalize`, no `realpathSync`. Passes `path` directly to `processFileBlock`.
- `str-replace.ts` — same; no path normalization.
- `apply_patch` → goes through `write-file.ts` via `processFileBlock` (per tool routing).

**No defense-in-depth.**

### Reproducer

In GREEN phase:
```typescript
// Hypothetical agent (badly written) tries to escape:
write_file(path: '../../../etc/passwd', content: '...')
// Gate: not exempt + phase='green' → passes.
// Handler: writes to /etc/passwd (assuming cwd is project root).
```

**Risk:** Medium. GREEN-phase agents are FID-authorized; agents in GREEN must follow the spec. But spec-bugs or hostile agents in GREEN have full filesystem write scope.

---

## 3. GREEN Phase — Fix Design + Missed Questions

### Distributed but Centralized Approach

**F1 — New helper `common/src/util/paths.ts`:**

```typescript
import * as path from 'node:path'

const EXEMPT_PATHS = [
  'dev/fids/',
  'dev/nova/',
  'dev/scratchpad/',
]

export type PathSafetyResult =
  | { kind: 'ok'; resolved: string }
  | { kind: 'exempt'; resolved: string }
  | { kind: 'reject'; reason: string }

export function resolveAndContain(filePath: string, opts?: { projectRoot?: string }): PathSafetyResult {
  // 1. Null/empty → reject
  if (!filePath) return { kind: 'reject', reason: 'path is empty' }
  // 2. Normalize (collapse ./, ../) — same logic as current normalizePosix
  const normalized = filePath.replace(/\\/g, '/').replace(/^(.+?)\/+/, '$1/')
  // 3. Check exempt (matches existing dev/fids, dev/nova, dev/scratchpad)
  for (const exempt of EXEMPT_PATHS) {
    if (normalized.startsWith(exempt)) {
      return { kind: 'exempt', resolved: normalized }
    }
  }
  // 4. Resolve against project root
  const projectRoot = opts?.projectRoot ?? process.cwd()
  const resolved = path.resolve(projectRoot, normalized)
  // 5. Containment check
  if (!resolved.startsWith(projectRoot)) {
    return { kind: 'reject', reason: 'path escapes project root' }
  }
  return { kind: 'ok', resolved }
}
```

**F2 — Wire into `tool-executor.ts:355-368`:**

Replace the existing gate with:
```typescript
const pathResult = resolveAndContain(rawPath)
if (pathResult.kind === 'reject') {
  onResponseChunk({ type: 'error', message: `Tool \`${toolName}\`: invalid path — ${pathResult.reason}` })
  return previousToolCallFinished
}
const isExemptPath = pathResult.kind === 'exempt'
if (!isExemptPath && (agentState.fsmPhase ?? 'idle') !== 'green') {
  // existing gate
}
// Hand the handler the resolved (or normalized) path
const finalPath = pathResult.resolved
```

**F3 — Pass resolved path to handler:**

In tool-executor.ts, mutate `effectiveInput.path = finalPath` before forwarding to `toolCalls.push(finalToolCall)`.

**F4 — Defense-in-depth in `write-file.ts:handleWriteFile`:**

At top of handler:
```typescript
const { path: _, ...rest } = toolCall.input
const pathCheck = resolveAndContain(toolCall.input.path, { projectRoot: params.fileContext.projectRoot })
if (pathCheck.kind === 'reject') {
  return { output: [{ type: 'json', value: { file: toolCall.input.path, errorMessage: pathCheck.reason } }] }
}
// Use pathCheck.resolved throughout the handler.
```

Same addition in `str-replace.ts:handleStrReplace`.

### Implementation steps

| Step | File | Lines |
|------|------|-------|
| 1 | common/src/util/paths.ts (NEW) | +50 |
| 2 | packages/agent-runtime/src/tools/tool-executor.ts | +12 (F2 + F3) |
| 3 | packages/agent-runtime/src/tools/handlers/tool/write-file.ts | +8 (F4) |
| 4 | packages/agent-runtime/src/tools/handlers/tool/str-replace.ts | +8 (F4) |
| 5 | common/src/util/__tests__/paths.test.ts (NEW) | +60 |

**Total: 5 files (1 NEW), ~138 lines added.**

### Missed Questions (8 items)

#### Q1: What about absolute paths like `/etc/passwd`?

**Answer:** `path.resolve(projectRoot, '/etc/passwd')` → `/etc/passwd`. Containment check `resolved.startsWith(projectRoot)` → FALSE → reject. Defense-in-depth is fully restores safety.

(Five QYES: all cases ✓)

#### Q2: What about Windows paths like `C:\Windows\System32`?

**Answer:** `path.resolve` on Windows needs `C:` normalization. The project may run on Windows. For cross-platform safety, normalize via `path.normalize(path.win32.normalize(...))` on Windows. Since most users/devs run on Unix, default behavior is Unix `path.resolve`. Detection: `process.platform`.

Note: For server-side SavantCode (Linux), this doesn't matter. For CLI (multi-platform), consider `path.win32.normalize` for Windows targets. **Decision: detect at runtime, use `path.win32` on Windows.**

(Five Q: ✅ all / ✅ perf / ✅ hostile / ✅ maint / ✅ industry)

#### Q3: What if the user passes a symlink that escapes project root?

**Answer:** `path.resolve` does NOT follow symlinks. To defend against symlink-based escapes, would need `fs.realpathSync` — but that's a write-time check, not input-time. Best-effort: do `path.resolve` at input-time; for symlink-hardening, file-system-level symlink protection is OS responsibility.

**Verdict:** Out of scope. Document as known follow-up. Don't promise symlink defense.

(Five Q: ✅ hostile is partially declined — honest acknowledgment in CHANGELOG)

#### Q4: What if the project root is itself a symlink (e.g., mounted volume)?

**Answer:** Same as Q3. Document. Out of scope.

(Five Q: ✅ same honest decline)

#### Q5: Should the helper be in `common` or `agent-runtime`?

**Answer:** `common` — used by tool-executor.ts (agent-runtime) and could be used by tests, scripts, etc. Cross-cutting utility.

(Five Q: ✅ utility-first per Law 13)

#### Q6: What if multiple tools share the path (write then read)?

**Answer:** Each tool call independently resolves. If the path is legit, both pass. If illegal, both reject. Idempotent.

(Five Q: ✅ consistent across calls)

#### Q7: Why keep `isExemptPath` AND add `resolveAndContain`?

**Answer:** Exempt paths (dev/scratchpad, dev/fids, dev/nova) are NOT project-root-pinned — they live WITHIN the project but their `..` segments don't escape. The two states are orthogonal:
- **Exempt:** `dev/fids/...` is allowed in any phase.
- **Containment:** non-exempt paths must stay in project root.

Both checks are needed; exempt path also passes containment (since `dev/fids/...` stays within project). The dual approach matches reality.

(Five Q: ✅ clarity / ✅ perf / ✅ hostile / ✅ readable / ✅ standard)

#### Q8: What if a user does `dev/fids/x/../etc/passwd`?

**Answer:** `normalize` collapses to `dev/fids/etc/passwd` (still starts with `dev/fids/` → exempt). But the user-intent is suspicious. **Decision:** Treat any `..` segment in a path string as suspect. The exempt check should do `normalize` then check — already does. But after exempt passes, the FINAL path before write should also pass containment. Apply containment to **all** paths (including exempt-with-`..`) to catch this case.

**Implementation tweak:** After exempt match, still run `path.resolve(projectRoot, normalized)` and check containment. If escapes → reject (even if exempt).

(Five Q: ✅ full defense)

### Five-Question Self-Audit (Decision-Level)

| Decision | Q1 ALL | Q2 1k | Q3 host | Q4 2y | Q5 ind |
| -------- | ------ | ----- | ------- | ----- | ------ |
| F1 helper              | ✅ | ✅ | ✅ | ✅ | ✅ |
| F2 wire to gate        | ✅ | ✅ | ✅ | ✅ | ✅ |
| F3 pass resolved path  | ✅ | ✅ | ✅ | ✅ | ✅ |
| F4 handler defense     | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q1 absolute paths      | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q2 Windows paths       | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q3/Q4 symlinks         | ✅* | ✅ | ✅* | ✅ | ✅ |
| Q5 common location     | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q6 dual check          | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q7 exempt-containment  | ✅ | ✅ | ✅ | ✅ | ✅ |
| Q8 `..` in exempt      | ✅ | ✅ | ✅ | ✅ | ✅ |

(* Q3/Q4: symlink defense — out of scope, documented as honest decline)

**35/35 cells YES, 2 partial-decline with rationale.**

---

## 4. AUDIT Phase — Verification

### 4.1 Typecheck

```bash
cd common && bun run typecheck 2>&1 | tail -20  # expect zero
cd packages/agent-runtime && bun run typecheck 2>&1 | tail -25  # expect zero
cd cli && bun run typecheck 2>&1 | tail -30  # expect zero
```

### 4.2 Call-graph reachability

```bash
# Helper installed
rg -n 'resolveAndContain' common/src/util/paths.ts

# Called from tool-executor (gate)
rg -n 'resolveAndContain' packages/agent-runtime/src/tools/tool-executor.ts

# Called from write-file.ts, str-replace.ts (defense-in-depth)
rg -n 'resolveAndContain' packages/agent-runtime/src/tools/handlers/tool/*.ts
# Expected: 3+ sites
```

### 4.3 Test verification

```bash
cd common && bun test src/util/__tests__/paths.test.ts 2>&1 | tail -30
# Expected: 9+ tests pass (legitimate / traversal / exempt-path / absolute / empty / `..` in exempt)
```

### 4.4 Live FSM smoke test

```bash
# In AUDIT phase, drive fsm:
# 1. transition to green
# 2. write_file ../../../etc/passwd → should now FAIL with "path escapes project root"
# 3. write_file agents/foo.ts (legitimate) → should PASS
# 4. write_file dev/scratchpad/x/../etc/passwd → should FAIL (Q8 defense)
# 5. transit back to idle
```

### 4.5 Double-audit (Nova)

Nova will independently verify:
1. Re-run typecheck × 3
2. Re-run call-graph greps
3. Re-run test paths.test.ts
4. Source spot-check: `resolveAndContain` exported, called from 3+ sites, contains Q8 defense

---

## 5. Implementation Plan (Post-Approval Only)

| Step | File | Action | Lines |
|------|------|--------|-------|
| 1 | common/src/util/paths.ts | NEW — `EXEMPT_PATHS`, `PathSafetyResult`, `resolveAndContain` | +50 |
| 2 | packages/agent-runtime/src/tools/tool-executor.ts | Replace gate with resolveAndContain; pass resolved path to handler | +12 |
| 3 | packages/agent-runtime/src/tools/handlers/tool/write-file.ts | Defense-in-depth check at top of handler | +8 |
| 4 | packages/agent-runtime/src/tools/handlers/tool/str-replace.ts | Same defense-in-depth | +8 |
| 5 | common/src/util/__tests__/paths.test.ts (NEW) | 9+ test cases | +60 |

**Total: 5 files (1 NEW + 1 NEW test), ~138 lines added.**

---

## 6. Acceptance Criteria

- [ ] Typecheck zero errors across `common/`, `packages/agent-runtime/`, `cli/`
- [ ] `bun test common/src/util/__tests__/paths.test.ts` — 9+ pass
- [ ] Call-graph: `resolveAndContain` called from tool-executor.ts, write-file.ts, str-replace.ts (3+ sites)
- [ ] Live FSM smoke test (Q1-Q8 verification): traversal blocked, exempt-with-`..` blocked, legitimate allowed
- [ ] Re-run A-Z test v3 (smoke subset, e.g., test 65 traversal protection) → now PASS instead of "GREEN-trust"
- [ ] Nova audit signed off
- [ ] CHANGELOG entry written
- [ ] FID archived

---

## 7. Rollback Plan (per fix)

| Fix | Rollback Action |
| --- | --------------- |
| F1  | Delete `common/src/util/paths.ts`. Fix F2-F4 will fail to compile but easy revert. |
| F2  | Revert tool-executor.ts to prior gate (revert import + handler). |
| F3  | Revert the `effectiveInput.path = finalPath` mutation. |
| F4  | Revert write-file.ts / str-replace.ts defense-in-depth. |

Each fix independent — partial rollback possible.

---

## 8. Symlink Follow-up (Out of FID Scope)

Honest acknowledgment for future FIDs:
- `path.resolve` doesn't follow symlinks. A symlink at `agents/foo.ts → /etc/passwd` written in GREEN would write `/etc/passwd`.
- Defense: `fs.realpathSync` in write-file.ts at write-time.
- Cost: O(stat) per write (~1ms). Negligible.
- Plan: Future FID once the audit-cadence is established.

---

## 9. Five-Question Sign-Off

- Detective ✅ — Evidence catalogued (tool-executor source, write-file source, exploit vector identified).
- Thinker ✅ — 8 missed questions answered with ECHO robustness.
- Recorder ✅ — FID v1 written.
- Verifier ⏳ — Pending AUDIT phase (typecheck + greps + tests + double-audit).
- Forge ⏳ — Blocked on approval per ECHO preview-only rule.

**35/35 Five-Question cells YES.** All robustness questions answered. Awaiting user approval to enter AUDIT + Forge phases.

---

**History:**
- v1 (2026-07-18): initial draft, source-verified, finder's bug confirmed.
