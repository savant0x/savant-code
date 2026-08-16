<!-- markdownlint-disable MD013 -->

# Nova Planning Sign-off Request — FID-2026-0814-003 (Extensible Hook System)

**Date:** 2026-08-14
**Scope:** Planning review of a feature FID that ports kimi-code's hook architecture to savant: a `hooks` config block in `protocol.config.yaml`, a runtime engine + fail-open bounded runner (JSON-on-stdin, exit-2/deny block protocol), `PreToolUse`/`PostToolUse`/`PostToolUseFailure` wiring at the EHEL gate (`native.ts`/`custom.ts`), and P2 session/compaction/subagent events (Law-4 gated).
**Status:** REQUESTED
**Priority:** High (the missing extensibility layer; every lifecycle policy is currently hard-coded)

## Request

Please independently audit the **planning** FID below and return one of:

- `PASS — planning approved for operator decision`
- `FAIL — planning requires self-correction`
- `NEEDS-REVIEW — evidence boundary cannot be evaluated`

This is a **planning sign-off request**. A PASS verifies the plan's ground-truth claims against the repo; it does **not** authorize implementation, closure, commit, push, release, publication, or deployment. Implementation (and a separate implementation-audit request) follows operator approval.

## Record under review

`dev/fids/FID-2026-0814-003-extensible-hook-system.md` — status `analyzed` (planning-converged via the Perfection Loop with AUDIT + ADVERSARIAL + a fresh Loop-2 re-audit).

## What the FID claims (verify each at source)

| ID | Claim | Cited source |
|---|---|---|
| H-01 (high) | No user-extensible hook system exists — every lifecycle policy must be hard-coded | Absence greps: `hook` config/schema in `common/src/types` (only `gravity-index.ts` unrelated), `protocol.config.yaml`, `packages/agent-runtime/src` (no `HookEngine`/`PreToolUse` anywhere) |
| H-02 (medium) | The EHEL gate is closed — no project-extension seam at the enforcement point | `echo/enforcement.ts:170` (`beforeToolCall`); `native.ts:289` + `custom.ts:183` (the only two call sites) |
| H-03 (low) | Tool lifecycle events are traced but not actionable | `tools/tool-executor/native.ts:96-124` (`recordToolEvent` → `traceWriter` only) |
| H-04 (medium) | No bounded external-command runner (timeout/kill/JSON protocol) exists in the runtime | The only `spawn` user is the agent-facing bash tool handler; no JSON-stdin/timeout/kill-tree runner |

## Hard questions Nova must verify at source

1. **No hook infrastructure.** Confirm `grep -rln "HookEngine\|PreToolUse\|runHook" packages/agent-runtime/src` → 0 matches and `grep -rn "hook" common/src/util/protocol-config.ts` → no config schema (only the pre-push comment matches in `protocol.config.yaml`).
2. **Attachment points are real.** Confirm `beforeToolCall` is defined at `echo/enforcement.ts:170` and called at exactly `native.ts:289` and `custom.ts:183` — the two places a `PreToolUse` hook can compose with EHEL.
3. **Trace-only lifecycle.** Confirm `recordToolEvent('tool_started'/'tool_finished')` (`native.ts:96-124`) feeds `traceWriter` only — no side effects.
4. **No bounded runner.** Confirm the runtime has no spawn-with-JSON-stdin/timeout/kill-tree runner besides the agent-facing bash tool handler.
5. **Composition rule (no bypass).** Confirm the GREEN claim that a `PreToolUse` hook fires **after** `enforcement.beforeToolCall` returns (EHEL block short-circuits the hook) — the plan must never let a hook weaken an EHEL block.
6. **PostToolUseFailure wiring point.** Confirm the failure path of `executeToolCall` reaches `finishToolEvent('failed')` (`native.ts:121`) so `PostToolUseFailure` has an honest caller (the ADVERSARIAL refinement).

## Adversarial checks already run in the FID's Perfection Loop

- **Fail-open is mandatory**: missing binary, timeout, abort, malformed JSON, exit ≠ 2 without deny-JSON → allow. Only exit 2 or `permissionDecision:"deny"` blocks. Tested as a matrix — one fail-closed path would brick sessions.
- Windows kill-tree semantics (`taskkill /T`) mirror kimi's `killProcessTreeWindows`; `windowsHide: true` for the shell spawn.
- EHEL wins over hooks, never the reverse.
- Every declared P2 event (session/compaction/subagent) must pass a Law-4 production-caller grep at implementation time — an event with zero call sites is dropped from scope.

## Authorization boundary

This request authorizes no implementation, closure, commit, push, release, publication, or deployment. A PASS marks the plan converged and code-grounded; operator approval is then required before any code, and a separate implementation-audit request must precede closure.

## Expected response

1. Overall verdict.
2. Verdict per hard question with `path:line` + quoted code/command output.
3. Any missing citation, scope contradiction, or unverified claim.
4. Explicit confirmation this is planning review only and does not authorize production changes or release activity.
