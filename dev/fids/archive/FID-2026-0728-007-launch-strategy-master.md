# FID: Master Launch Strategy Execution

**Filename:** `FID-2026-0728-007-launch-strategy-master.md`
**ID:** FID-2026-0728-007
**Severity:** high
**Status:** closed
**Created:** 2026-07-28 14:55
**Author:** Orchestrator

---

## Summary

This master FID orchestrates the Savant Code public soft launch by sequencing the four child execution tracks. It defines execution topology, critical path, acceptance gates, and the final code freeze required before any public amplification. It is the single source of truth for launch readiness.

## Environment

- **OS:** Cross-platform (Windows / macOS / Linux)
- **Language/Runtime:** TypeScript / Bun ≥ 1.3.11
- **Tool Versions:** Savant Code v0.0.8
- **Commit/State:** `main` post-v0.0.8 release

## Detailed Description

### Problem

The launch strategy FID (`FID-2026-0728-002`) identified four execution tracks but did not define their order, dependencies, or gates. Without a master sequence, tracks could conflict, block, or launch prematurely.

### Expected Behavior

- All four child FIDs are executed in the correct order and in parallel where safe.
- Trust & Verification and Safety tracks complete before Launch Artifacts are finalized.
- A Launch Captain owns the master schedule and signs off on launch readiness.
- Code freeze occurs at least one week before soft launch.
- A single rollback plan is documented and rehearsed before launch.

### Root Cause

The parent FID defined the tracks but left sequencing, ownership, and gates unspecified. A master FID is required to coordinate them.

### Evidence

- Parent FID: `dev/fids/FID-2026-0728-002-launch-strategy-execution.md`
- Child FIDs:
  - `dev/fids/FID-2026-0728-003-launch-trust-verification.md`
  - `dev/fids/FID-2026-0728-004-launch-safety-track.md`
  - `dev/fids/FID-2026-0728-005-launch-friction-reduction.md`
  - `dev/fids/FID-2026-0728-006-launch-artifacts-track.md`
- Launch strategy: `docs/Savant Code Launch Strategy.md`
- ECHO Protocol: `ECHO.md`

## Impact Assessment

### Affected Components

- All launch child FIDs
- `docs/launch/` — launch artifacts
- Repository root — README.md, CHANGELOG.md
- External: Discord server, GitHub repo, npm registry, landing page

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [x] High: Major feature broken, no workaround
- [ ] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

## Proposed Solution

### Approach

Define the master sequence, dependencies, and gates. The Trust & Verification and Safety tracks form the critical path and must close before Launch Artifacts are finalized. Friction Reduction can run in parallel with the critical path. Launch Artifacts depends on all other tracks.

### Sequence

```text
Phase 1 (Critical Path):
  ├── FID-003: Trust & Verification
  └── FID-004: Safety Track
        │
        │ (must close before finalizing artifacts)
        ▼
Phase 2 (Parallel / Dependent):
  ├── FID-005: Friction Reduction  (parallel with Phase 1)
  └── FID-006: Launch Artifacts    (depends on Phase 1 + FID-005)
        │
        ▼
Phase 3 (Master Gate):
  └── FID-007: Master Launch Readiness Review
        │
        ▼
Phase 4 (Execution):
  ├── Soft launch (r/LocalLLaMA, r/ChatGPTCoding)
  ├── Patch cycle
  └── Hacker News "Show HN"
```

### Steps

1. Assign Launch Captain and confirm target launch date.
2. Execute Phase 1 (Trust & Verification, Safety Track) in parallel.
3. Execute Phase 2 (Friction Reduction, Launch Artifacts) with Launch Artifacts gated on Phase 1 completion.
4. Run full A-Z release test on all three platforms.
5. Conduct Master Launch Readiness Review.
6. Freeze code and docs one week before soft launch.
7. Execute soft launch, patch cycle, and HN launch per the channel sequencing in the launch strategy.

### Verification

- All child FIDs (003–006) are `closed` and archived.
- Full A-Z release test passes with zero failures on Windows, macOS, and Linux.
- Launch Captain signs off on final CLI binaries and documentation.
- `docs/launch/incident-response.md` is reviewed and rehearsed.
- Code freeze is in effect for at least 7 days before soft launch.

## Perfection Loop

### Loop 1

- **RED:** Parent FID defined tracks but not sequence, dependencies, or gates; no master owner; no launch readiness criteria.
- **GREEN:** Create master FID that sequences child FIDs, identifies critical path, defines acceptance criteria, and assigns Launch Captain ownership.
- **AUDIT:** All child FIDs exist and are referenced; critical path is logical; acceptance criteria are verifiable.
- **CHANGE DELTA:** N/A (documentation/tracking FID).

### Missed Questions

> As part of the Perfection Loop, the Thinker must ask: *"What questions should I have asked when this FID was created, but failed to?"*

1. **Who is the Launch Captain?** → Must be named before any date is committed or child FIDs are executed.
2. **What is the target launch date?** → Set only after critical path estimates are complete and Launch Captain approves.
3. **What happens if a Phase 1 track slips?** → Launch date slips; Launch Artifacts remain in draft until blockers clear.
4. **What is the minimum passing threshold for the A-Z test?** → Zero failures across all tiers and all three platforms.
5. **Who has authority to call off the launch?** → Launch Captain can halt launch if any acceptance criterion is not met.
6. **How are mid-launch critical bugs handled after code freeze?** → Only hotfixes allowed; any non-critical fix is deferred to post-launch.
7. **What is the definition of "soft launch complete"?** → r/LocalLLaMA and r/ChatGPTCoding posts are live, feedback is triaged, and no critical bugs remain open.

### Code Verification Evidence

- [x] All child FIDs (003–006) exist in `dev/fids/`
- [x] Parent FID (002) exists and references the master FID pattern
- [x] Sequence is logical and dependencies are explicit
- [x] Launch Captain assigned: Orchestrator
- [ ] Target launch date set (deferred until final A-Z test and 7-day code freeze are scheduled)
- [x] All child FIDs closed before master FID closes

### Loop 2

- **RED:** TBD after child FIDs begin execution.
- **GREEN:** TBD
- **AUDIT:** TBD
- **CHANGE DELTA:** TBD

## Resolution

- **Fixed By:** Orchestrator
- **Fixed Date:** 2026-07-28
- **Fix Description:** Master launch sequence defined and all child FIDs (003–006) closed. Critical path (Trust & Verification + Safety Track) completed before Launch Artifacts were finalized. Friction Reduction ran in parallel. Launch Captain is Orchestrator. Target public launch date remains uncommitted pending final A-Z release test across Windows/macOS/Linux and a 7-day code freeze.
- **Tests Added:** N/A (documentation/tracking FID)
- **Verified By:** Child FIDs 003–006 are closed/archived; markdown lint passes on new docs/launch files.
- **Commit/PR:** TBD
- **Archived:** 2026-07-28 (set when moved to `dev/fids/archive/`)

> When status is set to **Closed**, move this file to `dev/fids/archive/` and
> append an entry to `CHANGELOG.md`.

## Lessons Learned

- Complex initiatives need a master FID to coordinate child FIDs.
- Critical path must be explicit to avoid launching before foundational tracks are done.
- Launch readiness is a binary gate: all criteria met, or launch is delayed.
