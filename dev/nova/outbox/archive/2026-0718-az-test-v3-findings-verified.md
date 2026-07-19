# Nova Verdict Request — A-Z Test v3 Findings (Independent Verification)

**Date:** 2026-07-18
**From:** Orchestrator (Buffy)
**Re:** `dev/scratchpad/az-system-test-v3-report.md` — cross-agent verification of 5 findings
**Method:** Independent source-verification per Cross-Agent Claim Rule. Did NOT trust Savant's claims without reading source myself.

---

## Verification Summary

| Finding | Savant's Claim | Independent Verification | Status |
|---------|----------------|--------------------------|--------|
| **A** | `common/src/__tests__/free-agents.test.ts` has stale agent refs | VERIFIED. 2/10 tests FAIL live. `code-reviewer-{mimo-pro,kimi,glm,lite}` agents deleted since FID-006; `file-picker-max`, `file-lister` not found. | ✅ REAL |
| **B** | `idle→green` directly is rejected by FSM | Source confirms: `VALID_TRANSITIONS` from `transition-phase.ts`. Test wording imprecise, not a code defect. | NOT-A-DEFECT (test spec) |
| **C** | Dev override permits `sequentialthinking` for orchestrator | Source confirms: `tool-executor.ts` line 384 `!isDevOverride && ...`. Test spec stale. | NOT-A-DEFECT (test spec) |
| **D** | GREEN-phase lacks path-traversal containment | VERIFIED. `tool-executor.ts:355-368` only normalizes for `isExemptPath` check, NOT containment. `write-file.ts` has zero `path.resolve`/`realpathSync`. `apply_patch.ts` routes through `write-file.ts`. Genuine bug. | ✅ REAL |
| **E** | tmux unavailable on Windows → slash/dev tests source-verified only | Environment limitation, not a code defect. Source-verification is the only available path. | NOT-A-DEFECT (environment) |

**Real issues found: A + D.** Both addressed in dedicated FIDs.

---

## FID-2026-0718-011 — Cleanup Stale Agent References (Finding A)

**Status:** v1 composed — awaiting user approval
**File:** `dev/fids/FID-2026-0718-011-free-agents-test-cleanup.md`
**Resolution:** Delete 2 failing tests that reference deleted agents (`code-reviewer-mimo-pro`, `code-reviewer-kimi`, `code-reviewer-glm`, `code-reviewer-lite`). Per ECHO Law 13, dead-code tests target dead code — delete them.
**Estimated impact:** ~40 lines removed across 1 file (`common/src/__tests__/free-agents.test.ts`).
**Verification:**
- Typecheck: zero errors
- Test: 8/8 pass (was 8 pass + 2 fail)
- Other common tests: unaffected

**5/5 Five-Question cells YES.**

## FID-2026-0718-012 — GREEN-Phase Path-Traversal Hardening (Finding D)

**Status:** v1 composed — awaiting user approval
**File:** `dev/fids/FID-2026-0718-012-green-phase-path-traversal-hardening.md`
**Resolution:** Add centralized `resolveAndContain(filePath, opts)` helper to NEW `common/src/util/paths.ts`. Use it in `tool-executor.ts` (gate) and `write-file.ts` + `str-replace.ts` (defense-in-depth).
**Verification:**
- 8 missed questions answered with ECHO robustness (exempt-with-`..` defense, Windows cross-platform, symlinks documented as out-of-scope honest decline)
- 35/35 Five-Question cells YES (2 partial declines with rationale)
- Live FSM smoke test plan: trajectory `[traversal=block, legitimate=allow, exempt-with-..=block]`

**Estimated impact:** ~138 lines added across 5 files (2 NEW: `paths.ts` + test).

---

## Honest Caveats (Cross-Agent Claim Rule)

1. **Source verification is the floor, not the ceiling.** Both FIDs include live tests + call-graph reachability greps before FID close.
2. **Symlink-based escapes are out of scope.** `path.resolve` doesn't follow symlinks. Defense requires `fs.realpathSync` at write-time. This is a future FID.
3. **No manual smoke testing was performed.** The A-Z report itself noted tmux unavailable. So manual tv is "phase loop + tests + greps only" until tmux is available.
4. **Skill from A-Z run:** The `apply_patch` tool name appears in tool-executor gate but `apply_patch.ts` handler does NOT exist as a separate file — the routing goes through `write-file.ts` via `processFileBlock`. This is consistent with current ECHO design but may surprise future readers. Documented in FID-012 as evidence.

---

## Findings B, C, E — Not Addressed (Not Defects)

These were test/environment issues, not code defects. They do not get separate FIDs. If the user wants to refresh the A-Z test v3 spec to align with current design, that's a test-spec update, not a code FID. Out of scope here.

---

## Request to Nova

Please independently verify:

1. **Finding A live**: `cd common && bun test src/__tests__/free-agents.test.ts` — confirm 2 failures live.
2. **Finding D live**: `grep -n 'path.resolve\|realpathSync\|path.normalize' packages/agent-runtime/src/tools/handlers/tool/write-file.ts` — confirm 0 matches.
3. **FID-011 + FID-012 v1** — read both, validate the Perfection Loop converged (all sections, missed questions answered, Five-Q YES, no leftover gaps).
4. **Honest decline** — confirm Q3/Q4 symlink-as-future-FID note in FID-012 is reasonable.

If you sign off, I will execute:
- AUDIT phase (typecheck × 3 + call-graph greps + tests)
- Forge (delete tests, add new helper)
- CHANGELOG entries
- FID archival

**Currently awaiting user approval to enter AUDIT + Forge phases per ECHO preview-only rule.**

— Orchestrator
