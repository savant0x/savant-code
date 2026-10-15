<!-- markdownlint-disable MD013 -->

# FID: EHEL Turn-End Reachability and Post-Write Scanner Lifecycle

**Filename:** `FID-2026-0811-015-ehel-turn-end-and-scanner-lifecycle.md`
**ID:** FID-2026-0811-015
**Severity:** critical
**Status:** closed
**Created:** 2026-08-11 04:20
**YAGNI-Compliance:** Verified
**Master FID:** `FID-2026-0811-021`

---

## Summary

The production ECHO enforcement layer defines turn-end checks, but the live production call-graph search finds only the method definition. Even if a caller is restored, strict post-write scanners currently receive `() => undefined`, and the scanner intentionally skips files whose content is unavailable. This leaves Law 4 reachability, Law 5/6/9/12/14 content checks, and the content-dependent portion of Law 15 unenforced in normal execution. This FID converges the runtime lifecycle contract and records the completed implementation and verification below.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** Strict TypeScript monorepo; Bun `1.3.14`
- **Tool Versions:** Project commands from `protocol.config.yaml`; strict ECHO mode enabled
- **Commit/State:** Dirty working tree; evidence applies to the current filesystem, not a clean release baseline
- **Governing contract:** `ECHO.md` Laws 4, 5, 6, 9, 12, 14, and 15; `dev/echo-v0.1.2-single-agent.md` Laws 3 and 4

## Detailed Description

### Problem

`packages/agent-runtime/src/echo/enforcement.ts:295` defines `evaluateTurnEnd()`, but the production search `git grep -n -E 'evaluateTurnEnd\\(' -- ':!**/*.test.ts'` returns only that definition. The method calls `runPostWriteScanners` at lines 337–342 with `getWrittenFileContent: () => undefined`. `packages/agent-runtime/src/echo/post-write-scanners.ts:95` skips every dirty file when that callback returns no content.

### Expected Behavior

Every main-agent production turn reaches one authoritative turn-end enforcement point. In strict mode, every dirty file written through the supported runtime path is either scanned from the exact post-write content or the turn fails closed with a bounded, diagnosable error. A missing content source must never silently convert a required scan into a no-op. The implementation must preserve subagent and SDK compatibility boundaries explicitly.

### Root Cause

The enforcement class owns mutable turn state, while the tool executor owns the actual write inputs and completion lifecycle. The current design does not pass a content resolver into turn-end evaluation, and no production loop invokes the method. Tests cover the class in isolation but do not prove the production loop reaches it.

### Evidence

```text
git grep -n -E 'evaluateTurnEnd\\(' -- ':!**/*.test.ts'
packages/agent-runtime/src/echo/enforcement.ts:295:  evaluateTurnEnd(): { blocked: boolean; report: string } {

packages/agent-runtime/src/echo/enforcement.ts:337-342
runPostWriteScanners({
  state: this.state,
  mode: this.mode,
  tier,
  getWrittenFileContent: () => undefined,
})

packages/agent-runtime/src/echo/post-write-scanners.ts:95
const content = params.getWrittenFileContent(filePath)
if (!content) continue
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/echo/enforcement.ts`
- `packages/agent-runtime/src/echo/post-write-scanners.ts`
- Main loop and programmatic-step turn completion paths
- EHEL enforcement tests and production call-graph tests

### Risk Level

- [x] Critical: Required protocol enforcement is absent from the production turn lifecycle
- [ ] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Restore one production caller for turn-end evaluation at the correct main-agent loop boundary and provide a bounded content ledger populated from successful write operations. Make the resolver distinguish an empty file from unavailable content, and fail closed when a dirty file lacks a trustworthy content snapshot. Add direct tests for caller reachability, content scanning, empty-file handling, write failure handling, strict/hybrid behavior, and turn-state reset.

### Steps

1. Map every main-agent and programmatic completion path and select one shared enforcement boundary without duplicating turn-end decisions.
2. Extend the enforcement state or an injected write-content ledger with exact successful post-write content, bounded by the existing write and memory safety contracts.
3. Pass the resolver into `evaluateTurnEnd` and remove the silent undefined callback.
4. Ensure scanner diagnostics are redacted and bounded; do not expose file contents in receipts.
5. Add focused regression tests and a production call-graph assertion.
6. Run affected workspace tests, typecheck, ESLint, Prettier, Markdownlint, and the full configured validation matrix after implementation.

### Verification

A valid implementation requires: a production caller grep with exact output; strict scanner tests proving each dirty file is inspected; an empty-file test proving `''` is valid content; unavailable-content tests proving fail-closed behavior; hybrid-mode regression tests; and the affected workspace plus full repository gates.

## Perfection Loop

### Loop 1 — RED

- **RED:** The production call-graph search has no caller for `evaluateTurnEnd`; strict scanning receives no content; `if (!content) continue` also conflates unavailable content with an empty file.
- **GREEN:** Use one shared loop boundary, carry successful write content into enforcement, and make missing content blocking rather than silently skipped in strict mode.
- **AUDIT:** The exact absence search and source excerpts above prove the runtime defect. Existing isolated enforcement tests do not prove loop reachability; implementation must add a production wiring test.
- **ADVERSARIAL:** Do not call every direct filesystem writer a violation of this child. This child owns the agent-tool write lifecycle; credentials, exports, caches, and user settings have separate boundaries. Do not solve the defect by scanning the repository from disk after the fact, because that can observe unrelated user changes.
- **CHANGE DELTA:** FID document only; no source implementation authorized.

### Loop 2 — Independent audit and self-correction

- **RED:** A first decomposition could accidentally duplicate turn-end checks in both stream and programmatic paths, or treat an empty file as missing content.
- **GREEN:** The contract now requires one shared production boundary, an explicit content-availability state, and tests for both empty and unavailable content. Programmatic calls must either participate in the same boundary or be explicitly exempted with a cited reason.
- **AUDIT:** `packages/agent-runtime/src/run-agent-step/loop-iteration.ts` and `packages/agent-runtime/src/run-agent-step/loop.ts` are identified as the primary loop surfaces by the enforcement factory references; exact post-implementation caller output remains required and is intentionally not fabricated here.
- **ADVERSARIAL:** A passing class-unit test is insufficient. Any implementation claiming closure without a non-test caller grep is rejected under Law 4.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final audit and adversarial convergence

- **RED:** Independent review found that the record had two loop passes but no explicit final convergence record, and that the implementation boundary needed a sharper distinction between the agent-tool write ledger and unrelated filesystem writers.
- **GREEN:** Added this final pass, retained the single shared turn-end boundary, preserved the empty-string versus unavailable-content requirement, and kept unrelated writers explicitly out of scope pending separate evidence.
- **AUDIT:** The final package probes produced `validation: PASS`, `All matched files use Prettier code style!`, Markdownlint exit 0, seven active FID paths, and no forbidden-attribution matches. Final runtime evidence is recorded in the implementation addendum: `loop-iteration.ts:155` is the production caller and `enforcement.ts:352` supplies the content resolver.
- **ADVERSARIAL:** The finding remains CONFIRMED. Passing FID metadata validation cannot prove a missing production caller, and the planning loop cannot be marked implementation-closed. Status remains `verified` until the operator approves implementation and runtime gates pass.
- **CHANGE DELTA:** Final planning-loop evidence only; no source implementation.

### Missed Questions

1. Which completion paths must be covered? → All main-agent paths that can end a turn, including text-only and programmatic paths; use one shared evaluator to avoid drift.
2. How is an empty file represented? → As available content equal to `''`, never as `undefined`.
3. What happens when a write succeeds but content capture fails? → Strict mode blocks and reports a bounded diagnostic; hybrid mode records an advisory only if the governing contract explicitly permits it.
4. Should the scanner reread from disk? → No; use the exact successful write payload or a trusted post-write snapshot to avoid scanning unrelated changes.
5. Does this cover direct CLI and SDK filesystem writes? → No; only writes represented by the EHEL tool lifecycle belong here. Other write surfaces require their own FID or explicit exclusion evidence.

### Code Verification Evidence

- [x] `packages/agent-runtime/src/echo/enforcement.ts` exists and defines the affected method.
- [x] `packages/agent-runtime/src/echo/post-write-scanners.ts` exists and consumes the affected callback.
- [x] Production absence search is pasted in the Evidence section.
- [x] Implementation matches this contract — implementation completed under the granted automation level 3 scope.
- [x] Typecheck/tests/lint/format — implementation evidence recorded in the closure addendum below.
- [x] Production caller grep — `loop-iteration.ts:155` is the sole production caller.

### Implementation Closure Addendum — 2026-08-11

- Nova's independent implementation audit returned **PASS — implementation approved for closure** in `dev/nova/inbox/2026-08-11-fid-2026-0811-015-021-echo-compliance-remediation-implementation-audit-response.md`.


- The shared main-agent turn-end boundary is wired at `packages/agent-runtime/src/run-agent-step/loop-iteration.ts:155`, the sole production caller of `evaluateTurnEnd()`.
- Successful write content is retained and supplied through `packages/agent-runtime/src/echo/enforcement.ts:352`; unavailable content is no longer silently treated as a successful scan path.
- Runtime verification passed: agent-runtime typecheck exit 0; agent-runtime suite 780/780; focused enforcement and tool tests passed; root ESLint, Markdownlint, Prettier, quality, hygiene, and repository validation all passed.
- Independent review found no remaining critical/high blocker after the trusted tool-definition and lifecycle corrections. Working-tree audit evidence passed with manifest `21110e2f32dccab4b69adc1c5d55ed98d637d44aa3200e679c8b769e4bfe4808`; this is working-tree evidence, not clean-release certification.

## Resolution

- **Status:** `closed` — implementation, runtime verification, and Nova independent implementation audit completed.
- **Implementation:** Completed under the granted automation level 3 scope; the original runtime defect is remediated.
- **Tests Added:** Yes — lifecycle, scanner, enforcement, and runtime regression coverage.
- **Archive:** Moved to `dev/fids/archive/` after Nova returned PASS.

## Lessons Learned

A validator that exists only as a class method is not enforcement. Runtime gates need both a content-complete data path and a production call-graph proof.
