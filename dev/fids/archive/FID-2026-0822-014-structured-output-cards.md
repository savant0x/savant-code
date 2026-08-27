# FID: Structured Output Cards — replace YAML dumps with shape-detected semantic renderers

**Filename:** `FID-2026-0822-014-structured-output-cards.md`
**ID:** FID-2026-0822-014
**Severity:** medium
**Status:** closed
**Created:** 2026-08-23
**YAGNI-Compliance:** Satisfied — pure classifier + four small cards + one
collapse wrapper; v1 exclusions honored (no density settings, no
virtualization, no i18n per Missed Q5).

---

## Summary

Tool outputs that lack a bespoke renderer are serialized to YAML text
(`formatToolOutput`/`toYaml` in `cli/src/utils/savant-code-client.ts`) and dumped as a
plain code block inside the TrafficLightPanel. YAML is a machine format: colons, quotes,
dash lists, no visual hierarchy — the panel reads as bunched-up config. Replace the generic
YAML fallback with **shape-detected semantic cards**: purpose-built views per payload type
(success / error / list / key-value record), receipt-collapse for long payloads, and a strict
typographic hierarchy (bold values, dimmed keys, monospace only for actual code). The
TrafficLightPanel chrome is retained unchanged; only the content layer is redesigned.

Operator directive (2026-08-23): approved direction = semantic cards + receipt-collapse +
typographic hierarchy (design discussion in session; options 2+3+4 from the proposal).

## Environment

- **Runtime:** OpenTUI React (`@opentui/core` 0.5.3, react ^19), Bun 1.3.14
- **Current pipeline:** tool result arrives → `updateToolBlockWithOutput`
  (`cli/src/utils/message-block-helpers/tool-output.ts`) → `formatToolOutput`
  (`cli/src/utils/savant-code-client.ts:192`) → `toYaml` → string stored on
  `toolBlock.output` → rendered via markdown code block inside TrafficLightPanel
  (`output-result.tsx`, `set-output.tsx`)
- **Existing bespoke renderers that must NOT regress:** DiffViewer (edits),
  RunTerminalCommandComponent (stdout/stderr), SequentialThinkingComponent,
  SetOutputComponent, OutputResultComponent
- **Commit/State:** main @ v0.0.27 working tree; concurrent sessions active — diff against
  working tree before editing, never revert foreign hunks

## Detailed Description

### Problem

1. `formatToolOutput` flattens every JSON payload through `toYaml`, producing machine-syntax
   text: `key: "value"`, `- ` list markers, `[]`/`{}` for empties, escaped quotes.
2. The markdown pipeline renders this inside a single `<code>` block — no alignment, no
   hierarchy, long values wrap mid-token.
3. Every new tool without a registered component inherits this fallback (currently:
   `find_files`, `list_tables`, `describe_table`, `execute_query`, `analyze_query`,
   `lookup_agent_info`, `query_blast_radius`, `query_domain_clusters`, `query_node_edges`,
   `ponytail_debt`, `run_file_change_hooks`, `get_goal`, `browser_logs` route through
   OutputResultComponent, which still renders YAML text).
4. Long payloads (deep_research results, large query tables) produce unbounded walls of text.

### Expected Behavior

- Success-shaped payloads render as a card with a success indicator row + message as primary
  content.
- Error payloads render an error-styled block with `errorMessage` prominent.
- Array payloads render compact rows with a count chip in the panel header (e.g. `3 files`);
  rows collapse to `[N entries — expand]` beyond a threshold with one-line previews.
- Key-value objects render two-column aligned (dimmed keys left, bold values right), nested
  objects indent under a subtle left border line instead of dash markers.
- Code-like strings (paths, hashes) stay monospace; prose stays in the UI font.
- Zero YAML syntax visible to the user anywhere in the fallback path.

### Root Cause

The renderer registry maps tools to components, but any payload *shape* without a component
falls through to serialized-YAML-as-text. The serializer was built for transcript export
(`copy-conversation-render`), not human display; the display path inherited it.

## Impact Assessment

### Affected Components

- NEW: `cli/src/components/tools/structured-card/` directory (per quality-gate decomposition):
  - `StructuredCard.tsx` — dispatcher (shape detection + card selection)
  - `SuccessCard.tsx`, `ErrorCard.tsx`, `ListCard.tsx`, `RecordCard.tsx`
  - `collapse.tsx` — receipt-collapse wrapper + preview line
  - `hierarchy.tsx` — shared typographic primitives (KeyValue row, dim/bold spans)
- MODIFIED: `output-result.tsx` + `set-output.tsx` (route through StructuredCard instead of
  formatToolOutput→markdown); `registry.ts` aliases unchanged (component swap is internal)
- UNTOUCHED: bespoke renderers listed above; `formatToolOutput` itself (still used by
  copy/export paths — display-only change)
- Tests: new suite per card + dispatcher; existing output-result/set-output suites updated

### Risk Level

- [x] Medium: broad surface (13+ aliased tools), but additive — bespoke renderers and export
      paths untouched; worst case is visual, caught by characterization tests.

## Proposed Solution

### Approach

Shape detection is a pure function over the parsed JSON value:

```text
classifyPayload(value): 'error' | 'success' | 'list' | 'record' | 'empty'
  - has string errorMessage        → error
  - has string message (+ scalar)  → success (message is primary content)
  - Array.isArray                  → list (with item classification for rows)
  - plain object                   → record (key-value two-column)
  - null/undefined/''              → empty (render nothing; current behavior preserved)
```

Rendering rules (contract tokens only — zero hardcoded hex):

| Card | Layout |
| --- | --- |
| SuccessCard | `✓` glyph (theme.success) + message in foreground bold; remaining scalars as KeyValue rows below |
| ErrorCard | theme.error accent border-left + errorMessage bold; stack trace-ish strings in monospace |
| ListCard | count chip in panel title bar area (`N items`, muted); rows = per-item mini-record or scalar bullet; >8 items collapse with `[N more — expand]` toggle |
| RecordCard | two-column grid: keys dimmed/muted fixed-width column, values foreground bold, wrap on overflow; nesting = indented sub-grid with left border line (theme.border), max depth 3 then collapse |
| EmptyCard | render nothing (preserves today's empty-output behavior) |

Collapse mechanics: expanded state local per card instance (useState), default collapsed when
item count > 8 or serialized length > ~40 lines; preview = first entry's one-line summary.
Reduced-motion: expand/collapse snaps, no animation.

### Steps

1. **Characterization first:** snapshot current YAML output of output-result + set-output for
   representative payloads (success/error/list/nested/deep-nesting) BEFORE changes — the
   export path (`formatToolOutput`) must remain byte-identical afterward.
2. Build `hierarchy.tsx` primitives + unit tests (pure rendering, static mock pattern per
   `__tests__/helpers/mock-opentui-react-static.ts`).
3. Implement classifier + four cards + collapse wrapper; unit tests per shape including
   edge cases (empty arrays, mixed-type arrays, depth-4 nesting, errorMessage + extra fields).
4. Wire dispatcher into `output-result.tsx` and `set-output.tsx`; delete their YAML-fallback
   branches. Keep `formatToolOutput` untouched (export/copy path).
5. Update existing suites asserting removed markup; add integration assertions that
   `copy-conversation-render` / export paths still serialize YAML identically.
6. Production smoke: drive real TUI rendering a deep_research result, a browser_logs dump,
   a get_goal object, and an error payload; screenshot each; record NEEDS-REVIEW items if
   contrast/spacing needs operator eyes (test renderer is not a proxy — LEARNINGS).

### Verification

- cli typecheck exit 0; eslint --max-warnings 0 on all changed files; prettier clean
- New structured-card suites green; existing output-result/set-output suites updated green
- Export-path byte-equivalence test: formatToolOutput output identical pre/post for fixture
  corpus (guards the copy/export contract)
- Zero `toYaml` references in `cli/src/components/` after change (grep gate — YAML never
  reaches display again)
- Production TUI smoke checklist recorded in Resolution

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/tools/structured-card/__tests__/classify.test.ts
- gate: test cli/src/components/tools/structured-card/__tests__/structured-card.test.tsx

### Verification Receipt

- fingerprint: sha256:a4ea115f6c4236eb0b823816974add98a0e000a03f2a5dee57355f7012a60226
- verified: 2026-08-23T23:01:40.580Z
- typecheck cli: exit 0
- test cli/src/components/tools/structured-card/__tests__/classify.test.ts: exit 0
- test cli/src/components/tools/structured-card/__tests__/structured-card.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED (planning, 2026-08-23)

- **Trigger:** operator report — YAML blocks "terrible, bunched up text, no formatting"
  despite traffic-light chrome. Design discussion produced approved direction (semantic
  cards + receipt-collapse + typographic hierarchy).
- **RED findings:** R1 machine-format-to-human display (root cause above); R2 unbounded
  payload walls; R3 punctuation noise (colons/quotes/dashes); R4 no hierarchy (keys vs
  values visually equal); R5 13+ aliased tools share the bad fallback; R6 export/display
  coupling (fixing display must not alter export bytes); R7 concurrent-session file overlap
  risk on output-result.tsx (diff against working tree required).
- **GREEN/AUDIT/ADVERSARIAL:** PENDING — owned by implementing session; GREEN decisions are
  pre-seeded in Proposed Solution (classifier thresholds, card layouts, collapse rules) and
  must be re-audited there.

### Loop 2 — Implementation (2026-08-23)

> Implemented in one session pass behind the converged Loop-1 spec;
> Orchestrator-direct writes (the Recorder relay stalled twice same day),
> ground-truth verified on disk after every write batch per the harness
> rhythm.

- **KEY ENABLER:** `ToolBlock.outputRaw` (`cli/src/types/chat.ts:44`)
  existed with readers but ZERO writers — populating it in
  `updateToolBlockWithOutput` gave the display layer the raw serialized
  parts with no type or pipeline churn.
- **IMPLEMENTED:** NEW `cli/src/components/tools/structured-card/` —
  `classify.ts` (pure classifier/unwrap/summarize; single exported
  `SUMMARY_MAX_LENGTH`), `hierarchy.tsx` (KeyValueRow/MutedText/
  PrimaryText/IndentBlock primitives), `collapse.tsx` (ReceiptCollapse,
  threshold 8, snap expand/collapse toggle), SuccessCard/ErrorCard/
  ListCard/RecordCard, `StructuredCard.tsx` dispatcher. MODIFIED
  `output-result.tsx` + `set-output.tsx` (YAML code-block branches deleted;
  TrafficLightPanel chrome retained); `utils/message-block-helpers/
  tool-output.ts` generic branch stores `outputRaw` parts while the
  formatted `output` string stays byte-identical for copy/export.
- **TESTS:** NEW classify suite 18, cards/dispatcher/collapse static
  renders 16, formatToolOutput export byte pins 7 (fixture corpus:
  success/error/list/nested/text/string/empty-containers);
  output-result suite rewritten over raw parts (5); set-output untouched
  and passing (4).
- **AUDIT:** Verifier PASS WITH CONDITIONS (spec conformance, export-path
  safety, regression risk all cited); Adversary STANDS the verdict first-
  hand and added two pre-existing omission findings routed as follow-ups:
  `tool-branch.tsx:74-78` residual yaml fallback for tools with NO
  registered component, and `use-scaffold-revert-subscriber.ts:18-24`
  latent dead outputRaw key-check (behavior unchanged by -014; now
  trivially fixable).
- **CONDITIONS DISCHARGED SAME ROUND:** vacuous ReceiptCollapse test
  removed (threshold assertion strengthened with `not.toContain('row-8')`);
  triplicated preview constant consolidated into exported
  `SUMMARY_MAX_LENGTH`; NestedItems depth threading aligned with record
  recursion (depth+1 instead of hardcoded reset).
- **GATES (all tool-mediated):** cli typecheck exit 0 · eslint
  `--max-warnings 0` on every touched file · prettier clean · focused
  suites **50 pass / 0 fail** (105 expect()) · grep `toYaml` in
  `cli/src/components` → zero matches · Law 4 chain grepped: registry.ts
  aliases (:79/:86-99) → both components import StructuredCard →
  updateToolBlockWithOutput consumed at spawn-results.ts:150.
- **HONEST BOUNDARY:** production TUI smoke (Step 6) NOT performed —
  carried NEEDS-REVIEW (operator visual pass; test renderer is not a
  proxy per LEARNINGS).
- **CHANGE DELTA:** this Loop 2 entry; Code Verification Evidence refresh;
  Step Status flips; Resolution note; status `created` → `fixed`.

### Missed Questions

1. Does dispatching by shape break tools that WANT raw text? No — run_terminal_command keeps
   its stdout/stderr renderer; code-block strings pass through RecordCard's monospace value
   treatment. Any tool can opt out via its own registered component (existing mechanism).
2. Where does the count chip live? Inside the TrafficLightPanel content area top row
   (right-aligned, muted) — the lights title bar itself is untouched.
3. Does the classifier need to be exhaustive? No — unknown shapes degrade to RecordCard
   (generic key-value), which is always valid JSON rendering. Fail-open to readable.
4. Interaction with FID-2026-0822-006 (TUI chrome unification)? Complementary — that FID
   standardizes the frame; this FID standardizes the content inside it. Sequence after 006
   lands to avoid double-churn on the same files.
5. v1 exclusions: no user-configurable density settings, no virtualized scrolling (caps +
   collapse suffice), no i18n of card labels.

### Code Verification Evidence

Planning-stage record (status `created`; Loop 1 RED only). Pipeline claims
disk-verified 2026-08-23 by grep/ls:

- `toYaml` defined at `cli/src/utils/savant-code-client.ts:143`;
  `formatToolOutput` exported at :193 — the YAML serialization path is
  exactly as described (grep hits at :169/:179/:215/:229 confirm internal
  `toYaml` usage).
- Consuming surfaces exist as cited: `cli/src/components/tools/output-result.tsx`,
  `cli/src/components/tools/set-output.tsx`,
  `cli/src/utils/message-block-helpers/tool-output.ts`.
- Test seam present:
  `cli/src/components/tools/__tests__/helpers/mock-opentui-react-static.ts`.
- Implementation gates (typecheck / suites / eslint / prettier / the
  zero-toYaml-in-components grep / export-path byte-equivalence) become
  mandatory at this FID's implementation AUDIT, not at this planning
  record.
- 2026-08-23 Loop 2: ALL implementation gates GREEN — cli typecheck exit 0;
  eslint `--max-warnings 0` across the new module + both consumers + the
  pipeline writer; prettier clean; focused battery 50 pass / 0 fail (105
  expect()) incl. the 7 export byte pins proving `formatToolOutput`
  byte-stability; zero-toYaml grep zero matches; Law 4 reachability chain
  grepped end-to-end. Verifier PASS WITH CONDITIONS discharged same round;
  Adversary STANDS. Status `fixed`.

## Step Status

- [x] Characterization snapshots (export-path byte-pin suite is the corpus
      guard)
- [x] Hierarchy primitives + tests
- [x] Classifier + 5 cards + collapse wrapper + tests
- [x] Dispatcher wired into output-result + set-output
- [x] Export-path byte-equivalence verified
- [x] Gates: typecheck / eslint / prettier / suites / zero-toYaml-in-components grep
- [x] Production TUI smoke recorded (NEEDS-REVIEW — waived by operator
      close directive 2026-08-23; never claimed passed)

## Resolution

Implemented + audited 2026-08-23 (Loop 2): status `fixed`. The YAML-dump
fallback is gone from the display path — shape-detected structured cards
render inside the unchanged TrafficLightPanel chrome for OutputResultComponent
(13 aliased tools) and SetOutputComponent, with receipt-collapse beyond 8 rows
and a strict dim-key/bold-value hierarchy. The copy/export contract is pinned
to byte-identical serialization by the new formatToolOutput test suite.
CLOSED + ARCHIVED 2026-08-23 by operator directive ("close all 4 fixed"): the
production-TUI-smoke boundary (deep_research result, browser_logs dump,
get_goal object, error payload) was WAIVED by the close directive (FID-2026-0823-005 waiver precedent)
— never claimed passed. Working-tree closure (release-only-commits). Follow-up material routed by the Adversary:
tool-branch.tsx unregistered-component yaml fallback;
use-scaffold-revert-subscriber latent dead outputRaw check.