# FID: Model-picker searches retain rows with colliding provider identities

**Filename:** `FID-2026-1003-005-model-picker-provider-row-identity.md`
**ID:** FID-2026-1003-005
**Severity:** medium
**Status:** verified
**Created:** 2026-10-03 11:20
**Automation level:** 3
**YAGNI-Compliance:** Verified

---

## Summary

T126: searching the model picker leaves unrelated direct OpenAI rows visible.
Direct OpenAI and OpenRouter can expose identical model IDs, but the picker
uses only the ID as the React sibling key. Filtering computes correct matches;
React reconciliation retains old rows after duplicate-key collisions.

## Environment

- Windows, PowerShell, Bun 1.3.14, OpenTUI 0.5.3, React 19.
- Existing working tree at HEAD `04c3ca7a`; other session changes preserved.
- Single-agent ECHO, strict mode, automation level 3.

## Detailed Description

### Problem

The operator reports that OpenAI remains above all search results. A native
renderer reproduction with two direct OpenAI models, the same IDs from
OpenRouter, and DeepSeek/Qwen models produces the symptom exactly.

### Expected Behavior

Only matching models and their provider headers appear after filtering.
Distinct provider routes sharing an ID remain independently selectable.
A zero-match query displays the empty state without retained model rows.

### Root Cause

Before correction, `cli/src/components/model-picker.tsx:252` used
`key={item.model.id}`.
`cli/src/utils/openrouter-models/openai.ts:46-56` adds the `openai/` prefix
and assigns provider `openai`; `openrouter.ts:53-65` retains the same upstream
IDs with provider undefined (resolved to `openrouter` by grouping). Both
entries therefore receive identical React keys in a mixed-provider picker.

### Evidence

Native `createTestRenderer` reproduction, using production ModelPicker:

```text
Encountered two children with the same key, `openai/gpt-4.1`.
Encountered two children with the same key, `openai/gpt-5`.
query deepseek: 1 logical match, 4 rendered children (expected 2).
query qwen: 1 logical match, 4 rendered children (expected 2).
query no-match: 0 logical matches, 3 rendered children (expected 1).
```

Captured frames for `deepseek`, `qwen`, and `no-match` retain both direct
OpenAI models. A control fixture with unique IDs filters correctly, ruling
out a provider-specific filter bypass.

## Impact Assessment

### Affected Components

- Existing ModelPicker sibling row identity and native rendering tests.
- Search, empty state, and provider-preserving selection.

### Risk Level

Medium: visible results disagree with the search count and actual selectable
items. The correction changes rendering identity only; catalogs, provider
order, filtering semantics, and model routing remain unchanged.

## Proposed Solution

### Approach

Encode provider and model ID in the existing model-row key. Do not deduplicate
model IDs across providers: those are legitimate distinct routes. Extend the
existing native-renderer harness to accept an injected mixed-provider catalog.
The same native run exposes a missing-key warning inside ModelPickerModelRow:
Button recursively normalizes static JSX children into arrays. Give its
existing marker/ID and identity/provider/name children stable semantic keys
so this picker correction also preserves identity through that normalization.

### Steps

1. Add native regression coverage with colliding IDs; prove it fails against
   the existing component.
2. Change the row key to include both provider and ID, and key the existing
   row's normalized children without altering their geometry.
3. Verify another-provider query, zero matches, restoration of the full list,
   and selection of both routes sharing an ID. Run repository gates and
   update the durable verification record.

### Verification

Extend `cli/src/components/__tests__/model-picker-scroll.test.tsx` with real
renderer assertions on child counts, captured frames, and selected provider
identity. Existing viewport, activation, and overlay suites protect the
production picker behavior. Run root typecheck, zero-warning ESLint,
Markdown lint, changed-file formatting checks, and quality.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/__tests__/model-picker-scroll.test.tsx
- gate: test cli/src/components/__tests__/picker-viewport.test.ts
- gate: test cli/src/chat/__tests__/model-picker-activation.test.ts
- gate: test cli/src/components/__tests__/dialog-overlay.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:d5bfbc38ea97bf5adfa57b05f4c3c560b6adcfdef1c5f3c430510199678fc9b5
- verified: 2026-10-03T15:29:35.101Z
- typecheck cli: exit 0
- test cli/src/components/__tests__/model-picker-scroll.test.tsx: exit 0
- test cli/src/components/__tests__/picker-viewport.test.ts: exit 0
- test cli/src/chat/__tests__/model-picker-activation.test.ts: exit 0
- test cli/src/components/__tests__/dialog-overlay.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED, GREEN, AUDIT

- **RED:** Exact native reproduction and duplicate-key warnings are quoted
  above. Logical filtering at `model-picker.tsx:51-57` is correct.
- **GREEN:** Provider-scoped row keys distinguish legitimate sibling routes.
  Existing native harness gains collision cases; no new production function.
- **AUDIT:** Source inspection independently agrees with native output:
  both catalog parsers can produce `openai/gpt-5`; list rendering discards
  provider identity. `chat/panels.tsx:168` renders this production component.
- **ADVERSARIAL:** ID deduplication would hide routes; excluding OpenAI would
  conceal the defect; whole-picker remounting would reset unrelated state.
  Provider-scoped keys address the demonstrated cause directly.
- **CHANGE DELTA:** Initial document; no measured percentage claim.

### Missed Questions

1. Is OpenAI bypassing the filter? No: the match count is correct; retained
   native renderables cause the visual discrepancy.
2. Are duplicate slugs invalid data? No: provider routes can share upstream
   IDs. Identity must include the serving provider.
3. Do existing tests expose this? No: their provider fixtures use disjoint
   IDs. Add actual overlapping IDs to the native renderer suite.
4. Does this change provider ranking? No. OpenAI and OpenRouter both have
   registry order 0; alphabetical tie-breaking still orders matching groups.

### Loop 2 — final convergence

Sequential-thinking review confirms the bounded change uses existing
component and test seams. Native reproduction plus source review establish
the cause. The plan converged before implementation. The two native search
regressions failed against the old component (4 children instead of 2;
6 instead of 4). Provider-scoped keys make both pass and preserve independent
selection of each provider's entry. Row-child keys remove the additional
native missing-key warning; code review of the scoped diff confirms no
filter, geometry, ordering, or routing changes.

### Implementation Evidence

- Step 1 implemented: colliding-ID fixtures and two native search regressions
  in `cli/src/components/__tests__/model-picker-scroll.test.tsx:21,118`.
- Step 2 implemented: provider-scoped list key at
  `cli/src/components/model-picker.tsx:252`; semantic children at
  `cli/src/components/model-picker-rows.tsx:71-108`.
- Step 3 implemented: native search/scroll, viewport, activation and overlay
  suites: 19 pass / 0 fail / 195 assertions. The final declared-gate run is
  bound to the Verification Receipt below.
- Production reachability: `/model` opens the store in
  `cli/src/commands/defs/model-provider-commands.ts:68`; chat panels render
  `ModelPicker` at `cli/src/chat/panels.tsx:168`; it renders corrected rows
  at `model-picker.tsx:251-259`.
- Commit/archival blocked: no explicit commit authorization in this request.

### Code Verification Evidence

```text
Old component: 0 pass / 2 fail for the two native search regressions.
Corrected component: 19 pass / 0 fail across four affected suites.
Final keyed row children: search regressions 2 pass / 0 fail, no key warning.
Root typecheck: exit 0 across every workspace plus scripts.
ESLint . --max-warnings 0: exit 0.
SDK src/: 577 pass / 1 POSIX-only skip / 0 fail.
quality: PASS (1498 baselined files).
scope-register: PASS (0 issues).
```

The evidence uses the native headless renderer, not a full interactive chat
session. SDK serving-provider identity remains a distinct, documented defect
under FID-2026-1003-006; preserving picker selection objects does not claim to
resolve that routing collision.

## Resolution

Implemented and verified in the working tree. Provider-scoped React identities
prevent stale OpenAI rows after search. The active FID remains verified pending
explicit G2 commit authority; it is not closed or archived. No commit hash is
claimed. Markdown and changed-file formatting checks are part of final
artifact validation; the executed declared gates are receipt-stamped.

## Lessons Learned

Catalog aggregation introduces legitimate cross-provider ID collisions.
Native UI regression fixtures must cover overlapping IDs, not only larger
catalogs with distinct IDs.
