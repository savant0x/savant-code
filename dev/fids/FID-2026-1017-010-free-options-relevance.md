# FID: Free-options relevance and bounded boot output

**Filename:** `FID-2026-1017-010-free-options-relevance.md`
**ID:** FID-2026-1017-010
**Severity:** high
**Status:** verified
**Created:** 2026-10-17
**Automation level:** 3
**YAGNI-Compliance:** Verified — reuse the catalog, report, view and artifact.

## Summary

The free-options report partitions credentials but does not select models by
purpose or expiry. Boot Copy dumps all models and all offer categories. Add one
coding-focused selection for boot and the command, preserving the full report.

## Environment

- **OS:** Windows
- **Language/Runtime:** TypeScript strict; Bun 1.3.14
- **Tool Versions:** repository ESLint, markdownlint and native OpenTUI renderer
- **Commit/State:** `1ef369e5`; no tracked edits before this refinement

## Detailed Description

### Problem

The operator's boot copy lists 146 models and 223 offers, including speech,
embeddings, safety classifiers, music generation, startup grants and an expired
offer. `buildFreeOptionsReport` only checks observed availability and credentials.
`readProviderOfferDiscovery` returns all fresh-feed offers, including expired
ones. The panel is folded by default but Copy serializes the entire report.

### Expected Behavior

Boot and `/provider free` show relevant text-model candidates and coding/API
offers. Counts describe the selected set before preview truncation. Excluded
and unverified entries are accounted for. The full discovery artifact remains
available and keeps its existing path/hash integrity contract.

### Root Cause

`free-options-view.ts` clones raw lanes without suitability decisions. A separate
`isCodingHarnessModel` name filter is used only by selected provider catalogs.
No output-modalities or supported-parameters fields survive the free-catalog
lift. The offer deadline resolver exists but is not used by display selection.

### Evidence

Source inspection: `free-options.ts` groups every visible model; the view copies
those groups; `free-options-panel.tsx` maps every model and offer in Copy.
The local free-options cache contains only id/provider/context/expiry fields.
The operator's copy includes `lyria`, `whisper`, `embed`, safety and expired rows.

## Impact Assessment

### Affected Components

- Free-model lift and report metadata, shared view selection and command.
- Boot panel and its Copy action; broad artifact remains the evidence surface.
- Existing catalog name filter gains a shared classifier, retaining its strict
  policy and correcting the VL boundary for whitespace and `:free` suffixes.

### Risk Level

- [x] High: misleading suitability counts and overwhelming daily output.

## Proposed Solution

### Approach

Keep raw catalog lanes and offer evidence. Add optional structured model metadata
and offer deadlines to the report. A pure selector receives an explicit clock,
deduplicates per provider/model, checks expiry and non-chat purpose, and filters
offers to Coding/API providers without specialist media/safety/retrieval offers.
Structured output metadata outranks ambiguous vision/omni name hints; explicit
specialist tasks remain excluded. Missing metadata yields unverified candidates,
never a verified coding or tool-calling claim. Conditional account offers remain
advertised discoveries, not available balance. No vendor eligibility verification.

Bound the expanded boot list and Copy to five model rows per provider and five
offer rows total, with the full selected counts and report link. Default artifact
view remains broad. Command and boot use the same coding selection.

### Steps

1. Preserve metadata and implement shared selection with exclusion accounting — implemented.
2. Wire focused command/boot, bounded preview and copy, broad artifact retained — implemented.
3. Test realistic mixed feeds, native rendering, artifact preservation and gates — implemented.
4. Commit verified implementation, archive and update CHANGELOG — follows the final receipt.

### Verification

New behavior tests:
`cli/src/utils/__tests__/free-options-selection.test.ts` and
`cli/src/components/__tests__/free-options-panel-filtering.test.tsx`.
Existing view/artifact, offers, report, boot and native-render suites guard
contracts. No fetched provider catalog or inference call is required by tests.

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/utils/__tests__/free-options-selection.test.ts
- gate: test cli/src/components/__tests__/free-options-panel-filtering.test.tsx
- gate: test cli/src/utils/__tests__/free-options.test.ts
- gate: test cli/src/utils/__tests__/free-options-view.test.ts
- gate: test cli/src/utils/__tests__/free-options-offers.test.ts
- gate: test cli/src/utils/__tests__/free-options-boot.test.ts
- gate: test cli/src/components/__tests__/free-options-panel.test.tsx
- gate: test cli/src/components/__tests__/free-options-panel.render.test.tsx
- gate: quality

### Verification Receipt

- fingerprint: sha256:187dd756ba38e67e2a1c85d078c804c6389b65a0d32042194cfa9cb62b0009e0
- verified: 2026-10-18T00:45:32.699Z
- typecheck cli: exit 0
- test cli/src/utils/__tests__/free-options-selection.test.ts: exit 0
- test cli/src/components/__tests__/free-options-panel-filtering.test.tsx: exit 0
- test cli/src/utils/__tests__/free-options.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-view.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-offers.test.ts: exit 0
- test cli/src/utils/__tests__/free-options-boot.test.ts: exit 0
- test cli/src/components/__tests__/free-options-panel.test.tsx: exit 0
- test cli/src/components/__tests__/free-options-panel.render.test.tsx: exit 0
- quality: exit 0

## Perfection Loop

### Loop 1 — RED

- **RED:** No purpose/expiry selection; Copy includes broad discovery.
- **GREEN:** Preserve broad evidence and derive one focused selection.
- **AUDIT:** Production entry points share `buildFreeOptionsView`; wire its
  explicit audience option from boot and command, keeping artifact default broad.
- **ADVERSARIAL:** Hiding the dump alone leaves false counts. Select first and
  count that set; preview limits must not change those counts.

### Missed Questions

1. Does a configured key prove free quota? No; preserve the existing caveat.
2. Does a name prove tool calling? No; label unknown support explicitly.
3. Are vision-capable chat models necessarily unsuitable? No; explicit text
   output can resolve ambiguous vision/omni names, while specialist tasks exclude.
4. Must raw evidence disappear? No; preserve the full artifact and cache.
5. What is the relevant clock? Caller supplies now, not catalog fetch time.

### Loop 2 — Independent audit and self-correction

- **RED:** Provider aliases, cache metadata round trips and date-only deadlines
  can undermine selection; old reports contain only id strings.
- **GREEN:** Canonical provider keys, optional validated metadata, end-of-day UTC
  date resolution and explicit fallback for legacy reports.
- **AUDIT:** Tests pin duplicate/alias behavior, exact deadline boundary, retained
  multimodal text output, specialist exclusion and unverified support wording.
- **ADVERSARIAL:** Relevance does not certify availability; unknown candidates
  remain labeled and the full report is not silently rewritten as verified.

### Loop 3 — Final convergence

- **RED:** Separate Copy selection could diverge from the visible preview.
- **GREEN:** Share one preview transformation and render Copy from that view.
- **AUDIT:** Native and static rendering tests assert filtered rows and bounds;
  raw artifact tests still retain every source row and generation hash.
- **ADVERSARIAL:** No network, secret access, paid calls or new integrations.

### Implementation Evidence

Contract converged before source edits. `assessCodingModel` is called by the
model/offer selector; `buildFreeOptionsView` invokes selection only for the
explicit coding audience. Production command and boot callers pass that option
and a clock. Boot and Copy share `previewFreeOptionsView`. Default artifact view
retains source rows and the existing hash contract. Commit recorded at closure.

### Code Verification Evidence

Focused suites, including existing provider-catalog consumers: 78 pass, 0 fail.
CLI typecheck, SDK build, targeted zero-warning ESLint and format checks pass.
The ten declared FID gates pass; the final receipt below is refreshed after the
last audit corrections. Caller search confirms production entry points above.
Native rendering proves filtering and both preview limits, while artifact tests
prove raw excluded entries remain available. No account/model inference ran.

Read-only cached snapshot: wired 146 to 83 candidates; offers 223 to 114 relevant
rows. Ninety selected models (83 wired, seven not wired) lack capability metadata
and remain explicitly unverified. This is selection evidence, not vendor proof.
Session logs use `dev/session-summaries/2026-10-17-free-options-*.log`.

## Resolution

Implementation is verified locally; the final receipt, commit and archive finish
the delivery. Mandatory root push gates remain active.

## Lessons Learned

Discovery freshness, account readiness and suitability are distinct facts.
