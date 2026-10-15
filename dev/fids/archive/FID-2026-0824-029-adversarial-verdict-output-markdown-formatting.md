# FID: Adversarial verdict output renders as an unformatted text wall

**Filename:** `FID-2026-0824-029-adversarial-verdict-output-markdown-formatting.md`
**ID:** FID-2026-0824-029
**Severity:** medium
**Status:** closed
**Created:** 2026-08-24 20:06
**YAGNI-Compliance:** Verified

---

## Summary

The Adversary agent's verdict output (delivered via `set_output`) renders inside the correct
TrafficLightPanel chrome but displays as a dense wall of plain text: free-form prose findings are
flattened through the structured-card scalar path (`scalarToDisplayString` → `String(value)`),
which word-wraps but applies no markdown/text-structure rendering. RED established that a full
ChatTheme-aware markdown renderer already exists (`cli/src/utils/markdown-renderer.tsx`) and the
operator approved wiring it into the structured-card layer (Approach A, ask_user 2026-08-24)
instead of building a duplicate utility.

## Environment

- **OS:** Windows 11 (win32), Git Bash shell
- **Language/Runtime:** TypeScript monorepo on Bun 1.3.14
- **Tool Versions:** OpenTUI-based TUI (`@opentui/core`)
- **Commit/State:** Branch main, working tree mid-release-prep (v0.0.27)

## Detailed Description

### Problem

Operator report (verbatim): "adversarial_verdict output, needs proper markdown formatting. It
currently looks like a massive wall of text and low quality - although it properly uses the
traffic light wrapper, the output formatting looks terrible."

### Expected Behavior

Verdict payloads render with readable typographic structure — paragraphs, real bullets, headings,
code blocks, emphasis — consistent with chat markdown rendering.

### Root Cause (confirmed by RED with line evidence)

1. **Unconstrained source:** `agents/adversary/adversary.ts` defines no `outputSchema`
   (`outputMode: 'last_message'`); the instructed verdict format is a fenced ```text block of
   `CONFIRMED/REFUTED/ADJUSTED/NEEDS-REVIEW/OMISSION` lines relayed through `set_output`. Long
   multi-line markdown-ish strings land unconstrained in JSON fields. Literal string
   `adversarial_verdict` appears nowhere in code (grep 0 matches) — the card is generic
   `set_output` handling.
2. **Flatten sites (all in `cli/src/components/tools/structured-card/`):**
   - `classify.ts:102-106` — `scalarToDisplayString` returns `String(value)` for every leaf.
   - `hierarchy.tsx:24-44` — `KeyValueRow` renders that string BOLD with `wrapMode: 'word'`;
     no markdown awareness.
   - Same pattern: `SuccessCard.tsx` (PrimaryText message + extras rows), `RecordCard.tsx`
     (non-object fallback line ~42, NestedItems scalar items line ~143), `ListCard.tsx` (scalar
     bullet row lines ~28-37), `ErrorCard.tsx`.
3. **Existing renderer unused:** `cli/src/utils/markdown-renderer.tsx` exports
   `renderMarkdown(content: string, options: MarkdownRenderOptions): ReactNode` — pure function
   accepting `{ theme?: ChatTheme }` directly (exactly what cards already receive), backed by
   remark-parse + remark-gfm + remark-breaks, with try/catch fallback returning raw content
   (`logger.error` + raw string). Chat consumes it via `blocks/content-with-markdown.tsx`; the
   structured-card layer never does.
4. **Routing context:** `classifyPayload` sends `{message, ...scalarExtras}` records to
   SuccessCard; anything else record-shaped goes to RecordCard — both end in the flatten path
   above.

### Evidence

```text
Detective catalog (RED):
- grep "adversarial_verdict" → 0 matches in *.ts/*.tsx (payload name is conversational, not code)
- agents/adversary/adversary.ts → toolNames include set_output; instructionsPrompt Output Format
  section defines the fenced-text verdict grammar; no outputSchema field present
- registry wiring: cli/src/components/tools/registry.ts:79 (SetOutputComponent), :86-99
  (OutputResultComponent aliased to deep_research, find_files, list_tables, describe_table,
  execute_query, analyze_query, lookup_agent_info, query_blast_radius, query_domain_clusters,
  query_node_edges, ponytail_debt, run_file_change_hooks, get_goal, browser_logs)
- flatten chain: classify.ts:102 scalarToDisplayString; hierarchy.tsx:24-44 KeyValueRow;
  RecordCard.tsx:42/:108/:143; SuccessCard.tsx:21-33; ListCard.tsx:23/:34
- reusable API: utils/markdown-renderer.tsx renderMarkdown/hasMarkdown; markdown-types.ts
  MarkdownRenderOptions{palette?,codeBlockWidth?,theme?}; markdown-palette.ts resolvePalette
- regression net: structured-card/__tests__/{classify,structured-card} tests,
  tools/__tests__/{set-output,output-result}.test.tsx, utils/__tests__/markdown-renderer.test.tsx
```

## Impact Assessment

### Affected Components

- `cli/src/components/tools/structured-card/*` — record/list/success/error cards + hierarchy
  primitives (the fix site)
- `cli/src/components/tools/set-output.tsx` — ALL `set_output` payloads inherit the fix
- `cli/src/components/tools/output-result.tsx` — ~13 aliased result-bearing tools inherit the fix
  (registry.ts:86-99)
- `cli/src/utils/markdown-renderer.tsx` — consumed as-is; NO modifications expected

### Risk Level

- [ ] Critical: System crash, data loss, or security vulnerability
- [ ] High: Major feature broken, no workaround
- [x] Medium: Feature degraded, workaround exists
- [ ] Low: Minor issue, cosmetic, or edge case

Workaround: copy/export carries raw serialized parts.

## Proposed Solution

### Approach (converged — operator-approved 2026-08-24 via ask_user)

**Approach A: reuse the existing renderer.** Add a conservative markdown-routing seam inside the
structured-card layer so string leaves carrying document structure render through
`renderMarkdown(text, { theme })`; plain short scalars keep the current two-column bold treatment.
No new formatting utility (Law 7/13 — `utils/markdown-renderer.tsx` is the one truth).

Key design decisions:

1. **Conservative gate (new pure helper):** a string leaf is a *rich-text candidate* iff it
   contains a newline, a code fence (```), or starts a line with markdown block syntax
   (`#{1,6} `, `> `, `- `, `* `, `+ `, `N. `). Rationale: the chat-side `hasMarkdown()` regex
   fires on bare `-`/`+`/`_` anywhere (e.g. `a-b`, `snake_case`), which would churn layout for
   trivial scalars; the gate must stay deterministic and narrow.
2. **Rendering:** candidates render inside a column-direction box via `renderMarkdown(text,
   { theme })` (theme flows straight into `createMarkdownPalette`). Rich fields drop the forced
   BOLD attribute (markdown output owns its styling); non-candidates keep today's exact rendering.
3. **Layout:** keep each card's existing row/grid geometry — the rich block occupies the value
   cell (label column unchanged); no new indentation chrome beyond what the card already applies.
4. **Coverage (every scalar-leaf exit):** `hierarchy.tsx` KeyValueRow, `SuccessCard.tsx` message,
   `RecordCard.tsx` non-object fallback + NestedItems scalars, `ListCard.tsx` scalar bullets,
   `ErrorCard.tsx` primary/extras.
5. **Collapsed previews unchanged:** `previewFromSummary`/`truncateSingleLine` keep stripping
   markdown characters.
6. **No changes to** `utils/markdown-renderer*` or the Adversary agent definition (prompt-shaping
   the payload is out of scope; the display layer must handle whatever arrives).

### Steps

1. New `structured-card/rich-text.ts(x)`: export `isRichTextCandidate(value: string): boolean` +
   a `RichTextValue` render wrapper calling `renderMarkdown(value, { theme })` inside a column
   box. Unit-test the gate table (plain scalar no; multi-line yes; fence yes; leading
   bullet/heading/quote/ordered-list yes; inline-only markers like `a_b` no).
2. Route the five scalar-exit sites (step 4 above) through the wrapper; keep BOLD only on the
   non-rich path.
3. Extend the regression net: multi-line/bulleted fields render structured markup; plain scalars
   keep the legacy bold row (byte-stable assertions preserved); SuccessCard markdown message
   renders structured; ListCard scalar multi-line item renders structured.
4. Run focused suites + cli typecheck + eslint on touched files.
5. Declare/stamp Verification Gates receipt via `bun run fid:verify <fid> --write`.

### Verification

- `bun run typecheck` (cwd cli) exit 0
- Focused suites pass 0 fail: `structured-card/__tests__/rich-text.test.tsx` (new),
  `structured-card/__tests__/structured-card.test.tsx`,
  `structured-card/__tests__/classify.test.ts`, `tools/__tests__/set-output.test.tsx`,
  `tools/__tests__/output-result.test.tsx`
- `bun x eslint <touched files> --max-warnings 0` exit 0
- Reachability grep: the new rich path is imported by hierarchy/card files mounted from
  `registry.ts` entries
- Gate-history note: `test cli/src/utils/__tests__/markdown-renderer.test.tsx` was declared as a
  sixth gate but removed before stamping — mechanically unsound as a root-cwd gate because bun's
  filter matches BOTH this suite (green, 22/0 in every focused run from `cli/`) AND the vendored
  `resources/freebuff-main/cli/src/utils/__tests__/markdown-renderer.test.tsx` copy, which
  crashes standalone on an unrelated missing module (`@codebuff/common/util/array`). The reused
  renderer API is untouched by this FID.
- Live TUI smoke of a real adversarial verdict: NEEDS-REVIEW unless the operator eyeballs it
  (test-renderer-is-not-a-proxy lesson)

## Verification Gates

- gate: typecheck cli
- gate: test cli/src/components/tools/structured-card/__tests__/structured-card.test.tsx
- gate: test cli/src/components/tools/structured-card/__tests__/classify.test.ts
- gate: test cli/src/components/tools/__tests__/set-output.test.tsx
- gate: test cli/src/components/tools/__tests__/output-result.test.tsx

### Verification Receipt

- fingerprint: sha256:39cb19a287c5f1d97d8685fbcf34f8c87ce9004734dddf9f38741fff01b4fc11
- verified: 2026-08-25T01:20:40.121Z
- typecheck cli: exit 0
- test cli/src/components/tools/structured-card/__tests__/structured-card.test.tsx: exit 0
- test cli/src/components/tools/structured-card/__tests__/classify.test.ts: exit 0
- test cli/src/components/tools/__tests__/set-output.test.tsx: exit 0
- test cli/src/components/tools/__tests__/output-result.test.tsx: exit 0

## Perfection Loop

### Loop 1 — RED → GREEN → AUDIT → ADVERSARIAL

- **RED:** Complete. Catalog: unconstrained verdict source (agents/adversary/adversary.ts, no
  outputSchema); five flatten sites cited file:line; unused ChatTheme-aware renderer found
  (utils/markdown-renderer.tsx); consumer census (registry.ts:79-99); regression net enumerated;
  literal `adversarial_verdict` absent from code. No additional defects surfaced beyond the
  reported one.
- **GREEN:** Complete. NEW `rich-text.tsx` authored by Forge (BLOCK_SYNTAX regex gate +
  RichTextValue dual-branch component with exact-legacy-fallback contract). Mechanical wiring
  executed by the Orchestrator after a STRUCTURAL deadlock: Forge has no read tool, so EHEL Law-1
  can never credit it for edits to existing files (three blocked attempts; new-file creation
  exempt). Deviation documented per the FID-085 precedent; independent verification preserved
  downstream. All five leaf exits routed; new `__tests__/rich-text.test.tsx` net added; prettier
  applied to all 7 touched files.
- **AUDIT:** Verifier PASS ×7 with file:line/quoted-code citations (spec conformance, wiring
  completeness, reachability via registry mount chain + executing tests, legacy byte-stability,
  lint hygiene, test-net adequacy, YAGNI); graph-index staleness honestly disclosed; live TUI
  smoke carried NEEDS-REVIEW.
- **ADVERSARIAL:** STANDS — 6 CONFIRMED against fresh disk reads, 1 ADJUSTED (prettier drift at
  insertion sites → discharged in SELF-CORRECT via prettier --write + full re-verification),
  0 REFUTED, omission check clean; belt-and-braces git status proved `cli/src/utils` +
  `agents/adversary` untouched.
- **CHANGE DELTA:** ~35% (spec convergence fold-in), then closure fills only loop/evidence/
  resolution sections.

### Missed Questions (answered at convergence)

1. Chat renderer coupling? → `renderMarkdown` is a pure string→ReactNode function taking
   `theme?: ChatTheme`; zero stream/chat-block coupling. Directly mountable.
   (`markdown-content.tsx`'s semantic-block adapter IS stream-oriented — do not use that layer.)
2. Other set_output producers affected? → Yes: all subagents report via set_output (verifier,
   detective, basher summaries, etc.); all inherit the fix through SetOutputComponent. That is
   desired scope.
3. Previews strip markdown? → Unchanged behavior kept deliberately (collapsed previews are
   single-line sanitized).
4. Real payload shape? → Free-form fenced-text verdict grammar per adversary.ts Output Format
   section; no schema. Display layer handles arbitrary shapes (fail-open philosophy preserved).
5. Why not `hasMarkdown()` as the gate? → Its regex matches bare `-`/`+`/`_`/backtick anywhere,
   flipping layout on trivial scalars (`a-b`). A conservative block-syntax gate avoids that while
   catching all real documents.
6. Can the gate section carry explanatory prose? → NO — the fid:verify parser accepts only
   `- gate:` declarations; ANY other line (even blockquotes) fails parsing as malformed. Notes
   live in prose sections only.
7. Are shared-name test files safe as root-cwd gates? → NO when a vendored copy exists under
   `resources/` (bun path-filter collision; see Gate-history note under Verification).

### Implementation Evidence (REQUIRED for `closed`)

- [x] **Commit SHA:** working tree (release-only-commits convention; uncommitted like the
  surrounding v0.0.27 changeset)
- [x] **File:line ranges:** NEW `cli/src/components/tools/structured-card/rich-text.tsx` (gate
  :19-26, RichTextValue :29-53 post-prettier); NEW
  `cli/src/components/tools/structured-card/__tests__/rich-text.test.tsx`; wiring at
  `hierarchy.tsx` KeyValueRow value cell (~:33), `SuccessCard.tsx` message (~:28),
  `RecordCard.tsx` non-object branch (~:31) + NestedItems else-branch (~:103), `ListCard.tsx`
  scalar bullet (~:37), `ErrorCard.tsx` scalar branch (~:26) + errorMessage (~:57) — positions
  confirmed by the Adversary's fresh disk reads
- [x] **Gate output:** final receipt = the Verification Receipt block below (ground truth;
  deliberately not duplicated here — every restamp mints a new fingerprint and prose embedding a
  literal hash goes stale by construction). 5/5 declared gates live-re-run exit 0; plus focused
  battery 82 pass / 0 fail across 7 files; cli typecheck exit 0; eslint dir-wide --max-warnings 0
  exit 0; prettier check clean
- [x] **Reproducibility:** grep `isRichTextCandidate\|RichTextValue` under
  `cli/src/components/tools/structured-card/` returns the new module + all five card/hierarchy
  consumers; `bun test src/components/tools/structured-card` (cwd cli) runs the net
- [x] **Step statuses:** Steps 1-5 all `implemented` (step 5 required two gate-list corrections
  before stamping — documented above)

### Code Verification Evidence

- [x] Files referenced in Affected Components exist (all read 0-EOF this session; Adversary
  re-read five of them at AUDIT)
- [x] Implementation matches the Proposed Solution (Verifier + Adversary conformance checks)
- [x] Typecheck/tests/lint pass with pasted tool output (82/0, exit 0 ×typecheck/eslint/prettier)
- [x] Production call-graph evidence present (registry.ts:79/:86-99 mount chain; import lines
  quoted; mounted-path suite executes green)
- [x] FID status reflects the actual implementation state (closed with code in tree + stamped
  receipt)

### Loop 2 — Independent audit and self-correction

- **RED:** —
- **GREEN:** prettier drift discharge (ADJUSTED finding) + gate-list corrections during stamping
- **AUDIT:** receipt live-re-run 5/5 PASS; check-mode PASS
- **ADVERSARIAL:** covered inside Loop 1 (single-pass loop; no residual findings)
- **CHANGE DELTA:** <10% per pass (circuit breaker respected)

### Loop 3 — Final convergence

- **RED:** —
- **GREEN:** —
- **AUDIT:** —
- **ADVERSARIAL:** —
- **CHANGE DELTA:** —

## Resolution

- **Closed Date:** 2026-08-24 20:55 EDT
- **Fix Description:** Conservative rich-text gate + RichTextValue wrapper (reusing
  utils/markdown-renderer.tsx renderMarkdown with ChatTheme) wired into every string-leaf exit of
  the structured-card layer; plain scalars byte-stable on the legacy path.
- **Tests Added:** Yes — `structured-card/__tests__/rich-text.test.tsx` (gate truth table incl.
  discriminators, dual-branch rendering, card-level routing for all five cards, legacy end-to-end
  pin).
- **Verification Evidence:** See Verification Receipt (5/5 gates live exit 0) + focused battery
  82/0 + typecheck/eslint/prettier clean.
- **Archived:** 2026-08-24 21:06 EDT (Orchestrator-executed mv immediately post-re-stamp per
  ECHO-6 split)

## Lessons Learned

1. **Forge structurally cannot satisfy Law 1 in this configuration.** Its tool set has no
   read_files, so EHEL can never credit reads for existing-file edits — new-file creation works
   (isNewFile exemption), every existing-file edit hard-blocks. Three deadlocks this loop; the
   Orchestrator completed mechanical wiring under the FID-085 precedent while verification stayed
   independent. HARNESS DEFECT — deserves a follow-up FID (give Forge read_files, or credit
   inherited parent reads for subagents).
2. **Root-cwd bun test filters collide with vendored trees.** Any `resources/*` fork containing
   same-named test files makes `<path>`-filtered gates red from the repo root even when the real
   suite is green. Declared gates must be collision-checked against `resources/` before stamping.
3. **The fid:verify gates grammar is declaration-only.** No prose, no blockquotes between
   `- gate:` lines — anything else parses as malformed. Put commentary in prose sections.
4. **Recorder UPDATE stalls recur (-0823-011 class).** Strictly-sequential prompts (read alone →
   write alone) plus explicit "do not end your turn" language got a landing; parallel read+write
   batches trip Law-1 at the child. This closure landed directly after a fourth stall, per the
   documented precedent.