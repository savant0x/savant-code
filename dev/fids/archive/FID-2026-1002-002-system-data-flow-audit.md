# FID: System data-flow audit corrections

**Filename:** `FID-2026-1002-002-system-data-flow-audit.md`
**ID:** FID-2026-1002-002
**Severity:** high
**Status:** closed (implemented + verified, 2026-10-03, commit 9f1b8068)
**Created:** 2026-10-02
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

The post-change audit reproduced enforcement baseline starvation on the real
repository, stale-run sidebar mutation, unnecessary archive reads on message
submission, silent byte-event loss in code search, and misleading FID status
labels. The full test gate also failed a line-number-dependent presence check.
Task T111 owns the corrections and their verification.

## Environment

Windows, Bun 1.3.14, TypeScript strict monorepo; HEAD `997ce946` plus the
uncommitted October 2 enforcement and code-search work. No commit authorized.

## Detailed Description

### Problem and evidence

1. `captureWorktreeBaseline` in
   `packages/agent-runtime/src/echo/enforcement/worktree-capture.ts` applies
   the turn-end 500 ms budget to one-time full-inventory capture. Three real
   repository probes returned `method: unavailable`, zero captured files,
   and `unverifiable: true` at reconciliation (505, 500, 508 ms). With a
   10-second probe budget, capture completed in 1,256 ms for 5,136 files;
   subsequent complete reconciliations took 169 and 170 ms. Cost-degraded
   turn-end scans deliberately remain notices under the existing operator
   ruling; this correction does not change that authority.
2. `createRunLifecycle.onStateSnapshot` in
   `cli/src/hooks/helpers/send-message-lifecycle.ts` writes sidebar tokens
   and cost BEFORE its aborted/current-chat guard. Persistence is guarded;
   display state is not. `adoptAndPersist` and `persistFailureState` also
   cross an awaited checkpoint drain before reading the mutable current
   transcript without rechecking chat identity.
3. `loadFids` delegates to `loadFidInventory`, and `getActiveFidPaths` in
   `cli/src/utils/create-run-config.ts` also loads the full inventory.
   Real-tree probes read 434 archive records in 70–76 ms, including when
   zero active FIDs exist. The active-only API should only read its own dir.
4. `RipgrepMatchCollector` in `sdk/src/tools/code-search/match-collector.ts`
   accepts an event carrying `path.bytes` and `lines.bytes`, then emits
   `c3JjL3NhbXBsZS50cw==:1:` with one match and zero drops. This is silent
   data loss, despite the new fail-loud contract. Path and line text must
   be usable before an event earns match credit.
5. `SidebarActiveFids` in `cli/src/components/right-sidebar-sections.tsx`
   labels archive membership as closed and absence of active files as loop
   convergence. Neither assertion is established by the loader; SCOPE T97
   already documents archived records with other statuses.
6. `cli/src/state/presence/__tests__/client-id-reachability.test.ts`
   pins the constant to line 87, while the production definition now occupies
   line 95. Root tests: SDK 621 pass/1 skip; CLI 3763 pass/18 skip/1 fail.
   The symbol, value, single definition, and caller assertions remain valid.

### Expected behavior and root cause

Capture receives its own bounded initialization budget; the 500 ms turn-end
budget stays intact. Aborted or foreign-chat runs may retain local snapshots
but cannot mutate the current sidebar or save its transcript. Active-only
loading performs no archive IO. Unusable ripgrep events produce drop
diagnostics rather than blank successful matches. Sidebar labels describe
observed inventory, and reachability tests assert symbols and source files.

## Impact Assessment

Affected: enforcement initialization, chat lifecycle and persistence boundaries,
FID loader and caller, sidebar layout/labels, search parsing, and verification.
Initialization can take up to five seconds once per captured checkpoint; it
retains full SHA-256 content verification and the existing oversized-file and
no-git limits. The turn-end cost budget is unchanged. No credential, provider,
network or release change is proposed. The checkpoint gains an optional,
JSON-safe initial-candidate field; legacy records use full enumeration.
Existing unavailable
checkpoints remain explicitly unverifiable; they cannot retroactively recover
mutations from before capture. The day-one symptom is still awaiting operator
clarification and is not assumed to be this baseline defect.

## Proposed Solution

1. Separate the full capture budget (5,000 ms) from turn-end reconciliation
   (500 ms), including git enumeration timeout. Keep custom test budgets.
2. Guard sidebar snapshot writes before dispatch and recheck chat identity
   after awaited persistence drains. Preserve internal snapshot delivery.
   Inject the existing persistence functions for race tests. Guard shared
   streaming cleanup by the owning abort-controller identity: the prior
   abort handler releases the queue immediately, but the old finally block
   otherwise marks a newer run completed and clears its heartbeat. Add the
   regression to the lifecycle isolation suite declared below.
   Gate aborted SDK event/chunk delivery at run-config dispatch. The monitor
   checks run ownership and clears the previous interval before replacement;
   otherwise the skipped stale finalizer would leave its interval running.
3. Make `loadFids` read only the active directory; use it at the submission
   caller. Preserve full-inventory loading for consumers that need archives.
4. Require usable text path/line fields in the ripgrep event schema; byte-only
   or missing payloads are accounted parse drops. Use stream UTF-8 decoding
   across buffer boundaries. Retain clean zero and partial-result behavior.
   Use the existing Node `StringDecoder` primitive at buffer ingestion so
   decoding does not depend on stream configuration. Replace the old bytes
   fixture, which treats a plain filename as base64, with an honest-drop
   assertion; exercise a multibyte character split across process chunks.
5. Replace unproved sidebar status assertions with neutral inventory labels.
6. Assert presence source paths independently of physical line numbers.
7. Add regressions, run workspace and repository gates, record fresh evidence.
8. Persist initially dirty Git candidates on the grounding checkpoint and
   union them with turn-end status before hashing. Git-clean does not imply
   unchanged since a dirty baseline. Missing legacy candidate metadata uses
   full baseline enumeration within the existing turn-end budget. Capture
   failure or candidate enumeration failure remains explicitly unavailable.
   Add a dirty-to-clean regression, retaining exact content hashes.
9. Pass owning run identity from preparation into the lifecycle. Chat ownership
   and run ownership must both hold; a replacement within the same chat must
   prevent prior-state adoption before any sidebar or history mutation.
10. Wrap sidebar sections in the existing native vertical scrollbox pattern.
    Keep the outer box, fold chrome, tokens, sections, and branding;
    make overflow reachable instead of shrinking expanded rows. A live tmux
    capture at 100×28 omits the Modified row; 160×48 shows it. Verify both
    sizes and section expansion without making provider requests.
11. Route FID test gates through their declared workspace root, with relative
    test filters. The executor currently contradicts the documented T67
    substring-filter guard. Reuse its workspace allowlist and retain original
    gate labels and hostile-argument checks; assert CLI and nested runtime
    working directories in the executor suite. Keep fold chrome outside the
    sidebar scroll viewport to preserve its existing edge handle.

## Verification Gates

- gate: typecheck cli
- gate: typecheck sdk
- gate: typecheck common
- gate: typecheck packages/agent-runtime
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts
- gate: test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts
- gate: test cli/src/hooks/helpers/__tests__/run-lifecycle-chat-isolation.test.ts
- gate: test cli/src/utils/__tests__/fid-loader.test.ts
- gate: test cli/src/state/presence/__tests__/client-id-reachability.test.ts
- gate: test sdk/src/__tests__/code-search-fail-loud.test.ts
- gate: test sdk/src/__tests__/code-search-part-c.test.ts
- gate: test scripts/__tests__/fid-verify.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:a390f11a726c150836e0e36f2e19fd68daa7cff1e586141a831cbbcd996e58f7
- verified: 2026-10-02T22:03:34.401Z
- typecheck cli: exit 0
- typecheck sdk: exit 0
- typecheck common: exit 0
- typecheck packages/agent-runtime: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-capture.test.ts: exit 0
- test packages/agent-runtime/src/echo/__tests__/worktree-reconcile.test.ts: exit 0
- test cli/src/hooks/helpers/__tests__/run-lifecycle-chat-isolation.test.ts: exit 0
- test cli/src/utils/__tests__/fid-loader.test.ts: exit 0
- test cli/src/state/presence/__tests__/client-id-reachability.test.ts: exit 0
- test sdk/src/__tests__/code-search-fail-loud.test.ts: exit 0
- test sdk/src/__tests__/code-search-part-c.test.ts: exit 0
- test scripts/__tests__/fid-verify.test.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

Evidence comes from current production source, real-tree timed probes, collector
output, and full gate logs under `dev/scratchpad/active/system-audit-*`.

### GREEN

The steps above preserve existing APIs and extend existing authorities.
The measured full capture, not candidate reconciliation, is the missing cost
boundary. Keep exact content hashes rather than substituting file timestamps
or git status for content identity. Preserve guarded original-chat saves and
ordinary current-chat compaction delivery. Keep the inventory API for sidebar
archive counts, but remove archive IO from active-only callers.

### AUDIT

Root typecheck exit 0. The real-tree capture comparison proves that a distinct
initialization allowance produces a complete baseline while successful
reconciliation stays below its existing budget. Source tracing confirms the
snapshot guard ordering, active-only caller, and parser loss. The existing
test failure demonstrates the reachability test's line-number fragility.
Every new test path is declared above. Implementation gates will be run after
the changes; no implementation PASS is claimed at convergence.

### Missed Questions

- Do snapshots need to remain locally available after abort? Yes; keep the
  local assignment before the guard, without writing the current store.
- Can a chat change during an await? Yes; recheck immediately after draining.
- Is 500 ms the initialization contract? The recorded operator ruling names
  every TURN END. A bounded one-time initialization allowance is separate.
- Must byte-only matches be fabricated as strings? No; count and report
  unsupported payloads honestly rather than accepting empty content.
- Does archive membership prove closure? No; do not change historical records
  or decide the existing level-1 archive disposition; fix the display claim.

### Convergence

The fix plan has production callers, independent reproduction evidence, and
preserves the existing contracts. Implementation may proceed at level 3.

## Implementation Evidence

### Code Verification Evidence

Steps 1–11 are implemented. Full typecheck, ESLint with zero warnings, quality,
repository validation, and changed-code formatting pass. Full repository
tests: 7,760 pass, 23 skip, zero failures. Final CLI: 3,771 pass, 18 skip,
zero failures. Source wiring, probes, and live tmux checks are detailed in
`dev/session-summaries/2026-10-02-system-data-flow-audit.md`.

## Resolution

Implemented and verified in the working tree; landed in the 2026-10-03 batch
commit `9f1b8068` on local main (operator granted G2; local commit only, no
push). The exact day-one symptom remains pending operator clarification;
every other finding's correction is implemented and receipt-stamped.
- **Archived:** 2026-10-03 (moved to `dev/fids/archive/`)

## Lessons Learned

Fixture-sized cost proofs do not establish real-repository initialization
viability. Counted matches must carry usable payloads. Chat ownership must be
checked at every asynchronous boundary that reads a mutable global store.
