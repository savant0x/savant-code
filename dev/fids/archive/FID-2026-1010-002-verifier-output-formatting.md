# FID: Verifier output fragmentation, duplicate review and thinking-tag leakage

**Filename:** `FID-2026-1010-002-verifier-output-formatting.md`
**ID:** FID-2026-1010-002
**Severity:** medium
**Status:** closed
**Created:** 2026-10-10 13:19
**Automation level:** 1
**YAGNI-Compliance:** Verified

## Summary

An Orchestrator-spawned Verifier review appears twice: one readable copy and
one copy broken into text fragments, including split words, split paths and
thinking markup. Production-function probes reproduce the formatting
failure. The same fragmented history also makes provenance extract only
the final text fragment. This record covers the final-output projection,
reasoning presentation, complete verdict extraction and contradictory
Verifier formatting instructions. The operator requested this FID and its
Perfection Loop before implementation approval. The operator authorized
implementation with "approve work"; the fix is verified and committed locally.

## Environment

- **OS:** Windows; PowerShell.
- **Language/Runtime:** TypeScript strict monorepo; Bun 1.3.14.
- **Tool Versions:** OpenTUI core/react 0.5.3; React 19.
- **Commit/State:** existing working tree; local commits authorized.
- **Governance:** ECHO v0.1.2 single-agent; strict mode; session level 3,
  item level 1. Implementation and local commits authorized 2026-10-10.

## Detailed Description

### Problem

The supplied review of `logo-sidebar-s.svg` contains prose followed by
FAIL/NEEDS-REVIEW entries, then repeats that review with `jud` / `ge`,
`logo-sidebar-` / `s.svg`, and similarly fragmented verdict words. A literal
`</think` is visible. Its SVG claims are quotations from the review;
current SVG correctness has not been audited in this investigation.

### Expected Behavior

The expanded completed Verifier branch presents one canonical review.
Words, paths, inline code, glyphs and intentional newlines preserve their
source bytes; terminal wrapping follows available width. Thinking belongs
in reasoning blocks with collapse controls, and scaffolding tags do not
appear in verdict text. Final results repair an incomplete stream without
duplicating the same review. Raw evidence and provenance retain the full
selected final turn, independently of its display projection.

Verifier output consists of evidence-citing PASS, FAIL or NEEDS-REVIEW
entries. An unavailable numeric citation becomes NEEDS-REVIEW with the
missing evidence named; it is never replaced by an invented line number.

### Root Cause

1. `packages/agent-runtime/src/tools/stream-parser/grounding-stager.ts:104`
   calls `assistantMessages.push(assistantMessage(cleaned))` once per
   emitted text chunk. Adjacent assistant messages can therefore represent
   pieces of one word, not separate prose paragraphs.
2. `cli/src/utils/message-block-helpers/spawn-result.ts:95` uses
   `.join('\n')` across assistant messages for both `lastMessage` and
   `allMessages`. For a selected fragmented final turn, this inserts bytes
   the model did not emit, including inside paths and thinking tags.
3. `cli/src/utils/sdk-event-handlers/spawn-results.ts:81` appends divergent
   final text beside the streamed preview. A fragmentation or reasoning
   mismatch is treated as two different responses, producing duplication.
   The appended final block bypasses thinking parsing.
4. `cli/src/utils/block-operations/think-parsing.ts:110` relies on content
   segments from `parseThinkTags`. A standalone `<think>` yields no
   content segment and no open reasoning block; subsequent reasoning is
   ordinary text. Complete reasoning segments are also dropped by the
   `if (thinkingOpen)` guard at line 150, unlike streamed open segments.
5. `packages/agent-runtime/src/provenance/verdict.ts:36` scans backward and
   returns the first assistant message with text. With fragmented history,
   that is the last chunk, not the complete verdict. Its line 51 newline
   join can additionally corrupt multiple text parts.
6. `agents/verifier/verifier.ts:40` permits an uncited "looks good" sentence,
   line 44 requests emitted thinking tags, and lines 63–74 require concise
   evidence-citing verdicts. The request for narrative scaffolding and the
   uncited success instruction conflict with the verdict contract.

### Evidence

All probes used `bun --no-env-file -e` to call existing production exports;
no project file was written by those commands. Synthetic audit-note text
was used to test transport rather than generate a new model review.

```text
CLI extraction probe, exit 0:
expected: "The verifier must\njudge three checks on logo-sidebar-s.svg\nFAIL art/icons/cyberpunk/logo-sidebar-s.svg:15"
actual:   "The verifier must\n\njud\nge three checks on logo-sidebar-\ns.svg\nFAIL \nart/icons/cyberpunk/logo-sidebar-s.svg:15"
equal: false

Runtime stager and provenance probe, exit 0:
stream: "FAIL art/icons/cyberpunk/logo-sidebar-s.svg:15 - incorrect rect"
assistantMessages: 4
storedText: ["FAIL ", "art/icons/cyberpunk/logo-sidebar-", "s.svg:15", " - incorrect rect"]
receiptVerdict: " - incorrect rect"

CLI standalone-tag and extraction probe, exit 0:
chunks: ["<think>", "Audit notes", "</thi", "nk>", "\nFAIL ", "logo-sidebar-", "s.svg:15 - wrong rect"]
streamedVisibleText: "Audit notes</think>\nFAIL logo-sidebar-s.svg:15 - wrong rect"
finalResult: "<think>\nAudit notes\n</thi\nnk>\n\nFAIL \nlogo-sidebar-\ns.svg:15 - wrong rect"
equal: false

Existing CLI baseline, workspace-root invocation:
38 pass; 0 fail; 61 expect() calls; 3 files; exit 0.
```

The reproduction establishes defects in current code; it does not establish
the exact provider, raw payload or split locations of the historical run.
Empty glyph strings in the sample need raw-run evidence to distinguish
missing model evidence from display/copy loss. Preserve Unicode in tests;
do not reconstruct historical glyphs by guessing.

## Impact Assessment

### Affected Components

- CLI `lastMessage` extraction and spawn-result reconciliation.
- Shared root/sub-agent thinking parser and reasoning block lifecycle.
- Runtime final-turn selection and raw provenance verdict extraction.
- Verifier instructions; no tool permissions or evidence access changes.
- Other `lastMessage` children can share the newline defect. `allMessages`
  paragraph separators and non-auditor divergent-preview behavior need
  explicit compatibility coverage.

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability.
- [ ] High: Major feature broken, no workaround.
- [x] Medium: Review readability and audit-evidence completeness degraded.
- [ ] Low: Minor cosmetic issue only.

## Proposed Solution

### Approach

Keep streamed events and persisted history intact. Repair the consumers
that confuse assistant fragments with separate paragraphs. For
`lastMessage`, concatenate text parts and selected assistant fragments
with an empty separator, preserving only source newlines. Keep
`allMessages`' existing separation between distinct messages.

Expose and reuse `getLastAssistantTurnMessages` from the existing runtime
output module for provenance. Extract all text parts of that selected turn
in order with no injected separator. Do not change signing, existing
receipt bytes, raw thinking content or the selection policy.

Repair the existing shared thinking parser to represent empty open-tag
state, retain completed reasoning as closed reasoning blocks, recognize
tags split at any character boundary, and close unfinished reasoning on
completion. Use that same parser to derive final-result display blocks
before comparing final text with streamed text. Native reasoning remains
separate and collapsible. Ordinary XML and SVG snippets remain text.

For Verifier and Adversary final results, reconcile to one authoritative
visible final review; preserve reasoning, tool and nested-agent blocks and
their relative order. Equivalent normalized output is idempotent. A
partial preview receives its missing suffix in the existing text block,
avoiding a false visual paragraph boundary. A genuinely divergent audit
preview yields to the final review. Preserve non-auditor divergent-preview
behavior unless a separate evidenced requirement authorizes changing it.
Treat missing `textType` as normal text, matching final-only block shapes.
Final replay must not append reasoning already present in the stream. Empty
or error results preserve usable streamed evidence; cancellation closes
reasoning without manufacturing a completed verdict. Streamed and final
display projections must agree for whole and fragmented tag delivery.

Remove the Verifier's emitted-thinking-tag instruction and uncited-success
shortcut. Keep its zero-tool role, evidence rules and concise verdict
schema; no deterministic formatter invents or upgrades verdict evidence.
Parser repair is still required for legacy/custom/provider output.

### Steps

1. **completed:** repair `lastMessage` extraction
   and pin byte equality for fragmented messages and text parts, Unicode,
   explicit newlines, and compatibility with `allMessages` and errors.
2. **completed:** repair shared thinking parsing
   and completion, covering standalone and fragmented tags, native
   reasoning, unfinished streams and root/sub-agent parity.
3. **completed:** normalize final display through
   the parser; reconcile complete, partial, divergent and replayed audit
   results; preserve tools, children, reasoning and non-auditor behavior.
4. **completed:** reuse final-turn selection for
   complete raw provenance text; prove raw chunks are neither truncated nor
   sanitized; exclude history outside the existing selected final turn.
5. **completed:** align Verifier instructions
   with one evidence-citing output contract and pin the zero-tool boundary.
6. **completed:** render the replay through real
   OpenTUI and exercise it in tmux; verify readable complete text once at
   60/100/160 columns, resize and collapse/expand, with preserved Unicode.
7. **completed — repository-wide gates:** run implementation gates,
   re-read code against this FID, stamp its receipt, and prepare closure
   evidence. All declared gates pass; local closure commits are authorized.

### Verification

The implementation must add or extend these artifacts after approval:

- `cli/src/utils/__tests__/message-block-helpers-spawn-result.test.ts`:
  fragmented final turns, multiple text parts, Unicode, intentional blank
  lines, `allMessages` compatibility, error and empty outputs.
- `cli/src/utils/__tests__/sdk-event-handlers-final-result.test.ts`:
  real start/chunk/finish/result replay for Verifier and Adversary, duplicate
  delivery, partial/missing/divergent streams and intact non-text blocks;
  retain the existing non-auditor divergent-preview regression.
- `cli/src/utils/__tests__/send-message-helpers-agent-blocks.test.ts` and
  `cli/src/utils/__tests__/send-message-helpers-root-stream.test.ts`:
  standalone, whole and every-split-position tag parsing, completed and
  unclosed reasoning, native reasoning, ordinary SVG and Unicode text.
- `packages/agent-runtime/src/__tests__/verifier-output-contract.test.ts`:
  real stager fragments through `getAgentOutput` and `extractVerdictText`,
  exact raw byte equality, prior-turn exclusion and tagged error exclusion.
- `agents/__tests__/verifier-prompt-content-gate.test.ts`:
  emitted-tag and uncited-success instructions absent, verdict/evidence
  contract and zero-tool configuration present.
- `cli/src/components/__tests__/verifier-output-rendering.test.tsx`:
  actual native rendering from replayed blocks, one verdict copy at wide
  widths, lossless wrapping at narrow width, folds and resize.

Full implementation checks also include `bun run typecheck`, workspace
test batteries for CLI/runtime/agents, ESLint zero warnings, markdownlint,
scoped Prettier checks, quality report, scope-register check and repository
validation. A passing baseline is not a passing fix. No new regression
artifact or implementation PASS is claimed before approval.

## Verification Gates

- gate: typecheck agents
- gate: typecheck cli
- gate: typecheck packages/agent-runtime
- gate: test cli/src/utils/__tests__/message-block-helpers-spawn-result.test.ts
- gate: test cli/src/utils/__tests__/sdk-event-handlers-final-result.test.ts
- gate: test cli/src/utils/__tests__/send-message-helpers-agent-blocks.test.ts
- gate: test cli/src/utils/__tests__/send-message-helpers-root-stream.test.ts
- gate: test packages/agent-runtime/src/__tests__/verifier-output-contract.test.ts
- gate: test agents/__tests__/verifier-prompt-content-gate.test.ts
- gate: test cli/src/components/__tests__/verifier-output-rendering.test.tsx
- gate: test cli/src/utils/__tests__/verifier-thinking-stream.test.ts
- gate: test cli/src/utils/__tests__/verifier-result-replay.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:5a98c37d4a4b575104135c3dda77613c50149e2b582abc19194f5a7f2e8362d5
- verified: 2026-10-10T19:31:42.577Z
- typecheck agents: exit 0
- typecheck cli: exit 0
- typecheck packages/agent-runtime: exit 0
- test cli/src/utils/__tests__/message-block-helpers-spawn-result.test.ts: exit 0
- test cli/src/utils/__tests__/sdk-event-handlers-final-result.test.ts: exit 0
- test cli/src/utils/__tests__/send-message-helpers-agent-blocks.test.ts: exit 0
- test cli/src/utils/__tests__/send-message-helpers-root-stream.test.ts: exit 0
- test packages/agent-runtime/src/__tests__/verifier-output-contract.test.ts: exit 0
- test agents/__tests__/verifier-prompt-content-gate.test.ts: exit 0
- test cli/src/components/__tests__/verifier-output-rendering.test.tsx: exit 0
- test cli/src/utils/__tests__/verifier-thinking-stream.test.ts: exit 0
- test cli/src/utils/__tests__/verifier-result-replay.test.ts: exit 0
- quality: exit 0

## Perfection Loop

Implementation authorized 2026-10-10 by the operator: "approve work".
The approval below is execution authority for steps 1–7; historical planning
statuses record the preapproval audit. Local commit authority was granted
with "ok then clear the blocks and complete the work, commit locally".
Small streaming/reconciliation helpers and dedicated regression files may
be split to honor the active TypeScript skill's 300-line ceiling.

### Loop 1 — RED, GREEN and document audit

- **RED:** six current findings above; three read-only probes reproduce
  fragmentation, thinking-state loss and partial provenance extraction.
- **GREEN:** consumer concatenation, shared parser repair, audit-specific
  reconciliation, existing final-turn selector reuse and prompt alignment
  are fully specified; every implementation step awaits approval.
- **AUDIT:** static citations resolve in the files read 0–EOF; production
  probes use the actual exported functions. Existing tests pass 38/38 but
  omit the failing combinations. No new implementation is verified.
- **ADVERSARIAL:** single-agent document challenge: a join-only change
  leaves the standalone-tag leak; a prompt-only change leaves historical
  data corruption; source coalescing changes shared history and fails to
  repair persisted fragmented turns. Chosen approach repairs consumers and
  parser with explicit raw/display and non-auditor compatibility boundaries.
- **CHANGE DELTA:** initial document creation; no revision percentage.

### Missed Questions

1. Are the breaks terminal wrapping? The extraction probe adds literal
   newlines without rendering, establishing a transport/display defect.
2. Is duplication generated by the model? The divergent-result branch
   appends the final text; independent probes make stream and final differ.
   The historical model response remains unmeasured.
3. Can the fix suppress a genuine finding? Audit final text is authoritative;
   raw history remains intact. Never deduplicate by fuzzy word matching.
4. Can a thinking-tag-only chunk lose state? Yes, reproduced; an empty open
   reasoning state and split-position tests are mandatory.
5. Do receipts contain the same complete verdict? No in the probe; reuse
   final-turn selection and concatenate raw text without sanitizing it.
6. Must `allMessages` and other agents change behavior? No. Pin their
   existing contracts and constrain authoritative replacement to auditors.
7. Can glyphs be guessed from the sample? No. Test exact Unicode bytes and
   obtain raw historical evidence before any claim of glyph recovery.
8. Does a prompt edit fix everything? No; it removes contradictory output
   instructions while the shared parser handles historical and custom data.

### Implementation Evidence (REQUIRED for `closed`)

- **Commit SHA:** `a032bdfb27a4e9d6295dc90b038dbe2104039752` (implementation);
  `c9c30b8f` (catalog/test blockers); `5f8b6e26` (preview verification tooling).
- **File:line evidence:** `spawn-result.ts:95` preserves source separators;
  `think-parsing.ts:58` parses streamed tags; `spawn-results.ts:16` routes
  final display to `spawn-result-reconciliation.ts:70`;
  `provenance/verdict.ts:36` concatenates the selected raw final turn.
- **Gate output:** 13/13 declared gates pass; all-green receipt stamped.
- **Reproducibility:** production event replay plus native OpenTUI/tmux.
- **Step statuses:** 1–7 completed; local commit authorized.

### Code Verification Evidence

- Referenced production components exist and were read completely.
- Fragmentation, replay, tag-boundary and raw-evidence regressions pass.
- Native test and tmux checks cover 60/100/160 columns and fold controls.
- Current production route: `processStream` → `createGroundingStager` →
  `getAgentOutput` → spawn result → `extractSpawnAgentResultContent` →
  `handleSpawnAgentsResult` → `AgentBody` normal text rendering.
- Verdict receipt route: `runSingleSubagent`/inline spawn →
  `applyVerdictReceipts` → `extractVerdictText` → `bindVerdict`.

### Loop 2 — Independent method and self-correction

- **RED:** actual `handleSpawnAgentsResult` replay produces two normal text
  blocks after the first result and three after duplicate delivery, exit 0.
  Whole-tag input hides audit notes; standalone-tag input leaks them,
  exit 0. `markAgentComplete` leaves tagged `thinkingOpen: true`, exit 0.
- **GREEN:** preserve source separators; finalize tagged/native reasoning
  on finish and cancellation; recognize untyped final text; reuse parsed
  final output without adding another reasoning copy. The existing steps
  cover these findings; final projection and completion requirements above
  now state the boundaries explicitly.
- **AUDIT:** second method calls production result reconciliation rather
  than just its extractor. Static confirmation:
  `cli/src/utils/block-operations/agent-lifecycle.ts:51` calls
  `closeNativeReasoningBlock`, which excludes tagged thinking blocks via
  `cli/src/utils/block-operations/primitive-blocks.ts:48`.
- **ADVERSARIAL:** replaying an untyped final text block bypasses the
  explicit `textType === 'text'` filter at spawn-results.ts:56. Treat both
  normal shapes as visible text. Preserve empty/error evidence and native
  reasoning; reject replacing all child blocks wholesale.
- **CHANGE DELTA:** 2,064 Levenshtein edits / 16,906 prior characters =
  12.21%; the revision exceeded the 10% cap. The initially claimed compliance
  was incorrect. Record this process failure; premeasure later corrections
  before applying them. No production source was changed.

**Plan:** 3 thoughts (estimate). Subject: repair the proven output path.

### Thought 1

Chunk separators corrupt final output before rendering; keep source bytes.

### Thought 2

A join-only fix leaves reasoning state and replay defects; repair all three
consumers while keeping raw evidence separate from display blocks.

### Thought 3

The second-method probes support the proposal. Prompt-only and history
rewrite alternatives leave demonstrated failures or widen shared behavior.

### Final

Use consumer concatenation, shared tag parsing, idempotent auditor-result
reconciliation and complete raw final-turn extraction; await approval.

### Loop 3 — Final convergence

- **RED:** second-method probes and caller searches resolve the current
  failures; implementation and native-render verification remain reserved
  until approval. The document's revision-cap claim needed correction.
- **GREEN:** corrected that claim and retained every identified fix and
  test requirement; no finding was removed to reduce the change size.
- **AUDIT:** scoped markdownlint exit 0; scoped Prettier reports
  `All matched files use Prettier code style!`; scope-register reports
  `scope-register PASS (0 issues)`. Caller searches confirm stream parsing,
  final-result rendering and both inline/batch receipt-binding routes.
- **ADVERSARIAL:** the proposed repairs cover exact source-byte preservation,
  tag state, final-only/partial/replayed/divergent results, raw signed text,
  Unicode, cancellation and native reasoning without widening tool access.
  No additional actionable design gap remains in this document audit.
- **CHANGE DELTA:** 1,420 edits / 18,907 prior characters = 7.51% for this
  correction. Final metadata update prebounded at 500 / 20,267 = 2.47%.
  Document verification does not claim that code is repaired.

The proposal has passed single-agent document review. Implementation awaits
the operator's explicit approval; no native rendering or code gate PASS is
claimed, and no FID verification receipt is stamped before implementation.

### Loop 4 — Implementation audit

- **RED:** regressions exposed an empty block left by a split opener,
  duplicate partial reasoning after EOF, and repeated error text.
- **GREEN:** preserve opener state, complete partial reasoning in its existing
  block, and recognize replayed error/final text. Dedicated fixtures keep
  tests and helpers within the 300-line ceiling.
- **AUDIT:** targeted CLI set: 68 pass / 0 fail; runtime battery:
  1,973 pass / 0 fail; agents: 158 pass / 0 fail; full SDK retry:
  676 pass / 1 skip / 0 fail. Full typecheck, ESLint, markdownlint and
  scope-register pass. Development build passes with
  `SAVANT_CODE_BUILD_ENV=dev`; the default release build rejects local
  public environment values. No release was published.
- **ADVERSARIAL:** every tag split preserves root/subagent projection;
  whole and partial replay preserve one review, raw history, tools and
  children. Real OpenTUI and tmux at 60/100/160 columns retain paths,
  glyphs and fold controls. Renderer assertions pass; existing React key
  and listener diagnostics remain visible.
- **BLOCKERS:** full CLI retry: 4,089 pass / 18 skip / 6 fail, all six in
  catalog expectations. Four provider/catalog files exceed 300 lines.
  Repository validation also flags the separate TokenHarbor FID structure
  and scratchpad-root artifacts. Ownership clarification was requested;
  no reply is treated as authorization to overwrite other registered work.
  FID runner: 12/13 gates pass; quality exit 1; receipt not stamped.
  G2 commit authorization remains separate.
- **CHANGE DELTA:** this appended audit is prebounded at 1,900 characters
  / 21,073 prior characters = 9.02%; source changes are covered by approval.

## Resolution

### Loop 5 — Authorized blocker repair, document convergence

- **Authority:** operator: "ok then clear the blocks and complete the work,
  commit locally". Ownership clarification and G2 authority are resolved.
- **RED:** current quality reports four catalog files over 300 lines. Six
  CLI failures still expect the removed `tokenharbor/th-orchestra` or the
  old 17-model roster. The registered catalog is 68 entries.
- **GREEN:** move TokenHarbor IDs, context rows, labels and its existing
  test suite into dedicated sibling modules; re-export existing public
  symbols and spread rows in their original position. Update isolation
  fixtures to a surviving ID; check the gateway baseline against the shared
  roster while retaining independent count, label and window pins.
  Correct the other active catalog FID's missing structural sections and
  bare gate declarations; preserve its historical findings and status.
  Archive the two scratchpad-root HUD probe artifacts with their bytes
  intact, preserving the canonical reusable script under `cli/scripts/`.
- **AUDIT:** complete source reads confirm these seams already exist for
  other providers. No data, routing policy or public import path changes.
- **ADVERSARIAL:** splitting data cannot silently change order or windows;
  existing exact-roster, names coverage and window tests must still pass.
  Isolation tests must retain live-failure and surviving-provider assertions.
  Rerun global checks and stamp evidence before closure. No actionable plan
  gap remains; these minimal repairs are converged and authorized.
- **CHANGE DELTA:** additions and metadata corrections prebounded at 1,900
  / 22,786 prior characters = 8.34%.

- **Closed Date:** 2026-10-10.
- **Fix Description:** source-preserving final extraction, shared tag state,
  one authoritative audit review, complete raw receipts and concise prompt.
- **Tests Added:** parser, event replay, raw verdict transport, prompt contract
  and native rendering regressions; fixture split preserves file ceilings.
- **Verification Evidence:** Loop 4 and logs in
  `dev/scratchpad/active/verifier-output-formatting/`. Completion rerun:
  root tests 8,697 pass / 23 skip / 0 fail; full typecheck, development build,
  ESLint, markdownlint, Prettier, quality, scope-register and repository
  validation pass. Declared FID gates: 13/13 pass, receipt stamped.
- **Archived:** `dev/fids/archive/FID-2026-1010-002-verifier-output-formatting.md`.

### Final closure audit

All seven steps are complete. Static gates and independent production-event
replay agree; native OpenTUI and tmux show one readable review at 60/100/160
columns with collapsible reasoning. The complete repository battery reports
8,697 pass / 23 skip / 0 fail. The final geometry-only test correction was
then checked with its six native tests, all passing. Existing renderer
diagnostics remain recorded in Loop 4; no live provider reproduction or
historical glyph recovery is claimed. Local commits are path-scoped and the
closed item is evicted from SCOPE in this archive pass. Production HUD design
work retains its existing authorization boundaries. This closure update is
prebounded at 1,800 characters, below 7% of the previous document.

## Lessons Learned

### Loop 6 — Additional gate blockers, converged repair

- **RED:** full CLI now reports one stale native sidebar assertion: it
  requires `▀` but suite order selects an image-rendered S instead of the
  text fallback. A standalone run renders `█▀▀` / `▄▄█` correctly.
  Global Prettier reports seven HUD source files and three generated artifacts.
- **GREEN:** retain the native geometry assertions and verify nonempty block
  artwork using the existing HUD test's block-character set, covering both
  the rendered image and text fallback. The test measures geometry; exact
  bitmap characters depend on the supported terminal projection. Apply
  formatting-only edits to the seven source files; split the preview marks
  module if formatting exceeds 300 lines. Exclude the three generator-owned
  artifacts using the existing generated-export ignore pattern. Preserve
  their bytes and the separately registered HUD design/approval boundaries.
- **AUDIT / ADVERSARIAL:** standalone and full-suite captures establish the
  capability-state sensitivity. Existing HUD tests must pass after formatting;
  ignore entries name
  exact generated files, never source globs. No design behavior is changed.
  This blocker repair is converged under the operator's existing authority.
- **CHANGE DELTA:** addition prebounded at 1,200 characters, below 5%.

An assistant message can be a streaming fragment, not a prose paragraph.
Selected final-turn text must retain source separators rather than invent
them. Reasoning display and raw signed evidence require distinct
projections, and every chunk boundary is a valid streaming test boundary.
