# FID: Enforce combined request token budgets at the provider boundary

**Filename:** `FID-2026-1002-003-request-token-budget-enforcement.md`
**ID:** FID-2026-1002-003
**Severity:** high
**Status:** verified
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Known input-window and output-cap metadata is resolved separately and forwarded
without a combined request-budget check. The provider can reject an ordinary
continuation even at low input utilization. One model boundary must enforce the
budget on final provider prompts for every SDK-backed caller.

## Environment

Windows, Bun 1.3.14, strict TypeScript monorepo, existing uncommitted audit work.
No commit or remote mutation authorized. Task T112 owns this implementation.

## Detailed Description

### Problem

The provider rejection that motivated this FID, quoted verbatim from the
operator-pasted failure transcript:

```text
This model configuration accepts at most 1048576 combined input and output tokens. However, your request has 112977 input tokens and asks for 943717 output tokens (1056694 tokens total). Please reduce the input length or requested output length.
```

Input 112977 + output allowance 943717 = 1056694, exceeding the provider's
combined limit 1048576 by 8118 tokens. The operator believes the selected
model was GLM 5.3 Flash; its exact gateway is unconfirmed. The transcript was a
scratch input file, deleted after this quotation captured the evidence; the
`.markdownlintignore` exemption created for it was withdrawn with it.

### Expected Behavior

Final estimated input + output allowance + safety reserve fits the effective
known serving window. Requests with no input headroom fail locally through the
existing compaction signal. A smaller reported limit corrects that route and
permits at most one retry before model output is delivered.

### Root Cause

- `cli/src/utils/openrouter-models/lookup.ts:274` resolves an output cap alone.
- `sdk/src/impl/llm/stream.ts:53` forwards it through `streamText` unchanged.
- `packages/agent-runtime/src/context-compactor.ts:183` checks input utilization
  without an output reservation. Provider metadata can describe upstream
  capability while a gateway serves a smaller window.
- `packages/agent-runtime/src/context-compactor/phases.ts:74` does not recognize
  the observed combined-limit wording.

### Evidence

Read-only offline probes of production functions:

```text
resolveMaxOutputTokensForModel(fixture): 943717
buildOpenAICompatibleChatArgs(fixture).args.max_tokens: 943717
isPromptTooLongError(observed message): false
isPromptTooLongError(observed message + statusCode 400): false
resolveTriggerThreshold(1048576, 0.8): 838860
```

## Impact Assessment

### Affected Components

Shared model-limit knowledge, gateway catalog publication, SDK provider routing,
streaming and generation boundaries, runtime stream contract, overflow detection.

### Risk Level

- [x] Medium: requests fail; reducing the output allowance preserves the prompt.

Counting reuses the existing conservative tokenizer. Multimodal tokens remain
estimates. No claim is made that unavailable/stale provider metadata or an
approximate tokenizer makes every possible remote rejection impossible. Unknown
output caps stay omitted rather than inventing a model capability. The retry
only wraps initial provider dispatch, never a partially delivered stream.

## Proposed Solution

### Approach

Wrap every model returned by `getModelForRequest` using the existing AI SDK model
middleware interface. Both doGenerate and doStream then share the same pure
budget policy, final-prompt counter, and bounded correction. Keep metadata keyed
by exact routing identity, never fuzzy model family. Publish the existing CLI
catalog into common knowledge so SDK subagents use their own model's limits.

### Steps

1. Add shared validated route limits and structured provider-limit parsing;
   smaller observed limits override catalog capabilities for the same route.
2. Add final V2 prompt/tool counting and output budgeting with a bounded reserve;
   reject exhausted input before dispatch. Preserve caller output ceilings and
   omitted unknown caps. Reject malformed explicit budgets.
3. Wrap all provider routes, thread explicit context and logging through stream
   and generation entry points, and correct/retry one rejected initial dispatch.
4. Publish exact catalog route limits and recognize the combined-limit wording
   in the existing compaction classifier. Test direct gateway precedence.
5. Run meaningful request-boundary regressions, workspace and repository gates;
   document behavior and limitations. Leave the verified FID active until commit
   authorization, as required by G2.

### Verification

- `common/src/__tests__/model-request-limits.test.ts`: isolated route knowledge,
  catalog/observed limits, hostile metadata and observed error parsing.
- `sdk/src/impl/__tests__/request-budget.test.ts`: observed numbers, final prompt
  and tools, generation and streaming, caller caps, zero headroom, one recovery,
  unknown caps and malformed inputs; assert underlying dispatch arguments/count.
- `cli/src/utils/__tests__/openrouter-models-max-output.test.ts`: exact gateway
  limit precedence and continued catalog lookup behavior.
- `packages/agent-runtime/src/__tests__/request-budget-recovery.test.ts`:
  actual recorded wording recognized by the existing compaction authority.
- `sdk/src/impl/__tests__/request-budget-transport.test.ts`: inspect real wire
  bodies through all three SDK entry points, child-model and bare-slug routes,
  and HTTP 400 correction. Two existing streaming tests now register AI mocks
  through the shared restore helper; the previous leaks masked real transport.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test common/src/__tests__/model-request-limits.test.ts
- gate: test sdk/src/impl/__tests__/request-budget.test.ts
- gate: test sdk/src/impl/__tests__/request-budget-transport.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-max-output.test.ts
- gate: test packages/agent-runtime/src/__tests__/request-budget-recovery.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:104a88470135c455474a107c76560bd7a5cb96ac36c35cd4d7fcc3ce207414fa
- verified: 2026-10-03T01:07:14.679Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test common/src/__tests__/model-request-limits.test.ts: exit 0
- test sdk/src/impl/__tests__/request-budget.test.ts: exit 0
- test sdk/src/impl/__tests__/request-budget-transport.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-max-output.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/request-budget-recovery.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Production probes reproduced unchanged output allowance and missed recovery.
Call-graph search finds all three SDK prompt entry points using
`getModelForRequest`: stream-request-setup.ts and both prompts.ts functions.
Runtime subagents and gateway runs converge through these entry points.

### GREEN

Use the existing provider model middleware boundary instead of independent CLI
guards. Share route knowledge in common; reuse the runtime tokenizer. Apply the
policy to final V2 arguments after SDK tool/prompt conversion. Keep output
capacity distinct from requested output and never destroy history to fit a
large advertised allowance.

### AUDIT

Local AI SDK declarations expose `wrapLanguageModel` and V2 middleware for both
generate and stream dispatch. getModelForRequest owns OAuth, prefixed registry,
and bare-slug routes. One exported wrapper covers each return through the same
boundary. One retry on a caught initial dispatch error cannot replay delivered
tool calls. Provider observations must be route-specific and monotone downward.

### Missed Questions

- Does a model cap imply that cap fits every request? No; recompute headroom.
- Can catalog metadata be wrong? Yes; consume exact serving limits and retain
  smaller observations. Never use an observation to enlarge a capability.
- Are token counts exact? No; preserve conservative counting and an explicit
  safety reserve. Provider-reported input applies only to that rejected prompt.
- Does compaction solve an excessive output reservation? Prefer reducing the
  reservation without losing context. Compact only when input cannot fit.
- What about SDK calls without CLI metadata? Use explicit caller limits or the
  existing exact fallback table; retain the documented default when unresolved.

### Convergence

The design reuses existing route, tokenizer and retry authorities. It addresses
the failing invariant across dispatch modes. Implementation evidence follows.

### Implementation Audit

Static call-graph review confirms getModelForRequest wraps the OAuth, prefixed
registry, and bare-slug factories. Both generation entry points and stream
setup pass caller context. Final V2 middleware sees converted prompts/tools on
every dispatch. Caller provider-option output overrides cannot bypass the cap.

Dynamic tests reproduce the original arithmetic: 112977 input + 931503 output
and 4096 reserve fit 1048576. Stale-limit recovery changes the wire allowance once;
post-return stream errors never trigger replay. Shared knowledge separates
OpenRouter vendor IDs from direct provider IDs and ignores malformed limits.

The full SDK run exposed leaking AI mocks in two existing suites. Registering
them through the existing restore helper fixes contamination; the production
stream now runs in the transport regression even when all SDK suites share a
process. The Windows detached-child test requires unsandboxed taskkill; its
unrestricted rerun passed. No production process-cancellation changes made.

The pasted failure transcript contained raw tool-call formatting that fails
Markdown lint. It was scratch input, not project work: it is deleted, its
`.markdownlintignore` exemption is withdrawn, and the evidence it carried is
quoted verbatim under Detailed Description above so the record survives the
file. (Correction, 2026-10-03: this section originally exempted that transcript
by citing `continue.md` / `docs/lastsession.md` as precedent. Both were scratch
files that no longer exist — untracked, never committed, since deleted — so
that precedent chain was dead on both ends and carried no authority. No
`continue.md` or `docs/lastsession.md` entry is created or restored.)

## Implementation Evidence

### Code Verification Evidence

Production reachability, re-grepped 2026-10-03 against the working tree
(compile success is not wiring; each new function has a non-test caller):

- `sdk/src/impl/model-provider.ts:58` — `getModelForRequest` is the single
  wrapping point: `applyModelRequestBudget(await resolveModelForRequest(...))`.
- `sdk/src/impl/model-provider/apply-request-budget.ts:41` — calls
  `withRequestTokenBudget(result.model, …)`; sole production caller of the
  wrapper is this module.
- `sdk/src/impl/model-provider/request-budget.ts:134` — the exported wrapper.
  Referenced by `apply-request-budget.ts:5` and the budget suite; no other
  production importer exists, which is correct: `getModelForRequest` is the
  only boundary.
- Three production call sites reach that boundary, so all SDK dispatch modes
  are covered: `sdk/src/impl/llm/prompts.ts:52` and `:110` (both generation
  entry points) and `sdk/src/impl/llm/stream-request-setup.ts:57`.
- `request-budget.ts:75` calls `countRequestInputTokens`
  (`request-token-count.ts:30`) before every dispatch; `:104` validates the
  caller window through `assertTokenBudget`
  (`request-budget-policy.ts:28`); `:129` applies the pure policy
  `budgetModelRequest` (`request-budget-policy.ts:73`).
- `request-budget.ts:42` parses a rejected dispatch with
  `parseProviderTokenLimitError` (`common/src/util/provider-token-limit-error.ts:13`),
  whose only other production consumer is the compaction authority at
  `packages/agent-runtime/src/context-compactor/phases.ts:77`. That function is
  reached by `context-compactor.ts:278` and, from there, by
  `run-agent-step/loop/reactive-compact.ts:84` — the recorded wording is
  classified on the live reactive-compaction path, not only in tests.
- `cli/src/utils/openrouter-models/gateway.ts:83` publishes route limits via
  `modelRequestLimits.replaceCatalog(catalog, 'openrouter')` inside
  `notifyGatewayCatalogListeners`, called from the fresh fetch (`:208`) and the
  disk warm-start (`:136`), so SDK subagents inherit catalog knowledge without
  their own metadata.
- `common/src/util/model-request-limits.ts:114` exports the single store
  instance the SDK reads (`.get`/`.getCatalog`) and writes (`.observe`), keyed
  by exact catalog + hashed-endpoint route identity.

Implementation sites:

- `sdk/src/impl/model-provider.ts:55`: getModelForRequest applies the shared wrapper.
- `sdk/src/impl/model-provider/request-budget.ts:134`: generation/stream wrappers;
  line 69 budgets dispatch and line 33 bounds recovery to a helpful correction.
- `sdk/src/impl/model-provider/request-budget-policy.ts:73`: ceiling and reserve
  policy; line 18 supplies the compaction-recognized local overflow error.
- `sdk/src/impl/model-provider/request-token-count.ts`: final prompt/tool count.
- `common/src/util/model-request-limits.ts`: exact route catalog and smaller
  observations; `provider-token-limit-error.ts`: explicit limit parser.
- `cli/src/utils/openrouter-models/gateway.ts:83`: publish fresh/disk-warmed catalogs.
- `packages/agent-runtime/src/context-compactor/phases.ts:77`: recorded combined
  wording reaches the existing compaction classifier.
- `docs/request-token-budgets.md`: behavior and honest serving/tokenizer limits,
  including the OAuth transport's deliberately unsupported output parameters.

Broad checks already passed: root typecheck across all workspaces/scripts;
SDK source suite 570 pass / 1 POSIX-only skip; common suite 739 pass / 4 symlink
skips; CLI model-catalog family 99 pass; compaction/recovery family 23 pass;
ESLint zero warnings; Markdown lint, formatting and quality pass. Ten declared
gates passed; the final receipt is stamped below by the project verifier.

## Resolution

Implemented under the level-3 task instruction. Closure is blocked only on G2:
the operator has not authorized a commit. No commit, push or FID archival done.

## Lessons Learned

Model metadata becomes protection only when final request dispatch enforces it.
