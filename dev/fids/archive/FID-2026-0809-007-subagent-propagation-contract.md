<!-- markdownlint-disable MD013 -->

# FID: Subagent Propagation Contract and Fan-Out Safety

**Filename:** `FID-2026-0809-007-subagent-propagation-contract.md`
**ID:** FID-2026-0809-007
**Severity:** high
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** Do not change spawning, child state, tool filtering, provider/model
> inheritance, event forwarding, cost aggregation, or fan-out behavior until final operator approval
> and Nova sign-off. This FID is a converged plan only.

---

## Summary

Subagent spawning is a high-value capability with a large propagation surface. The current runtime
already validates spawnability, filters tools, inherits models/provider options, manages history and
graph evidence, propagates ECHO/checkpoint context, forwards nested events, aggregates costs, and
isolates failures with `Promise.allSettled`. The remaining risk is that propagation is manually
maintained across several handlers and boundaries. This FID proposes an explicit inherited/overridden/
excluded contract, centralized child construction, propagation snapshots, matrix tests, and bounded
fan-out/depth/cancellation policy.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun; shared agent runtime; SDK/CLI event consumers
- **Tool Versions:** Bun `1.3.14`; strict TypeScript
- **Commit/State:** `main`; baseline subagent test results are not asserted by this planning artifact; planning-only
- **Dependencies:** FID-0809-010 bootup prerequisite; FID-0809-005 runtime boundaries; FID-0809-006 state ownership; FID-0809-004 validation

## Detailed Description

### Problem

A child execution must propagate identity, ancestry, model/provider context, tools, prompts, history,
graph context, ECHO state, checkpoint context, signal, events, costs, and cleanup semantics. The
current implementation splits this across `spawn-agents`, `spawn-agent-inline`, `spawn-agent-utils`,
`loop-context`, tool filtering, SDK stream handlers, and tests. `extractSubagentContextParams` is a
safer explicit seam than blind spreading, but every new runtime dependency must still be manually
classified.

### Expected Behavior

For every child, the system must explicitly define:

**Inherited:** signal, logger, runtime dependencies, model/provider context, file/project context,
checkpoint turn, ECHO tracker, graph context policy.

**Overridden:** child identity, parent ID, ancestry, agent template/type, prompt, spawn params,
inline system/history semantics.

**Excluded:** parent stream handles, transient timers, parent output, unsafe image propagation unless
explicitly supported, unrelated UI state.

The child must see exactly the tools authorized by its template, and executor authorization must agree
with model-visible tools.

### Evidence

```text
packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts
  parallel Promise.allSettled fan-out, model inheritance, child creation, event forwarding,
  and cost aggregation.

packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts
  context extraction, spawn validation, createAgentState, model inheritance, child execution.

packages/agent-runtime/src/tools/filter-tool-set.ts
  model-visible tool filtering.

packages/agent-runtime/src/run-agent-step/loop-context.ts
  child prompt/system/tool construction and defense-in-depth filtering.

packages/agent-runtime/src/__tests__/*spawn-agents*.test.ts
  permissions, history, image, streaming, and cost behavior coverage.
```

### Impact Assessment

- A new runtime dependency can be omitted from child context.
- Child model-visible tools and executor authorization can diverge.
- Parallel event ordering and nested identity can regress.
- Shared history/inline execution can create mutation and cancellation hazards.
- Unbounded fan-out can amplify cost, latency, and provider pressure.

### Risk Level

- [ ] Critical
- [x] High: child correctness, authorization, or cost accounting can silently drift
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Create a single typed child-construction contract that separates inherited, overridden, and excluded
fields. Preserve parallel fan-out but add explicit bounds and deterministic result ordering. Use
propagation snapshots and matrix tests rather than relying only on individual happy-path tests.

### Steps

1. Inventory propagation dimensions and current source of truth for each.
2. Define child context/state/execution contracts.
3. Consolidate child construction without changing semantics.
4. Add propagation snapshots for normal, inline, nested, restricted, zero-tool, and graph-injected children.
5. Add tool visibility/authorization parity tests.
6. Add provider/model, ECHO, checkpoint, cost, event, abort, and cleanup matrix tests.
7. Define maximum fan-out, nesting depth, total child budget, and cancellation policy.
8. Add event replay assertions for exact parent/child tree reconstruction.

### Verification

- All inherited/overridden/excluded fields are documented and tested.
- Child tool visibility equals executor authorization.
- Parent/child IDs and ancestry are stable in event replay.
- Model/provider inheritance is correct for gateway, local, and special-provider cases.
- Partial failures preserve successful reports and partial costs.
- Cancellation cleans up all owned child work.
- Fan-out/depth limits fail closed and are observable.
- Full validation passes after implementation.
- No implementation before final approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Child context crosses many boundaries and already contains deliberate special cases. Explicit
  parameter extraction reduces accidental spread, but there is no single propagation contract or broad
  matrix proof across permissions, state, model/provider, events, costs, and cancellation.
- **GREEN:** Proposed centralized child construction, propagation snapshots, matrix/property-style tests,
  and bounded fan-out/depth policies while retaining current parallel behavior.
- **AUDIT:** Evidence cites `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts:67,296`,
  `packages/agent-runtime/src/tools/filter-tool-set.ts:10`, `spawn-agents.ts:93,111,136,160`, and
  `packages/agent-runtime/src/run-agent-step/loop-context.ts:162`. No implementation change is claimed.
- **AUDIT ADVERSARIAL CHECK:** Centralizing propagation must not erase intentional differences between
  normal and inline agents. The plan retains explicit overrides for inline system/history behavior.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that child agents must inherit the parent's resolved protocol identity, not merely a boolean read flag, when single-agent and harness contracts coexist.
- **GREEN:** Added FID-010 as a prerequisite and preserved the explicit inherited/overridden/excluded propagation contract for protocol identity, tools, state, events, and cancellation.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; propagation boundaries remain cited at `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts:67,296`, `spawn-agents.ts:93,111,136,160`, and `packages/agent-runtime/src/run-agent-step/loop-context.ts:162`. No implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** The dependency does not authorize child propagation changes and does not permit blind protocol-state spreading.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Should every child share parent message history?** → No. Only templates explicitly requesting
   history do so; inline behavior remains a documented exception.
2. **Should child tools be the parent tool set?** → No. Filter by child authorization and verify at
   executor boundary.
3. **Should all children inherit the parent model?** → Default yes for user-selected model consistency,
   but templates may explicitly opt out when that is an intentional contract.
4. **How should parallel result order work?** → Preserve input order for parent reports; event order is
   correlated by IDs and must not be assumed globally sequential.
5. **What limits prevent runaway fan-out?** → Explicit maximum children, depth, concurrent children,
   and total budget, selected and recorded in the master FID.

### Code Verification Evidence

- [x] Spawn handlers, child utilities, tool filtering, loop context, and related tests inspected.
- [x] Existing propagation behaviors cataloged at the handler and filtering boundaries cited above.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] Child-contract implementation — prohibited pending approval and Nova sign-off.
- [ ] Fan-out performance/safety measurements — intentionally pending implementation.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** Subagent propagation is explicit and bounded by fan-out and ancestry depth limits.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

Subagent propagation is an API boundary even when it is implemented as internal object plumbing.
Explicit classification prevents invisible defaults from becoming child behavior.

## Closure Evidence

- **FID:** FID-2026-0809-007
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
