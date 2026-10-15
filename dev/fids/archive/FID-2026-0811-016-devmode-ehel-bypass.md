<!-- markdownlint-disable MD013 -->

# FID: Remove the devMode EHEL Enforcement Bypass

**Filename:** `FID-2026-0811-016-devmode-ehel-bypass.md`
**ID:** FID-2026-0811-016
**Severity:** high
**Status:** closed
**Created:** 2026-08-11 04:20
**YAGNI-Compliance:** Verified
**Master FID:** `FID-2026-0811-021`

---

## Summary

The native tool executor suppresses EHEL `beforeToolCall` whenever `fileContext.devMode === true`, allowing the tool call to bypass session-init, pre-write, FID, and other ECHO enforcement. Custom tools independently use the same flag to bypass agent restriction checks, and transition-phase logic treats it as an ECHO exception. The repository exposes `devMode` through CLI and SDK run state. This FID defines a safe, explicit development boundary while preserving strict-session compliance; the completed policy boundary is recorded below.

## Environment

- **OS:** Windows `win32`
- **Language/Runtime:** Strict TypeScript monorepo; Bun `1.3.14`
- **Tool Versions:** Project commands from `protocol.config.yaml`; strict ECHO mode enabled
- **Commit/State:** Dirty working tree; findings are against the live filesystem
- **Governing contract:** ECHO Laws 1–4, 7–8, 15; single-agent strict-mode contract

## Detailed Description

### Problem

`packages/agent-runtime/src/tools/tool-executor/native.ts:133-134` derives `isDevOverride` from `params.fileContext.devMode === true`. At lines 273–278, `enforcement.beforeToolCall` is executed only inside `if (!isDevOverride)`. The same flag bypasses the custom-tool restriction gate at `packages/agent-runtime/src/tools/tool-executor/custom.ts:104-115`. `devMode` is propagated by CLI and SDK state, including `sdk/src/run/execution/session-state.ts:129-131`.

### Expected Behavior

Development conveniences must not disable immutable ECHO process laws or security-sensitive enforcement in a strict session. If a development escape hatch is retained, it must be explicit, typed, scoped to a documented non-strict mode, visible in diagnostics, and impossible to activate accidentally through persisted or user-controlled state. Tool restrictions and EHEL process gates must remain authoritative unless the selected protocol contract explicitly permits the exception.

### Root Cause

One boolean conflates local developer convenience, agent capability restrictions, FSM flexibility, sandbox policy, and EHEL protocol enforcement. The executor uses that boolean as a broad bypass rather than resolving separate, typed permissions at a boundary.

### Evidence

```text
packages/agent-runtime/src/tools/tool-executor/native.ts:133-134
// Dev override: bypass ALL tool gating and agent restrictions when devMode is active
const isDevOverride = params.fileContext.devMode === true

packages/agent-runtime/src/tools/tool-executor/native.ts:273-278
if (!isDevOverride) {
  const enforceResult = enforcement.beforeToolCall({ ... })
}

packages/agent-runtime/src/tools/tool-executor/custom.ts:104-115
const isDevOverride = fileContext.devMode === true
if (!isDevOverride && toolCall.toolName && ... ) { ... }

sdk/src/run/execution/session-state.ts:129-131
if (devMode !== undefined) {
  sessionState.fileContext.devMode = devMode
}
```

## Impact Assessment

### Affected Components

- `packages/agent-runtime/src/tools/tool-executor/native.ts`
- `packages/agent-runtime/src/tools/tool-executor/custom.ts`
- `packages/agent-runtime/src/tools/handlers/tool/transition-phase.ts`
- CLI and SDK dev-mode state propagation
- EHEL and tool-executor tests

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Protocol gates can be bypassed by reachable state
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Separate protocol enforcement from developer convenience. Resolve a typed execution policy from protocol variant, strictness, execution mode, permission mode, and an explicitly authorized development context. Keep EHEL pre-tool enforcement active in strict single-agent sessions and for all protocol-critical gates. If non-strict local development needs flexibility, make that policy explicit at session creation and reject ambiguous persisted booleans.

### Steps

1. Inventory every consumer and producer of `devMode`, including CLI toggles, SDK options, state serialization, custom tools, FSM transitions, sandbox policy, and programmatic calls.
2. Define a typed policy with fail-closed defaults and a compatibility migration for existing callers.
3. Remove the broad `!isDevOverride` bypass around EHEL; retain only narrowly justified non-protocol exceptions.
4. Apply the same policy to native, custom, programmatic, and subagent execution paths.
5. Add negative tests proving strict sessions cannot bypass EHEL and positive tests for the approved local development behavior.
6. Run focused runtime tests, all affected typechecks, lint, formatting, and full validation.

### Verification

The implementation must include a complete producer/consumer call graph, strict-mode bypass tests, malformed-policy tests, serialized-state compatibility tests, and evidence that sandbox and capability policy remain separate from EHEL protocol enforcement.

## Perfection Loop

### Loop 1 — RED

- **RED:** A reachable boolean bypasses EHEL pre-tool enforcement in native tools and broad capability restrictions in custom tools.
- **GREEN:** Replace the boolean-as-policy with a typed, fail-closed policy and preserve EHEL for strict sessions.
- **AUDIT:** Source and state propagation lines are cited above; a production search found 38 `devMode` references, confirming this is cross-workspace and not a local edit.
- **ADVERSARIAL:** Do not simply delete all development behavior. Local debugging may be valid, but it cannot weaken immutable process laws or be activated by an untrusted persisted flag. Do not treat a debug log as enforcement.
- **CHANGE DELTA:** FID document only.

### Loop 2 — Independent audit and self-correction

- **RED:** The initial scope could conflate sandbox bypass, capability bypass, FSM phase flexibility, and EHEL bypass into one replacement with unclear semantics.
- **GREEN:** The implementation must define separate policy decisions and test each boundary independently. EHEL strictness is non-negotiable; sandbox and capability behavior are preserved only where explicitly authorized.
- **AUDIT:** `native.ts`, `custom.ts`, `session-state.ts`, CLI state, and transition-phase are all named production surfaces. Exact implementation call-graph and policy-matrix output remains an approval-gated requirement.
- **ADVERSARIAL:** A test that only checks `devMode: false` is inadequate. The adversarial pass must exercise true, absent, malformed, persisted, subagent, and strict/safe combinations.
- **CHANGE DELTA:** Planning correction only.

### Loop 3 — Final audit and adversarial convergence

- **RED:** Independent review found that the broad `devMode` inventory spans protocol, capability, sandbox, and FSM concerns, so a single replacement must not silently change all four contracts.
- **GREEN:** The final plan requires a typed policy with separate decisions, strict-session EHEL preservation, and matrix tests for true, false, absent, malformed, persisted, subagent, and non-strict cases.
- **AUDIT:** The final package probes produced `validation: PASS`, `All matched files use Prettier code style!`, Markdownlint exit 0, and no forbidden-attribution matches. The live source evidence remains `native.ts:133-134` plus the guarded `beforeToolCall` call at `native.ts:273-278`, with `custom.ts:104-115` as a separate capability path.
- **ADVERSARIAL:** The finding remains CONFIRMED for the native EHEL path. A debug log is not enforcement, and a passing typecheck would not prove strict-mode bypass resistance. Status remains `verified` pending approved implementation and negative runtime tests.
- **CHANGE DELTA:** Final planning-loop evidence only; no source implementation.

### Missed Questions

1. Is `devMode` user-controlled? → Treat it as untrusted session input until validated at the run boundary.
2. Can strict single-agent sessions use it? → Not as a bypass for EHEL or immutable process laws.
3. Should sandbox bypass and EHEL bypass share a flag? → No; they have different threat models and must be independently resolved.
4. What is the default for absent or malformed policy? → Fail closed for protocol-critical enforcement; preserve only explicitly documented compatibility defaults.
5. Do custom tools need EHEL parity? → Yes, either route them through the same enforcement contract or document and separately enforce their protocol boundary.

### Code Verification Evidence

- [x] Native and custom executor paths exist and are cited.
- [x] `devMode` producer/consumer paths were identified by read-only search.
- [x] Typed policy implemented — implementation completed under the granted automation level 3 scope.
- [x] Strict and compatibility test matrix — implementation evidence recorded in the closure addendum below.
- [x] Production call-graph proof — required after implementation.

### Implementation Closure Addendum — 2026-08-11

- Nova's independent implementation audit returned **PASS — implementation approved for closure** in `dev/nova/inbox/2026-08-11-fid-2026-0811-015-021-echo-compliance-remediation-implementation-audit-response.md`.


- Broad `devMode` bypass behavior was replaced by explicit execution-policy decisions. EHEL remains authoritative; sandbox override is separately resolved at `packages/agent-runtime/src/tools/tool-executor/execution-policy.ts:23` and consumed by native/custom executors.
- Trusted custom/MCP definitions are provenance-bound by `packages/agent-runtime/src/tools/tool-executor/trusted-custom-tool-definitions.ts:6-17`; caller-supplied metadata cannot downgrade a write-capable tool.
- Runtime verification passed: agent-runtime typecheck exit 0; 780/780 agent-runtime tests; focused execution-policy/enforcement tests; root ESLint, Markdownlint, Prettier, quality, hygiene, and repository validation all passed.
- Independent review found no remaining critical/high blocker. Working-tree audit manifest `21110e2f32dccab4b69adc1c5d55ed98d637d44aa3200e679c8b769e4bfe4808` passed all six audit commands; clean-release certification was not claimed.

## Resolution

- **Status:** `closed` — implementation, runtime verification, and Nova independent implementation audit completed.
- **Implementation:** Completed under the granted automation level 3 scope.
- **Tests Added:** Yes — strict execution-policy, EHEL, sandbox, and custom-tool regression coverage.
- **Archive:** Moved to `dev/fids/archive/` after Nova returned PASS.

## Lessons Learned

A convenience flag becomes a security boundary when it reaches an executor. Protocol, capability, sandbox, and debugging permissions must not be represented by one implicit boolean.
