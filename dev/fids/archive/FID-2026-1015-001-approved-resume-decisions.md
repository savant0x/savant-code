# FID: Implement the approved resume decisions

**Filename:** `FID-2026-1015-001-approved-resume-decisions.md`
**ID:** FID-2026-1015-001
**Severity:** medium
**Status:** closed
**Created:** 2026-10-15
**Automation level:** 3
**YAGNI-Compliance:** Verified

## Summary

Implement the five recommendations explicitly approved by the operator's "yes":
selected-provider routing, SDK fixture formatting, preserved local session exports,
independent skill-notice delivery, and permanent numeric task identity.

## Environment

- Windows, TypeScript, Bun 1.3.14; starting HEAD `6a0c6439`.
- Existing command-cancellation edits and unrelated operator changes remain separate.

## Detailed Description

### Problem

The previous review stopped without asking its questions. Its register holds now have
operator answers, but the corresponding behavior and tracking need implementation.

### Expected Behavior

Provider selection controls endpoint and credentials even for nested vendor model IDs.
Custom endpoints retain exclusive environment-key authorization. Session-end output
does not suppress interactive notices or replay already displayed events forever.
Retiring a task never makes its number available for a different identity.

### Root Cause

Prefix-based inference conflicts with newly registered first-party providers.
The review claims the CLI cursor without acknowledging it. The active register removes
completed tasks without retaining their allocation history. Raw exports and whitespace
drift were left on validation surfaces awaiting the now-granted operator decision.

### Evidence

- `common/src/providers/model-route.ts:129`: prefix/active-provider mismatch throws.
- `sdk/src/impl/model-provider.ts:81`: route validation precedes prefix dispatch.
- `scripts/session-end-notices.ts:30`: review claims `'cli'`, with no acknowledgement.
- `SCOPE.md`: task-ID reuse and formatting/routing holds explicitly require a ruling.

## Impact Assessment

### Affected Components

Model route inference and SDK dispatch, session-end notices, scope validation,
the two SDK fixture files, local raw exports, and durable tracking.

### Risk Level

- [x] Medium: endpoint/key identity and persistent notification/task state need regression coverage.

## Proposed Solution

### Approach

Reuse explicit-route precedence, custom-endpoint protection, and existing lifecycle
claim/ack APIs. Prefix dispatch must obey the resolved route. Preserve current task IDs;
reserve legacy numbers through 190 and retain allocations permanently. Validate live
titles and append-only allocations against the prior committed ledger.

### Steps

1. Implement and verify selected-provider routing without credential crossover.
2. Apply whitespace-only edits to the two approved SDK process fixtures.
3. Move raw exports byte-for-byte into ignored `dev/exports/session-archives/`.
4. Give session-end delivery its own cursor; acknowledge after successful output only.
5. Add a permanent task-ID ledger and wire its check into both scope and repository probes.
6. Record gate results, commit explicit paths, and archive only after evidence supports closure.

### Verification

Routing tests: `common/src/providers/__tests__/model-route-selection.test.ts` and
`sdk/src/impl/__tests__/model-provider-selected-transport.test.ts`.
Delivery tests: `scripts/__tests__/session-end-lifecycle-delivery.test.ts`.
Ledger tests: `scripts/__tests__/task-id-ledger.test.ts`.
Run existing affected SDK suites, typecheck, lint, format, repository checks and build.
Compare export SHA-256 before and after relocation. Re-read changes against this contract.

## Step Status

- [x] Step 1 — implemented: selected-provider routing and budget identity, regression gates pass.
- [x] Step 2 — implemented: approved SDK fixture formatting, behavior preserved.
- [x] Step 3 — implemented: exports preserved with identical SHA-256 in the ignored archive.
- [x] Step 4 — implemented: independent session-end cursor and output acknowledgement, delivery gates pass.
- [x] Step 5 — implemented: permanent allocation ledger wired into scope and repository validation.
- [x] Step 6 — implemented: verification recorded, implementation committed, CHANGELOG updated and FID archived.

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: probe scripts/scripts-typecheck-check.ts
- gate: test common/src/providers/__tests__/model-route-selection.test.ts
- gate: test sdk/src/impl/__tests__/model-provider-selected-transport.test.ts
- gate: test scripts/__tests__/session-end-lifecycle-delivery.test.ts
- gate: test scripts/__tests__/task-id-ledger.test.ts
- gate: test cli/src/utils/__tests__/settings-provider.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-context-window.test.ts
- gate: test packages/agent-runtime/src/tools/tool-executor/tool-result-coverage.test.ts
- gate: probe scripts/scope-register-check.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5748799d517ae24f792ced5f5879162c4bf0c94269bcfac5a0bbb38a9b75d3ec
- verified: 2026-10-15T04:47:14.694Z
- typecheck common: exit 0
- typecheck sdk: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- probe scripts/scripts-typecheck-check.ts: exit 0
- test common/src/providers/__tests__/model-route-selection.test.ts: exit 0
- test sdk/src/impl/__tests__/model-provider-selected-transport.test.ts: exit 0
- test scripts/__tests__/session-end-lifecycle-delivery.test.ts: exit 0
- test scripts/__tests__/task-id-ledger.test.ts: exit 0
- test cli/src/utils/__tests__/settings-provider.test.ts: exit 0
- test cli/src/utils/__tests__/openrouter-models-context-window.test.ts: exit 0
- test packages/agent-runtime/src/tools/tool-executor/tool-result-coverage.test.ts: exit 0
- probe scripts/scope-register-check.ts: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** Catalogued the mismatch throw, independent SDK prefix loop, shared cursor,
  and missing task allocation history using the source paths above.
- **GREEN:** Selected transport precedes model text; report generation stays read-only;
  output owns acknowledgement. Existing numbers remain stable.
- **AUDIT:** Source inspection exposes a second routing dispatch seam: changing only
  the resolver would still select the wrong provider in the SDK. Both must change.
- **ADVERSARIAL:** Custom endpoints must bypass prefix dispatch too. Overflow events
  must remain unread. Historical allocation gaps must remain reserved, never guessed free.
- **CHANGE DELTA:** Initial plan.

### Missed Questions

1. Does a custom endpoint receive a registry key? No: retain `INFERENCE_API_KEY` exclusively.
2. Does report construction count as display? No: acknowledge only after output succeeds.
3. Can completed task numbers be reused? No: identity remains in the permanent ledger.
4. Are old gate results current? No: rerun affected gates and report actual results.

### Loop 2 — Independent audit and self-correction

- **RED:** Challenged key leakage, overflow acknowledgement, and retirement/reallocation.
- **GREEN:** Add regression cases for those boundaries; preserve explicit ModelRoute precedence.
- **AUDIT:** The plan uses existing factories/cursors and extends standing validation probes.
- **ADVERSARIAL:** A ledger that can be silently rewritten needs comparison with committed
  allocations; include deletion and title-change rejection.
- **CHANGE DELTA:** No further plan changes after resolving the listed boundaries.

### Loop 3 — Final convergence

- **RED:** No remaining unanswered implementation decisions within the five approvals.
- **GREEN:** Implement the bounded changes above.
- **AUDIT:** Every promised new test has an unfenced declared gate.
- **ADVERSARIAL:** No production repair observation or unrelated master closure is claimed.
- **CHANGE DELTA:** No additional plan change; converged before implementation.

### Implementation Evidence (REQUIRED for `closed`)

Implementation audit found the same prefix collision in request-budget catalog lookup.
The custom-endpoint budget regression fails on a missing `max_tokens` cap;
extend the routing fix to use the selected provider's catalog identity there too.

The full SDK run exposed five stale test setups that supply a custom endpoint
but rely on a different provider's key (or no key). Update those fixtures to
supply their own test-only endpoint key, preserving the approved credential boundary.
The Windows process-tree fixture also failed under concurrent validation load;
investigate and repeat it in isolation before claiming the SDK gate passes.

Fresh census also exposed an unowned capture added before this session:
`v1:read_files:read-incomplete:undetermined` at `2026-10-15T04:00:33.051Z`,
with `FILE_DOES_NOT_EXIST`. Register it under the active taxonomy/horizon lane
FID-2026-1012-024 without modifying the immutable row or claiming repair.
The gate requires ownership; observation and the actual missing-file cause stay active
under that lane. Census before allocation: 591 records, 59 classes, one ownership issue.

Root CLI tests exposed two stale expectations. Legacy active OpenRouter selection must
survive a colliding `openai/` model name despite a different picker preference, per the
approved transport rule. A fallback test used `deepseek/deepseek-v3`, now an exact
published catalog entry (1,000,000); replace that fallback input with an actually
unlisted fixture ID and retain the conservative 200,000 assertion. No catalog value
or fallback policy changes. Add both suites and CLI typecheck to the declared gates.

Steps 1 through 6 are implemented. The 12,807-line CHANGELOG was read completely
before the closure entry was inserted; no read exception or waiver was used.
The record is archived with its implementation commits and verification evidence.
The aggregate build's existing Savant-Free failure remains registered under `T122`.
It does not change the selected-provider or delivery contracts implemented here.

- **Commit SHA:** `83f1712d` contains the five approved changes and their records.
  `ca94b6f1` records fixture alignment; `6fe1ca49` records final verification.

Recorded tool output:

```text
Full root typecheck: exit 0
SDK: 701 pass, 1 skip, 0 fail (702 tests, 113 files)
Scripts delivery/review/ledger: 23 pass, 0 fail
CLI focused settings/window suites: 11 pass, 0 fail
Initial declared gates: 9 PASS, exit 0
Expanded declared gates before runtime fixture alignment: 12 PASS, exit 0
ESLint . --max-warnings 0: exit 0
Markdown lint: exit 0
Prettier: All matched files use Prettier code style!
quality: PASS (1502 baselined files)
scope-register PASS (0 issues)
Recurrence census: 591 records, 59 classes, 0 issues
SDK build: ESM, CJS, declarations complete
Aggregate ci: exit 1 at existing SavantFree build
```

All three raw exports retain their exact SHA-256; hashes and locations are in
`dev/session-summaries/2026-10-15-approved-resume-decisions.md`.
The two SDK process fixtures retain their previous behavioral edits unstaged;
this session only repaired their whitespace.

### Code Verification Evidence

The broader runtime run found a stale guard-refusal fixture: it claimed producer
authority with only stderr text. Update that fixture with the real rejected-execution
metadata, keeping the spoofed-message behavior strict. This is test alignment with
the existing working-tree producer contract, not a production expectedness change.
The source suite was fully read before editing; its workspace typecheck and test
are declared above. The first broad runtime result was 2,161 pass / one stale-fixture fail.

- `common/src/providers/model-route.ts:126`: selected provider owns inference.
- `sdk/src/impl/model-provider.ts:81`: SDK dispatch consumes the resolved route.
- `sdk/src/impl/model-provider/apply-request-budget.ts:18`: budget lookup uses the same route.
- `scripts/session-end-notices.ts:49`: output acknowledges only its exact session-end batch.
- `scripts/session-end-review.ts:296`: production entrypoint invokes that output path.
- `common/src/util/skill-lifecycle-events.ts:162`: independent session-end cursor type.
- `scripts/task-id-ledger.ts:111`: persistent allocation and committed-history checks.
- `scripts/scope-register-check.ts:23` and `scripts/validate-repository.ts:279` invoke the ledger check.
- Manual audit challenged custom-endpoint keys, explicit replacement, overflow, failed output,
  retirement, mutation, and committed deletion; regression suites exercise those boundaries.

## Resolution

Implementation verified under the operator's five-decision approval. All fourteen
declared gates passed live before closure. All thirteen configured workspace suites
passed independently: 9,120 passed, 23 skipped, zero failures. Root typecheck,
ESLint, Markdown lint, formatting, quality, scope and repository validation passed.

- **Commit SHA:** `83f1712d`, `ca94b6f1`, `6fe1ca49`.
- **Closed:** 2026-10-15.
- **Archived:** 2026-10-15 to `dev/fids/archive/`.
- **Tracking:** CHANGELOG entry inserted; completed scope item and write targets removed.

The stored receipt records the live verification that earned closure. Per the
single-agent protocol, closing edits do not claim a fresh fingerprint over these
archived bytes. The existing Savant-Free aggregate-build failure remains under `T122`.

## Lessons Learned

Model identity and serving identity require separate authority. Delivery cursors and
task numbers require durable identity beyond the active UI or register entry.
