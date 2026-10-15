<!-- markdownlint-disable MD013 -->

# FID: Runtime Execution Boundaries and Structured Trace

**Filename:** `FID-2026-0809-005-runtime-execution-boundaries.md`
**ID:** FID-2026-0809-005
**Severity:** high
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** This is a design/convergence artifact only. Do not refactor the agent
> runtime, add tracing, change loop semantics, or alter performance behavior until final operator
> approval and Nova sign-off. No implementation authorization is implied by convergence.

---

## Summary

The shared agent runtime now contains explicit setup, context preparation, programmatic steps, model
steps, stream parsing, tool execution, compaction, steering, ECHO checks, retries, cost aggregation,
completion, error, cancellation, and cleanup paths. Several optimizations already exist, but the
runtime remains difficult to measure and reason about because lifecycle policy and orchestration are
interleaved. This FID proposes bounded structured execution tracing, explicit runtime phase boundaries,
pure decision helpers where practical, and deterministic tests proving terminal cleanup without
performing a wholesale rewrite.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun; shared `@savant-code/agent-runtime`; SDK/CLI consumers
- **Tool Versions:** Bun `1.3.14`; strict TypeScript
- **Commit/State:** `main`; baseline gate results are not asserted by this planning artifact; planning-only
- **Dependencies:** FID-0809-010 bootup prerequisite; FID-0809-003 metadata; FID-0809-004 validation parity; state/subagent FIDs depend on boundary decisions

## Detailed Description

### Problem

`loopAgentSteps`, `createLoopContext`, `runLoopIteration`, `runAgentStep`, `processStream`, and
native tool execution collectively implement a large lifecycle. The runtime intentionally mutates
shared `AgentState`, replaces message-history arrays at important boundaries, and handles many error
classes. This is valid behavior but creates high coupling and weak performance visibility.

### Expected Behavior

Each run should have a bounded, structured trace that records:

- run and agent identity;
- step/iteration number;
- phase start/end and duration;
- tool start/end and status;
- compaction and retry reason;
- terminal status and cleanup completion.

The trace must not include credentials, full prompts, unbounded message history, or sensitive tool
inputs. Every terminal path must produce a terminal trace outcome and execute cleanup.

### Evidence

```text
packages/agent-runtime/src/run-agent-step/loop.ts
  owns loop setup, normal completion, abort, reactive compact retry, error output,
  finishAgentRun, and finally cleanup.

packages/agent-runtime/src/run-agent-step/loop-iteration.ts
  combines context preparation, programmatic execution, model execution, output retry,
  steering, ECHO compliance, protocol refresh, and step bookkeeping.

packages/agent-runtime/src/tools/stream-parser.ts
  combines stream consumption, tool-call chaining, abort behavior, tool-result history,
  and generator cleanup.

sdk/src/run/execution.ts
  adds snapshots, handler dispatch, cancellation state, and final run settlement.
```

### Impact Assessment

- Runtime regressions can occur at interactions between lifecycle policies.
- Error and abort paths can preserve different state unless tested together.
- Performance work lacks a single comparable trace.
- Full logging is unsafe and too expensive; summary logging alone is insufficient for profiling.

### Risk Level

- [ ] Critical
- [x] High: complex execution paths can regress correctness/performance
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Add a small internal runtime phase model and bounded trace sink. Keep the existing orchestration
until measurements identify a justified extraction. Represent decisions such as retry, continuation,
compaction, and cleanup as pure or isolated helpers where practical. Establish performance baselines
before enforcing hard thresholds.

### Steps

1. Inventory all terminal and retry paths.
2. Define trace event categories and redaction/size limits.
3. Add phase timing at the existing boundaries.
4. Add terminal/cleanup markers in normal, abort, retry, and error flows.
5. Add deterministic mocked-provider/tool tests for trace completeness.
6. Measure context preparation, model wait, tool execution, snapshots, compaction, and cleanup.
7. Only then propose targeted extractions or caching changes in a follow-on FID if needed.

### Verification

- Tests prove every phase start has an end, cancellation, or terminal error.
- Tests prove every terminal path invokes cleanup.
- Trace payloads remain bounded and contain no full prompt/credential content.
- Deterministic performance fixtures produce stable measurements.
- No continuation/termination semantics change without separate approval.
- Full project validation passes after implementation.
- Call-graph searches prove the trace is wired through SDK/CLI runtime entry points.
- Implementation remains blocked pending operator approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Runtime responsibility is distributed across loop setup, iteration, stream, tools, SDK
  settlement, compaction, and ECHO paths. Existing optimizations reduce some duplication but do not
  provide one bounded lifecycle trace or complete terminal-path proof.
- **GREEN:** Proposed instrumentation-first work: explicit phases, bounded trace, cleanup proofs,
  deterministic performance baseline, and no premature wholesale refactor.
- **AUDIT:** Evidence cites `packages/agent-runtime/src/run-agent-step/loop.ts:29`,
  `loop-iteration.ts:59`, `packages/agent-runtime/src/tools/stream-parser.ts:38`, and
  `packages/agent-runtime/src/tools/tool-executor/native.ts:65` as the principal lifecycle boundaries.
  No code was changed and no performance claim is made.
- **AUDIT ADVERSARIAL CHECK:** Tracing itself can increase memory/log cost. The plan therefore
  requires bounded events, redaction, and disabled/no-op behavior where appropriate before any implementation.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that runtime instrumentation must observe an explicitly selected protocol variant; otherwise trace data could label harness and single-agent runs inconsistently.
- **GREEN:** Added the bootup prerequisite relationship through the master plan without expanding runtime tracing into protocol implementation or a wholesale refactor.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; runtime boundaries remain cited at `packages/agent-runtime/src/run-agent-step/loop.ts:29`, `loop-iteration.ts:59`, `packages/agent-runtime/src/tools/stream-parser.ts:38`, and `packages/agent-runtime/src/tools/tool-executor/native.ts:65`. No implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** The dependency prevents ambiguous measurements but does not authorize tracing, performance thresholds, or semantic changes.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Should the first FID refactor the entire loop?** → No. Instrument and measure first; extraction
   follows evidence.
2. **Should full message histories be traced?** → No. Record counts, IDs, sizes, hashes, and reason
   codes; full content remains outside the runtime trace.
3. **What is a terminal path?** → Normal completion, user abort, provider/tool error, prompt-too-long
   retry exhaustion, payment error, setup cancellation, and stream failure.
4. **Should timing thresholds immediately fail CI?** → No. Establish a baseline first; promote only
   repeatable regressions to hard gates.
5. **How is trace overhead controlled?** → Bounded per-run entries, bounded payload fields, and a
   configurable/no-op sink with no semantic effect.

### Code Verification Evidence

- [x] Runtime loop, iteration, context, stream, and SDK execution paths inspected.
- [x] Existing cleanup and compaction behavior identified at the runtime boundaries cited above.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] Runtime implementation — prohibited pending approval and Nova sign-off.
- [ ] Performance measurements — intentionally pending implementation.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Runtime boundaries are instrumented with bounded, redacted evidence while preserving behavior.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

Runtime optimization should begin with observability. Without a bounded trace, a refactor can trade
one hidden coupling for another while appearing faster in a single path.

## Closure Evidence

- **FID:** FID-2026-0809-005
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
