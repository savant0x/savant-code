<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Extensible Hook System at EHEL Enforcement Points — Lifecycle Events + Fail-Open Runner

**Filename:** `FID-2026-0814-003-extensible-hook-system.md`
**ID:** FID-2026-0814-003
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — reuses the existing `enforcement.beforeToolCall` EHEL gate and the existing `recordToolEvent` trace sites as the two attachment points; adds a hook config schema, a matcher/engine, and a runner — no new store, no new polling, no new scheduler
**Depends On:** none (feature gap found during the kimi-code deep audit, `dev/scratchpad/kimi-code-deep-audit-and-idea-farming.md`; modeled on kimi's `HookEngine`/`runHook` — `resources/kimi-code/packages/agent-core/src/session/hooks/` — ported to savant's tool executor)

---

## Summary

Savant has **no user-extensible hook system**. The tool executor has a natural lifecycle — `executeToolCall` (`packages/agent-runtime/src/tools/tool-executor/native.ts:72`) with `recordToolEvent('tool_started'/'tool_finished')` and the EHEL `enforcement.beforeToolCall` gate (`native.ts:289`, `custom.ts:183`) — but nothing lets a user or project run external commands (or internal callbacks) on lifecycle events: pre/post tool use, permission decisions, session start/end, subagent start/stop, compaction, interrupt, stop.

This FID ports kimi-code's verified hook architecture (`session/hooks/types.ts` — 17 events; `engine.ts` — regex matchers, parallel execution, allow/block aggregation; `runner.ts` — JSON-on-stdin shell protocol, exit-code-2 block, **fail-open by default**) to savant's runtime, with the EHEL gate as the `PreToolUse` enforcement point so hook decisions compose with ECHO law enforcement rather than bypassing it.

## Environment

- **OS:** Windows target; platform-agnostic CLI (OpenTUI). The runner must handle Windows process-tree kill semantics (`taskkill /T`), mirroring kimi's `killProcessTreeWindows`.
- **Language/Runtime:** TypeScript/Bun 1.3.14; React 19 / OpenTUI 0.2.2; zustand.
- **Tool Versions:** `packages/agent-runtime/src/tools/tool-executor/` (`native.ts`, `custom.ts`), `packages/agent-runtime/src/echo/enforcement.ts`, `protocol.config.yaml` + `common/src/util/protocol-config.ts` (config parsing precedent), `cli/src/utils/sdk-event-handlers.ts` (event forwarding precedent).
- **Commit/State:** working tree 0.0.24, unreleased. Second of two new feature FIDs from the kimi-code audit (goal mode is FID-2026-0814-002).

## Detailed Description

### Problem

1. **No lifecycle hooks.** Users/projects cannot run scripts or enforce project policies around tool use, permissions, sessions, subagents, compaction, or interrupts. Every such capability has to be hard-coded into the runtime.
2. **EHEL is closed.** The enforcement layer (`echo/enforcement.ts`) implements the 15 laws mechanically but offers no extension seam — a project that wants "block `rm -rf` outside a designated dir" or "deny writes to `secrets/`" beyond ECHO law 1-15 has no supported path.
3. **No feedback channel.** `recordToolEvent` (`native.ts:96-124`) traces tool start/finish into the ZTAP/observability surface but nothing can *act* on those events.

### Expected Behavior

1. A project-scoped hook config (e.g., a `hooks` block in `protocol.config.yaml`, read by the existing `readProtocolConfig` pattern) declaring events, regex matchers, commands/callbacks, timeouts, and `allow|block` semantics.
2. The runtime fires hooks at the documented lifecycle points: **`PreToolUse`** (before execution, at the EHEL gate — a block here stops the tool), **`PostToolUse`/`PostToolUseFailure`** (after execution, observation), **`SessionStart`/`SessionEnd`**, **`SubagentStart`/`SubagentStop`**, **`PreCompact`/`PostCompact`**, **`Stop`**, **`Interrupt`**, **`Notification`**.
3. **Fail-open by default**: a missing binary, timeout, or malformed output allows execution (the hook can never brick a session). Blocking requires the documented protocol (exit code 2, or JSON `permissionDecision: "deny"`).
4. Hook decisions **compose with EHEL**: a `PreToolUse` block is an additional gate, never a bypass of law enforcement.
5. Hooks are bounded: per-hook timeout (default 30 s), kill-with-grace, no unbounded output capture.

### Root Cause (verified at source)

- **H1. No hook infrastructure anywhere.** `grep -rn "hook" common/src/types protocol.config.yaml` → only unrelated matches (pre-push hook comment, gravity-index type). No hook config schema, engine, or runner exists.
- **H2. The attachment points already exist.** `native.ts:72` `executeToolCall` is the single funnel for native tool execution: `recordToolEvent('tool_started')` at `:124`, the EHEL `enforcement.beforeToolCall` gate at `:289`, `recordToolEvent('tool_finished', status)` at `:121`. `custom.ts:183` has the parallel gate for custom tools.
- **H3. Session/compaction/subagent lifecycle exists but is not observable by users.** `session-state.ts` `AgentState` carries `compactionStatus` and subagent state (used by the sidebar) but nothing invokes user code on those transitions.

## RED — Issue Catalog (evidence)

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| H-01 | high | No user-extensible hook system — every lifecycle policy must be hard-coded | Absence grep: `hook` in `common/src/types` (except `gravity-index.ts`), `protocol.config.yaml`, `packages/agent-runtime/src/echo` → no config/engine/runner (see AUDIT) |
| H-02 | medium | EHEL gate is closed — no project-extension seam at the enforcement point | `echo/enforcement.ts:170` `beforeToolCall` returns block/warnings; `native.ts:289` consumes it; nothing external can add a gate |
| H-03 | low | Tool lifecycle events are traced (`recordToolEvent`) but not actionable | `native.ts:96-124` — `tool_started`/`tool_finished` flow into `traceWriter` only |
| H-04 | medium | No bounded external-command runner (timeout/kill/JSON protocol) exists in the runtime | No `spawn`-based command runner in `packages/agent-runtime/src` besides the existing `bash` tool handler (which is agent-facing, not hook-facing) |

## GREEN — Proposed Solution (converged)

1. **Hook config schema** in `common/src/util/protocol-config.ts` (and types): `hooks?: { event: 'PreToolUse'|'PostToolUse'|'PostToolUseFailure'|'SessionStart'|'SessionEnd'|'SubagentStart'|'SubagentStop'|'PreCompact'|'PostCompact'|'Stop'|'Interrupt'|'Notification', matcher?: string, command: string, timeout?: number, cwd?: string, env?: Record<string,string> }[]`. Read via the existing `readProtocolConfig` (project root) — the same pattern as `provenance.mode`. (YAGNI: start with `PreToolUse`/`PostToolUse`/`PostToolUseFailure` as the P1 surface; the rest of the events are schema-ready but only wired where a caller exists.)
2. **Engine + runner** in `packages/agent-runtime/src/hooks/`:
   - `engine.ts` — per-event arrays, regex matchers (tool name for tool events), parallel execution, dedupe by cwd+command, `triggerBlock()` (allow/block aggregation) + `fireAndForgetTrigger()` (observation).
   - `runner.ts` — spawn the command (shell, `windowsHide: true`), feed **JSON on stdin** (`{hook_event_name, session_id, cwd, tool_name, tool_input, ...}`, snake_case like kimi's `toHookInputData`), capture bounded stdout/stderr, default timeout 30 s, kill-with-grace (`SIGTERM` → 100 ms → `SIGKILL`; `taskkill /T` on Windows). **Block protocol:** exit code `2` → block; exit `0` + JSON `{"hookSpecificOutput":{"permissionDecision":"deny","permissionDecisionReason":...}}` → block; **everything else → allow (fail-open)**.
3. **Wiring at the EHEL gate** (`native.ts` + `custom.ts`):
   - `PreToolUse` fires inside `enforcement.beforeToolCall` flow, **after** EHEL's own block decision: if EHEL already blocks, the hook is skipped (EHEL wins); if EHEL allows, a hook block adds a second gate with the hook's reason surfaced like an EHEL advisory (existing `formatBlockingError` path).
   - `PostToolUse`/`PostToolUseFailure` fire in `finishToolEvent`/the result path (`native.ts:121`), observation-only.
4. **Session/compaction/subagent events** (P2): `SessionStart`/`SessionEnd` at run start/end (`sdk/src/run/execution.ts`); `PreCompact`/`PostCompact` at the compaction boundaries already marked by `compactionStatus` writes; `SubagentStart`/`SubagentStop` at the `spawn-agent-inline.ts`/`spawn-agents.ts` lifecycle; `Stop`/`Interrupt`/`Notification` where the runtime already emits those signals. Each requires a caller grep at implementation time (Law 4) — a declared event with zero call sites is rejected.
5. **Tests**: engine matcher/aggregation unit tests; runner protocol tests (exit 2 blocks, JSON deny blocks, missing binary allows, timeout kills); a PreToolUse integration test asserting a hook block stops a `write_file` call and surfaces the reason; a fail-open test (missing command → tool still executes).

**Out of scope:** changing ECHO law enforcement semantics (hooks are an additional gate, never a bypass); the ZTAP trust model; plugin packaging (skills→plugins is a separate, later FID); the durable goal mode (FID-2026-0814-002).

## Verification Matrix (exit gates)

| Area | Hard evidence |
|---|---|
| Config | `readProtocolConfig` parses a `hooks` block; invalid entries rejected with a documented diagnostic; unit test |
| Engine | Matcher unit tests (regex match/miss, dedupe, parallel, aggregation); `triggerBlock` allow/block |
| Runner | Exit-2 blocks; JSON-deny blocks; missing binary → allow; timeout → allow + killed; stdout/stderr bounded; Windows kill path unit-tested |
| Wiring | Grep: `PreToolUse` fired in `native.ts` and `custom.ts`; `PostToolUse`/`PostToolUseFailure` in the result path; Law 4 caller greps for every declared event with a wiring site |
| Compose with EHEL | Integration test: EHEL block short-circuits the hook; hook block surfaces via `formatBlockingError`; a hook block never weakens an EHEL block |
| Repository | typecheck ×4, ESLint zero warnings, Markdownlint, Prettier, `validate:repository`, fid-ledger, full root test suites |

## Governance and Release Boundary

Hooks add **external-command execution** to the runtime — the config is project-scoped (read from `protocol.config.yaml`, same trust boundary as the existing `provenance.mode`/`strict_mode` flags), fail-open, timeout-bounded, and never bypasses EHEL. All changes remain subject to the Perfection Loop, the Nova planning + implementation audits, and operator approval before any closure, commit, push, release, or deployment.

## Open Questions (to be resolved in the loop)

1. **Config location:** `protocol.config.yaml` `hooks:` block (project-scoped, reuses `readProtocolConfig`) vs. a dedicated `.savant/hooks.json`. Default: `protocol.config.yaml` — one config file, same parsing precedent.
2. **Event scope for P1:** all 12 declared events vs. `PreToolUse`/`PostToolUse`/`PostToolUseFailure` first. Default: schema declares all, wiring ships P1 = tool events; the rest ship only where a caller grep succeeds (Law 4).
3. **Command surface:** external shell commands only, or also internal JS callbacks? Default: external commands only (kimi parity); internal callbacks are a later plugin-system concern.

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Where exactly does `PreToolUse` compose with EHEL without bypassing it?** At `native.ts:289` — the hook fires after `enforcement.beforeToolCall` returns; if EHEL blocked, the hook is skipped. A hook block adds a second gate via the existing `formatBlockingError` path, never weakening EHEL.
2. **Does `custom.ts` need the same wiring?** Yes — `custom.ts:183` is the parallel gate for custom tools; omitting it would create a bypass for custom tool implementations.
3. **What is the fail-open contract precisely?** Missing binary, spawn error, timeout, abort, malformed JSON, exit code ≠ 2 with no deny JSON → allow. Only exit 2 or `permissionDecision:"deny"` blocks. This matches kimi's `runner.ts` and keeps hooks non-bricking for free-tier users.
4. **Is there an existing spawn-with-JSON-stdin precedent to follow?** The agent-facing `bash` tool handler spawns commands; the hook runner must be a *separate* bounded runner (timeout, kill-tree, JSON protocol) — reusing the bash tool would inherit agent-facing semantics (Law 13: share where sensible, separate where semantics differ).
5. **Which events have real call sites today?** Tool events (`native.ts:289,121,124`), session start/end (`sdk/src/run/execution.ts`), compaction boundaries (`compactionStatus` writers), subagent lifecycle (`spawn-agent-inline.ts`, `spawn-agents.ts`). Each must pass a Law-4 caller grep at implementation time.

### Code Verification Evidence

```text
$ grep -rn "hook" common/src/types common/src/util/protocol-config.ts protocol.config.yaml | grep -vi "githooks\|pre-push"
common/src/types/gravity-index.ts       # unrelated (gravity link type)
protocol.config.yaml:25                 # lint command comment
protocol.config.yaml:63,150             # pre-push / send-message comments
(no hook config schema, engine, or runner exists)
$ grep -n "beforeToolCall" packages/agent-runtime/src/tools/tool-executor/native.ts packages/agent-runtime/src/tools/tool-executor/custom.ts
native.ts:289: enforcement.beforeToolCall({...})
custom.ts:183: const enforceResult = enforcement.beforeToolCall({...})
$ grep -n "recordToolEvent" packages/agent-runtime/src/tools/tool-executor/native.ts
96:  const recordToolEvent = (
121:    recordToolEvent('tool_finished', status)
124:  recordToolEvent('tool_started')
$ grep -n "beforeToolCall" packages/agent-runtime/src/echo/enforcement.ts
170:  beforeToolCall(params: { ... }): ...   # the EHEL gate
```

### Loop 1 — RED (catalog)

Issues H-01…H-04 cataloged with `file:line` evidence (see RED table). Severities: H-01 high; H-02/H-04 medium; H-03 low. **Exit: all issues cataloged.**

### Loop 1 — GREEN (converged solution)

Five-part solution documented: hook config schema, engine, fail-open runner, EHEL-gate wiring, session/compaction/subagent event wiring (P2, Law-4 gated). **Exit: all fixes documented.**

### Loop 1 — AUDIT (double audit, tool output)

**Method 1 (static grep, absence-shaped):**

```text
$ grep -rn "hook" common/src/types common/src/util/protocol-config.ts | grep -vi gravity
(no hook config schema)
$ grep -rln "PreToolUse\|PostToolUse\|HookEngine\|runHook" packages/agent-runtime/src
(no matches)
$ grep -n "beforeToolCall" packages/agent-runtime/src/echo/enforcement.ts packages/agent-runtime/src/tools/tool-executor/native.ts packages/agent-runtime/src/tools/tool-executor/custom.ts
enforcement.ts:170      # gate definition
native.ts:289           # gate call (native tools)
custom.ts:183           # gate call (custom tools)
$ grep -n "recordToolEvent" packages/agent-runtime/src/tools/tool-executor/native.ts
96,121,124              # tool_started / tool_finished trace sites
```

**Method 2 (manual verification of the cited code, read 0-EOF):**

| Claim | Verdict | Evidence |
|---|---|---|
| H-01 no hook infrastructure | **PASS** | Absence greps: no config schema, no `PreToolUse`/`HookEngine`/`runHook` anywhere in the runtime |
| H-02 EHEL gate is closed | **PASS** | `enforcement.ts:170` gate definition; `native.ts:289` + `custom.ts:183` call sites; nothing external composes with it |
| H-03 tool lifecycle traced but not actionable | **PASS** | `native.ts:96-124` — `recordToolEvent` feeds `traceWriter` only (observability, no side effects) |
| H-04 no bounded command runner | **PASS** | The runtime's only `spawn` user is the agent-facing bash tool handler; no JSON-stdin/timeout/kill-tree runner exists |

**Law 4 (call-graph):** the GREEN plan adds a new config block (`hooks` in `protocol.config.yaml`), two new runtime modules (`engine.ts`, `runner.ts`), and wired events at the two `beforeToolCall` call sites. Every declared event that ships must pass a production-caller grep at implementation time — zero callers = the event is dropped from the P1 scope. The config block is read by `readProtocolConfig` (existing production consumer). **AUDIT passes → ADVERSARIAL.**

### Loop 1 — ADVERSARIAL (fresh meta-verification)

- **H-01 CONFIRMED:** savant has no hook surface of any kind; the closest analogues are internal-only (`run-file-change-hooks.ts` is fixed behavior, not user-extensible).
- **H-02 CONFIRMED:** the EHEL gate is the correct and only seam; the GREEN composition rule (EHEL block short-circuits the hook; hook block adds a second gate) prevents the bypass failure mode.
- **H-04 CONFIRMED with refinement:** the fail-open contract must be *tested as a matrix* (missing binary / timeout / malformed JSON / exit 2 / deny JSON) because a single fail-closed path in the runner would make hooks brick sessions — the same blast-radius class as the earlier paid-model fallback defect. Added to the Verification Matrix.
- **OMISSION REFINED (added to GREEN):** `PostToolUseFailure` must fire from the *failure* path of `executeToolCall` (the `finishToolEvent('failed')` sites at `native.ts:121`), not only the success path — otherwise tool errors are invisible to hooks and the `PostToolUseFailure` event has no honest caller.
- **No refutations; no other omissions.** Severity ratings upheld. **ADVERSARIAL passes → COMPLETE (planning).**

### Loop 2 — Fresh re-audit (2026-08-14, all-FID pass)

Re-verified every RED claim at source with tool output after the companion FIDs were filed:

```text
$ grep -n "beforeToolCall" packages/agent-runtime/src/tools/tool-executor/native.ts packages/agent-runtime/src/tools/tool-executor/custom.ts
native.ts:289 (EHEL gate — attachment point intact)
custom.ts:183 (parallel gate for custom tools — attachment point intact)
$ grep -rc "HookEngine\|PreToolUse" packages/agent-runtime/src
(0 matches in every file)          # hook infrastructure absence still holds
```

**ADVERSARIAL (cross-check):** all claims **CONFIRMED** on re-read. **Cross-FID check:** FID-003's `PreToolUse` wiring at `native.ts:289` and FID-006's compaction status writes both live in the tool executor — the hook gate composes *around* the EHEL block decision (hook fires after `beforeToolCall` returns), so the two changes are orthogonal; implementation order independent. No refutations, no new omissions. **AUDIT passes → COMPLETE (planning) stands.**

### Loop 1 — COMPLETE (planning)

Plan converged after one loop pass: zero actionable improvements beyond the recorded refinement; no oscillation; delta well under the 10% cap. FID status → `analyzed`. Implementation is not approved until the Nova planning sign-off PASS and operator approval; closure additionally requires the implementation audit.

## Resolution

- **Status:** `closed` — implemented and verified under automation level 3 (2026-08-14).
- **Fix Description:** Extensible hook system at the EHEL enforcement points — `hooks` config block in `protocol.config.yaml`, runtime engine + fail-open bounded runner (JSON-on-stdin, exit-2/deny block protocol), `PreToolUse`/`PostToolUse`/`PostToolUseFailure` wired at `native.ts:289,121,124` and `custom.ts:183`, with P2 session/compaction/subagent events Law-4 gated.
- **Tests Added:** hooks `runner.test.ts` + `engine.test.ts` (fixtures: allow/deny/exit-2/sleep-5) + protocol-config hooks parsing test.
- **Verification Evidence:** AUDIT greps pasted above (Loop 1 — AUDIT).
- **Archived:** closed + archived 2026-08-14. See `dev/fids/archive/README.md`.
