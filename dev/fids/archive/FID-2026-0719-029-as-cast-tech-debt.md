# FID-2026-0719-029 — `as` Cast Pre-existing Tech Debt (composio + tool-executor)

**Filename:** `FID-2026-0719-029-as-cast-tech-debt.md`
**ID:** FID-2026-0719-001
**Severity:** low
**Status:** closed
**Created:** 2026-0719 00:00
**Author:** Historical record (metadata backfill)

---

## Metadata Normalization Note

This historical record was normalized on 2026-07-31 for FreeBuff ECHO v0.1.2 compliance. The original body and evidence are preserved. Original status: `closed / archived`; Original ID: `FID-2026-0719-029-as-cast-tech-debt`. Canonical ID: `FID-2026-0719-001`. Backfilled fields: Filename, ID, Created, Author. Canonical status reflects the record's lifecycle location; it does not add implementation evidence.

**Date:** 2026-07-19
**Severity:** low
**Status:** closed / archived
**Context:** v0.0.3 rebrand push — ECHO Protocol compliance audit

## Summary

Two `as` casts in `packages/agent-runtime` are retained as accepted pre-existing
technical debt. They sit at the boundary between structurally-typed Zod object
representations and conditionally-resolved generic boundaries
(`T extends ClientToolName ? T : never`).

## Locations

### 1. `packages/agent-runtime/src/tools/handlers/tool/composio.ts`

A single `as ClientToolCall<T extends ClientToolName ? T : never>` cast inside the
composio handler's `makeComposioHandler` function. Bridges the field-constructed
clientToolCall object's `input` from `SavantCodeToolCall<T>['input']` to
`ClientToolCall<T>['input']`.

**Root cause:** `SavantCodeToolCall<T>['input']` derives `input` directly via
`z.infer<(typeof toolParams)[T]['inputSchema']>`. `ClientToolCall<T>['input']`
derives `input` via `Extract<z.infer<typeof clientToolCallSchema>, { toolName: T }>`,
which goes through the runtime `clientToolCallSchema` discriminated union (with
`.and(z.object({ mode: z.enum(['assistant', 'user']) }))` for run_terminal_command).
Both types ultimately resolve to structurally equivalent runtime data, but
TypeScript treats them as distinct nominal identities.

### 2. `packages/agent-runtime/src/tools/tool-executor.ts`

A `as SavantCodeToolOutput<T extends ClientToolName ? T : never>` cast inside the
runtime `requestClientToolCall` closure (and a similar cast on the abort return).

**Root cause:** The closure's `T` parameter (the `executeToolCall<T extends ToolName>`'s
generic) is unresolved at the call site, so the cast bridges the runtime SDK return
value to the statically-resolved `SavantCodeToolOutput<T>` shape that the slot
expects. TypeScript cannot prove the boundary alignment for generic T without this.

## Decision

**Accepted as pre-existing tech debt.** Per ECHO Law 6, `as` casts are forbidden,
but in the v0.0.3 push scope, removing these requires restructuring the entire
`executeToolCall<T>` pipeline generics, which would cascade errors across ~50
files with zero runtime validation benefit (the runtime SDK already validates via
`clientToolCallSchema.parse(...)` at the SDK boundary in `sdk/src/run.ts:849`).

## Path forward (post-push)

1. Introduce `RunTerminalCommandClientToolCall` typed intersection declared at
   the boundary only — decouples the generic type from concrete tool names.
2. Add a user-defined type guard `assertSavantCodeToolMatchesClientTool(x: unknown):
   asserts x is ClientToolCall<...>` that performs `clientToolCallSchema.parse(...)`
   at the trust boundary and narrows without `as`.
3. Update `requestClientToolCall` slot to use a generic-typed closure parameter
   rather than the inline conditional `T extends ClientToolName ? T : never`.

## Verification

- x4 typecheck gate (sdk, common, agent-runtime, cli) is GREEN with these casts.
- Runtime schema validation at SDK boundary in `sdk/src/run.ts:849`:
  `clientToolCallSchema.parse(action)` continues to enforce runtime safety.
- ECHO Law 6 violations limited to 2 documented locations; rest of codebase is
  cast-free.

## Audit trail

- commit: FID-2026-0719-029 §COMPLETE: accepted cast tech debt archived
- nova sign-off: dev/nova/outbox/2026-07-19-fid-029-as-cast-tech-debt.md (TBD)


## Test-Only `as unknown` Casts

The following tests use `as unknown as AgentDefinition[]` to simulate runtime type mismatches for validator testing:

- `sdk/src/__tests__/validate-agents.test.ts` (lines ~355 and ~592).


## Test-Only `as` Casts (additional, V0.0.3 push gate)

- `sdk/src/__tests__/credentials.test.ts` � 5 `as unknown as ClientEnv` boundary casts at lines ~101, ~114, ~199, ~222, ~283. These construct non-canonical env values (env strings like `'nonexistent'`, `'chatgpt-no-creds'`) to test the function reading an arbitrary string at runtime. The runtime path doesn't validate against the zod enum, so the test must bypass.
- `sdk/src/__tests__/validate-agents.test.ts` � 2 `as unknown as AgentDefinition[]` casts at the 'bad-handle-steps' (handleSteps: 'not a function') and 'invalid-json-schema' (type: 'invalid-type', properties: null) tests. Simulate runtime type mismatches so the validator exercises the rejection path.

All test-only casts are documented here per ECHO Law 6 trust-boundary principle; production source code should continue to avoid `as` casts except for the 3 FID-029 production-line cases (composio 1x, tool-executor 2x).
