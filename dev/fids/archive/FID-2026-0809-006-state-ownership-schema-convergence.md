<!-- markdownlint-disable MD013 -->

# FID: State Ownership and Schema Convergence

**Filename:** `FID-2026-0809-006-state-ownership-schema-convergence.md`
**ID:** FID-2026-0809-006
**Severity:** high
**Status:** closed (2026-08-09 — implementation independently signed off)
**Created:** 2026-08-09
**YAGNI-Compliance:** Verified for planning scope

> **Planning-only boundary:** No runtime state types, serializers, SDK events, CLI stores, or resume
> behavior may be changed from this FID until final operator approval and Nova sign-off. This FID
> converges a plan only; it does not authorize implementation.

---

## Summary

The repository correctly uses multiple representations for execution, persistence, transport, and UI,
but ownership and conversion rules are distributed. `AgentState`, `SessionState`, `RunState`, SDK
server actions, CLI Zustand stores, message blocks, stream refs, and checkpoint state can drift when a
new field is added without updating every boundary. This FID proposes explicit durable/ephemeral/UI/
transport classification, centralized serialization/conversion, a run-state schema version, and
round-trip/event-replay tests.

## Environment

- **OS:** Windows (`win32`)
- **Language/Runtime:** TypeScript/Bun; SDK; CLI React/OpenTUI; Zustand
- **Tool Versions:** Bun `1.3.14`; strict TypeScript; Zod v4 where applicable
- **Commit/State:** `main`; baseline test results are not asserted by this planning artifact; planning-only
- **Dependencies:** FID-0809-010 bootup prerequisite; FID-0809-005 runtime boundaries; FID-0809-004 validation gates

## Detailed Description

### Problem

State is intentionally split across layers, but the mapping is partly implicit:

| Layer | Current role |
|---|---|
| `AgentState` | Mutable runtime execution state |
| `SessionState` | Agent state plus file context |
| `RunState` | SDK result/resume/checkpoint representation |
| Server actions | Transport/event contract |
| Chat store | Interactive UI state |
| Message blocks | Rendering projection |
| Refs/controllers | Transient concurrency state |

The system already uses clone and identity rules carefully, but those rules are not centralized as a
machine-checked contract.

### Expected Behavior

Every state field must be classified as:

- **Durable:** survives run return/resume;
- **Ephemeral:** never serialized and recreated/reset;
- **UI projection:** derived or independently transient;
- **Transport:** exists only at an event boundary.

Serialization and conversion must be centralized. A durable field cannot be added without a round-trip,
resume, cancellation, and relevant event/replay test.

### Evidence

```text
common/src/types/session-state.ts defines AgentState and SessionState.
sdk/src/run/types.ts defines RunState/RunOptions and cloneSessionState behavior.
sdk/src/run/execution.ts owns snapshots, cancellation, event dispatch, and settlement.
sdk/src/run-state/mutations.ts clones and applies resume overrides.
cli/src/state/chat-store.ts and cli/src/state/message-block-store.ts maintain UI projections.
cli/src/hooks/use-chat-state.ts maintains refs and Zustand projections.
```

### Impact Assessment

- New fields may be omitted from snapshots or resume.
- Ephemeral objects may accidentally be serialized.
- UI event replay may produce a different agent tree than runtime state.
- Mutation/replacement semantics can be misunderstood by future maintainers.

### Risk Level

- [ ] Critical
- [x] High: state loss or stale UI can occur at cross-layer boundaries
- [ ] Medium
- [ ] Low

## Proposed Solution

### Approach

Document and encode ownership without immediately replacing the existing mutation model. Add a
versioned serializable run-state boundary and explicit conversion helpers. Preserve performance
optimizations such as copying only mutable main-agent state where proven safe, but make the choice
visible and tested.

### Steps

1. Inventory every durable/ephemeral/UI/transport field.
2. Define run-state schema version and compatibility policy.
3. Centralize serialization/deserialization and cancellation snapshot creation.
4. Add round-trip and restore tests for every durable field.
5. Add event replay tests that reconstruct CLI projections.
6. Add exhaustive event-handler/type tests for new transport events.
7. Document mutation versus replacement ownership at runtime boundaries.
8. Measure snapshot cost before changing clone strategy.

### Verification

- Round-trip serialization is semantically stable.
- Ephemeral fields are excluded and safely recreated/reset.
- Resume and cancellation preserve durable progress.
- Event replay reconstructs parent/child/message/tool state.
- New event types cannot bypass handlers silently.
- Existing SDK and CLI tests remain green after implementation.
- Call-graph searches prove centralized converters are used by snapshots, resume, and event boundaries.
- No implementation before final approval and Nova sign-off.

## Perfection Loop

### Loop 1 — RED

- **RED:** Multiple state representations are legitimate but their ownership/conversion contracts are
  distributed across common, SDK, and CLI. Existing clone and snapshot logic reduces risk but does not
  enforce a durable-field registry or replay contract.
- **GREEN:** Proposed classification plus centralized serialization, schema version, round-trip,
  cancellation, resume, and event-replay testing while preserving proven performance behavior.
- **AUDIT:** Evidence cites `common/src/types/session-state.ts:87,222`, `sdk/src/run-state/types.ts:11`,
  `sdk/src/run-state/mutations.ts:101`, and the `cloneSessionState` import in `sdk/src/run.ts:6`.
  CLI projections were inspected separately. No code change or implementation claim exists.
- **AUDIT ADVERSARIAL CHECK:** A total state rewrite would be risky and unnecessary. The plan explicitly
  preserves current representations until field ownership and measurements justify narrower refactors.
- **CHANGE DELTA:** Planning document only.

### Loop 2 — Cross-Program Re-Audit

- **RED:** Re-audit found that persisted protocol identity must be classified deliberately if boot selection becomes part of run/resume evidence; it must not be accidentally serialized as UI or transient state.
- **GREEN:** Added FID-010 as a prerequisite and retained the explicit durable/ephemeral/transport/UI classification approach.
- **AUDIT:** Master prerequisite evidence is `dev/fids/FID-2026-0809-009-optimization-automation-master-plan.md:68-75`; state boundaries remain cited at `common/src/types/session-state.ts:87,222`, `sdk/src/run-state/types.ts:11`, `sdk/src/run-state/mutations.ts:101`, and `sdk/src/run.ts:6`. No implementation was performed.
- **AUDIT ADVERSARIAL CHECK:** The boot dependency does not require collapsing runtime and persistence types or persisting protocol documents wholesale.
- **CHANGE DELTA:** Planning dependency and loop record only.

### Missed Questions

1. **Should AgentState and RunState become the same type?** → No. Runtime and persistence have different
   concerns; central conversion is safer than forced identity.
2. **Should UI state be persisted?** → Only if a user-visible resume contract requires it; scroll/focus/
   collapse state should remain UI projection by default.
3. **How are functions and runtime instances handled?** → They are ephemeral and excluded; resume
   reconstructs them from definitions/configuration.
4. **What proves a new field is durable?** → Schema, round-trip, resume/cancellation, and event impact
   tests must be required before acceptance.
5. **What if serialization performance regresses?** → Measure snapshots and retain the narrow-copy
   strategy unless evidence justifies a change.

### Code Verification Evidence

- [x] Common state types, SDK run/snapshot/resume files, and CLI stores inspected.
- [x] Existing clone and snapshot behavior identified at the state boundaries cited above.
- [x] The single-agent no-attribution rule overrides the generic template's Author field; no Author,
  Fixed By, Verified By, or signature field is present.
- [ ] State implementation — prohibited pending approval and Nova sign-off.
- [ ] Replay/round-trip measurements — intentionally pending implementation.

## Resolution

- **Status:** Closed and archived on 2026-08-09.
- **Implementation result:** RunState schema and serialization preserve backward compatibility and normalize produced transport state.
- **Operator approval:** Build approval supplied in-session.
- **Independent audit:** PASS recorded in `dev/nova/inbox/2026-08-09-fid-2026-0809-003-010-optimization-automation-implementation-sign-off-response.md`.
- **Release state:** Included in pending unreleased `0.0.23`; no tag, push, publication, or deployment was performed.
- **Historical scope:** Prior planning and convergence evidence is retained; no historical FID archives were rewritten.

## Lessons Learned

Multiple representations are acceptable only when ownership and conversion are explicit. State
classification is more valuable than prematurely collapsing types.

## Closure Evidence

- **FID:** FID-2026-0809-006
- **Implementation audit:** PASS; independent response cited above.
- **Cross-cutting checks:** no credentials used; no provider routing changes; RunState backward compatibility preserved; bounded propagation verified; no-signature policy followed.
- **Environment note:** release validation still requires pinned Bun `1.3.14`; the prior host ran Bun `1.3.11`, an environment-only publication blocker.
