# Nova Audit Request — FID-2026-0801-005 Thinker Agent Tool Cascade Fix

**Date:** 2026-08-01
**From:** Savant Orchestrator (FreeBuff ECHO v0.1.2)
**To:** Nova — independent third-party ECHO auditor
**FID:** `dev/fids/archive/FID-2026-0801-005-thinker-agent-tool-cascade-bug.md`
**Priority:** Critical — independent post-implementation sign-off
**Method requested:** Source-verified review. Read the referenced files 0–EOF, independently inspect the implementation, and apply the Cross-Agent Claim Rule. Do not modify source files.

---

## Review Boundary

This request asks Nova to independently verify the completed implementation and provide a written verdict. It does not request additional coding, scope changes, FID edits, archival changes, commits, pushes, publishing, or deployment.

The FID was approved by the operator before implementation, completed through its Perfection Loop, and archived. Nova’s response must not be treated as a substitute for operator approval or as authorization for additional implementation.

## Issue Under Review

A child agent inheriting the parent system prompt and tool context could receive parent-only tool definitions even though the child executor authorized only the child template’s `toolNames`. The Thinker is the representative case:

```text
inheritParentSystemPrompt: true
includeMessageHistory: true
spawnableAgents: []
toolNames: ['sequentialthinking']
```

The intended invariant is that model-visible tool definitions, child state tool definitions, and executor authorization all agree with the effective child `toolNames` allowlist.

## Implementation Claims to Verify

### Claim 1 — Shared filter is strictly typed

Verify `packages/agent-runtime/src/tools/filter-tool-set.ts`:

- It accepts a concrete AI SDK `ToolSet`.
- It accepts a readonly tool-name allowlist.
- It returns a concrete `ToolSet`.
- It has no `undefined` fallback, `any`, or unsafe permission broadening.

### Claim 2 — Final model-facing boundary is filtered

Read `packages/agent-runtime/src/run-agent-step.ts` 0–EOF and verify:

- `filterToolSet` is used when inherited parent tools are selected.
- The effective child `agentTemplate.toolNames` is the allowlist.
- The existing executor authorization remains separate and strict.

### Claim 3 — Ordinary spawn handoff is filtered

Read `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts` 0–EOF and verify:

- The child template is resolved before filtering.
- Parent tools are filtered against the effective child template.
- Only the filtered set is passed to `executeSubagent`.

### Claim 4 — Inline spawn handoff and child state are filtered

Read `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts` 0–EOF and verify:

- The inline effective template’s `toolNames` controls filtering.
- `childAgentState.toolDefinitions` contains only filtered tools.
- The filtered set, not the original parent set, is passed to `executeSubagent`.

### Claim 5 — Thinker declaration and executor security boundary remain intact

Read:

- `agents/thinker/thinker.ts`
- `packages/agent-runtime/src/tools/tool-executor.ts`

Verify:

- Thinker still declares only `sequentialthinking`.
- The executor still rejects forged unauthorized tool calls.
- The implementation does not broaden permissions to hide the cascade.

### Claim 6 — Regression tests inspect the actual model payload

Read and assess:

- `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`
- `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts`
- `packages/agent-runtime/src/__tests__/tool-validation-error.test.ts`

Verify that the tests cover:

- Allowed inherited tools remain available.
- Forbidden parent tools are absent from the child model payload.
- Empty child allowlists produce no tools.
- Child state tool definitions match the filtered model payload.
- Existing executor/tool-validation behavior remains covered.

### Claim 7 — Verification gates passed

The implementation record claims the following results. Independently verify where possible and report exact command status:

- 68 focused tests passed, 0 failed, 171 expectations.
- `sdk` typecheck passed.
- `common` typecheck passed.
- `packages/agent-runtime` typecheck passed.
- `cli` typecheck passed.
- ESLint passed with zero warnings on changed files.
- Prettier check passed.
- `git diff --check` passed.
- Call-graph grep confirmed all three `filterToolSet` production callers.

## Files to Read

1. `dev/nova/specs/echo-v0.1.2-freebuff.md`
2. `dev/fids/archive/FID-2026-0801-005-thinker-agent-tool-cascade-bug.md`
3. `packages/agent-runtime/src/tools/filter-tool-set.ts`
4. `packages/agent-runtime/src/run-agent-step.ts`
5. `packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts`
6. `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts`
7. `packages/agent-runtime/src/tools/tool-executor.ts`
8. `packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts`
9. `packages/agent-runtime/src/__tests__/spawn-agents-permissions.test.ts`
10. `packages/agent-runtime/src/__tests__/tool-validation-error.test.ts`
11. `agents/thinker/thinker.ts`
12. `CHANGELOG.md`

## Suggested Safe Commands

Run only read-only verification commands. Do not modify, archive, commit, push, publish, or deploy.

```text
cd packages/agent-runtime && bun run typecheck
cd packages/agent-runtime && bun test src/__tests__/prompt-caching-subagents.test.ts src/__tests__/spawn-agents-permissions.test.ts src/__tests__/tool-validation-error.test.ts
cd sdk && bun run typecheck
cd common && bun run typecheck
cd cli && bun run typecheck
bun x eslint packages/agent-runtime/src/tools/filter-tool-set.ts packages/agent-runtime/src/run-agent-step.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts --max-warnings 0
bun x prettier --check packages/agent-runtime/src/tools/filter-tool-set.ts packages/agent-runtime/src/run-agent-step.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts packages/agent-runtime/src/__tests__/prompt-caching-subagents.test.ts
git diff --check
grep -R -n --include='*.ts' 'filterToolSet' packages/agent-runtime/src
```

If a command is unavailable or fails because of the environment, report the exact fact. Do not convert missing output into PASS.

## Required Nova Response

Please create the independent response in the Nova inbox using the established response convention.

```markdown
# Nova Third-Party Audit Response — FID-2026-0801-005

**Date:** YYYY-MM-DD
**Auditor:** Nova / external auditor identity
**Request:** `2026-08-01-fid-005-thinker-tool-cascade-nova-signoff-request.md`
**FID:** `FID-2026-0801-005`

## VERDICT: PASS | CONDITIONAL | FAIL

## Sign-Off Decision
- Independent post-implementation sign-off: YES | NO
- Critical/high blockers: None | [list]
- Additional corrections required: None | [list]
- This verdict authorizes new coding: NO unless explicitly stated by the operator in a separate approval record

## Verified Claims
- Claim 1: PASS | FAIL | UNVERIFIED — evidence
- Claim 2: PASS | FAIL | UNVERIFIED — evidence
- Claim 3: PASS | FAIL | UNVERIFIED — evidence
- Claim 4: PASS | FAIL | UNVERIFIED — evidence
- Claim 5: PASS | FAIL | UNVERIFIED — evidence
- Claim 6: PASS | FAIL | UNVERIFIED — evidence
- Claim 7: PASS | FAIL | UNVERIFIED — evidence

## ECHO Compliance
- Laws 1–4 assessment
- Type-safety assessment
- Call-graph assessment
- Separation-of-duties assessment

## Commands and Results
- Command: ...
- Exit status: ...
- Result: ...

## Final Nova Statement
State clearly whether Nova grants independent sign-off for the completed FID, and list any conditions or remaining evidence gaps.
```

A `CONDITIONAL` or `FAIL` verdict must be treated as a blocker for claiming Nova sign-off. A `PASS` is independent audit evidence only; it does not replace operator authority or authorize unrelated changes.
