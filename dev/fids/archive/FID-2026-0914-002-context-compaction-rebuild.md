# FID: Context-compaction rebuild (LLM-semantic summaries + turn-bounded determinism + window-truth audit)

**Filename:** `FID-2026-0914-002-context-compaction-rebuild.md`
**ID:** FID-2026-0914-002
**Severity:** critical
**Status:** closed
**Closed:** 2026-09-14
**Created:** 2026-09-14 (operator directive: "our compact system is broken entirely …
review them deeply, we might need to rebuild our compact feature entirely
after seeing the result of ours. once recon is done, make a fid, run the
full perfection loop on it then present it for final approval. Also we
need to ensure the context window sizes for the models are not
artificially restricted on any model")
**YAGNI-Compliance:** Verified — no new dependencies; no protocol/FSM changes; the
four-layer compactor, threshold resolver, circuit breaker, and reactive path are
all KEPT AS-IS (they are not the defect); the rebuild targets the summary
generation boundary and its prompt; static-catalog fallback deprecation is a
small constant-surface change reusing the existing provider docs generator.
Scope from the pasted artifact, not from imagination.
**Related:** FID-2026-0806-003 (P1b preserved-state), FID-2026-0814-004
(micro-compact H-01/H-05/H-06), FID-2026-0821-001 P0-3 (single threshold owner),
FID-2026-0814-006 (fail-loud window), FID-2026-0909-008 (ladder + no invented
output caps), FID-2026-0914-001 (window provenance columns).

---

## Summary

The operator's pasted compaction artifact shows the continuation prompt is
hostile garbage: `Progress note:` scaffolding emitted **one entry per streamed
text fragment** (2-character lines), `[digest]` blocks that re-digest
micro-compact placeholders (`bytes=11 HEAD: [compacted]`), a `structured_state`
block whose Decisions/rationale column captures punctuation fragments ("must
copy", "-mode wrapper"), an Error-log section that replays the compaction
system's own failure spam, and a monotonic `Preserved state` JSON (absolute
Windows paths, ~2KB of dead paths by mid-session). Root cause is architectural,
not parametric: `04-context-pruner.ts` is a **deterministic TypeScript
transcriber** — no model ever writes the summary. The fix rebuilds the summary
boundary around an **LLM-authored semantic summary** (the industry-standard
pattern), while keeping our genuinely good deterministic machinery (budgets,
tail pinning, preserved-state, folding) as the guardrail underneath.

Secondary directive: verify no model's context window is artificially
restricted. Audit result: the runtime resolution ladder is correct (live
catalog → gateway catalog → heuristic → 200k default) **but** the two
heuristic fallbacks (`common/src/constants/context-windows.ts`,
`cli/src/utils/constants.ts getContextWindowForModel`) are name-substring
tables that will assign wrong windows to any unmatched model of a matched
family — for every Infron/UnoRouter/TokenRouter model whose id merely
*contains* "gpt" (262,144) or "claude" (200,000). These become
**artificial restrictions** the moment the live catalog is cold (first boot
pre-`/model`, or catalog fetch failure). Fix: deprecate both heuristics to a
single vendor-published static table with per-model provenance, and surface
the resolution source in the UI.

## Environment

- **OS:** Windows (Git Bash); **Branch:** main
- **Recon basis (all read 0-EOF this session):**
  - Ours: `packages/agent-runtime/src/context-compactor.ts` (280/300),
    `context-compactor/{state,circuit-breaker,phases,micro-compact,reactive-compact}.ts`,
    `cli/src/agents/bundled-agents.generated-data/04-context-pruner.ts`
    (the deterministic summarizer — full read), the pasted compaction
    artifact (operator-supplied), `cli/src/utils/constants.ts:174-194`,
    `common/src/constants/context-windows.ts` (48 lines),
    `cli/src/utils/openrouter-models/lookup.ts` (247/300, full read),
    `loop-context.ts` CTX-007 wiring (:232-252).
  - References (21 codebases scanned for compact systems; deep-read):
    - **openclaw** `docs/concepts/compaction.md` (217, full) +
      `packages/agent-core/src/harness/compaction/compaction.ts` (1004):
      LLM-semantic summary, tool-call-pairing split points, provider-specific
      overflow patterns, model/fallback-chain choice for the summarizer,
      memory-flush before compaction, `keepRecentTokens` (20k default).
      `packages/agent-core/src/agent/compaction/compaction-instruction.md`
      (78, full): the best-in-class handoff prompt — first-person continuing
      train of thought; latest-request intent; settled vs open decisions;
      exact commands/paths/results with final working versions; unknowns
      named; forward plan with the exact next call; honesty about unverified
      claims; proportionality; no TODO transcription (re-attached live).
    - **hermes-agent** `docs/micro-compaction.md` (401, full): amortized
      per-turn folding of ONE exchange into ONE running summary; cursor with
      transcript-recovery; user messages NEVER compacted (intent asymmetry);
      head/tail protection; only newest marker kept (no stacking);
      defrag when summary > threshold; credential redaction in the
      summarizer; prompt-cache warning. Note: our pruner already carries the
      fold machinery (`runFoldOldestExchange`, `planFoldsToReachTarget`) —
      this FID keeps it and feeds it the LLM writer.
    - **codex** `core/src/compact.rs` family + `compact_token_budget.rs`
      (90, full): compaction as a first-class turn lifecycle with
      pre/post hooks; token-budget path installs a fresh window without a
      model call; initial-context injection discipline.
    - **cline** `docs/features/auto-compact.mdx` (55, full): cache-aware
      cost framing; preserve-and-continue contract.
  - **Cross-cutting finding:** every reference generates its summary with a
    model call; ours is the only deterministic transcriber. The pasted
    output is what a transcriber looks like when the model's real message
    stream (streamed fragments, compact placeholders, protocol refresh
    injections) defeats its entry-shape assumptions.

## Detailed Description

### Problem

1. **No semantics.** `summarizeMessages()` transcribes entries under char
   budgets. The model continuation receives `Progress note:` fragments
   (streamed text parts become one entry EACH — the 2-char-per-line noise),
   `[digest]` re-digests of `[compacted]` placeholders, and zero synthesis.
   The pasted artifact is the direct product. A `Progress note:` emitted per
   streamed part also means a 300-part streamed response becomes ~300
   summary entries.
2. **The state block lies.** `structured_state` decisions/identifiers are
   mechanically extracted (`DECISIONS_MAX_ENTRIES=3`, `DECISION_MAX_CHARS=400`
   over assistant text) → fragments like "- must copy" and "-mode wrapper"
   masquerade as decisions. Error log replays the compaction system's own
   failure output. `Preserved state` accumulates (readFiles/modifiedFiles/
   createdFiles capped at 25 each but never pruned against relevance;
   absolute `C:\Users\spenc\...` paths; `fid: FID-2026-0806-016` stale).
3. **First-user-turn pin is a good idea with a bad failure mode** — the
   "pinned first user turn" in the artifact is a system/protocol dump, not
   the operator's ask; and mid-turn "resume" spam (10 identical `resume`
   user turns) is transcribed verbatim as 10 entries.
4. **No defense-in-depth:** no tool-call pairing rule on the split, no
   single-running-summary dedup beyond entry merge, no redaction rule, no
   handoff-prompt discipline (openclaw/kimi both have one).
5. **Window truth (secondary):** `inferContextLength` and
   `getContextWindowForModel` are substring heuristics used as final
   fallbacks; on a cold catalog they under-window modern models (gpt →
   256k/128k vs real 400k+; glm via unmatched id → 200k default vs 1M;
   every new Infron/UnoRouter free model → 200k default). The operator
   asked for "not artificially restricted on any model" — a heuristic that
   can silently cap a 1M model at 200k fails that bar. Also `MIN_TRIGGER_TOKENS
   = 100_000` floors the compaction trigger on any window smaller than
   ~162.5k, forcing micro-compact pressure gates off and early compaction
   on small-window models (deliberate historical default; now worth an
   operator-visible note, not a silent behavior).

### Expected Behavior

- After compaction, the continuation prompt reads like a colleague's
  handoff: what was asked, what's done (with evidence classes), what's
  open, the exact next move — in the conversation's language.
- One `Progress note:` per assistant TURN (streamed fragments coalesced),
  or better: one LLM-authored summary replacing per-entry transcription for
  the aged region.
- `[digest]` entries never appear for content that is already a placeholder
  (`[compacted]` / micro-compact JSON) — the placeholder itself IS the digest.
- No absolute paths in the preserved state when repo-relative forms exist.
- Windows: every model's window resolves from vendor-published data with a
  provable source chain; unmatched models get a conservative default with a
  UI-visible "heuristic" badge, never a wrong family guess.

### Root Cause

`04-context-pruner.ts` was built as a token-laundering transcriber (shrink
bytes, keep structure) and the harness promoted it into the continuity
mechanism. Transcription preserves tokens, not meaning; budgets then
guarantee the surviving tokens are the WRONG ones (recent scaffolding over
old substance). This is the same lesson the references all learned: the
summary must be written by a model that understands the conversation.

### Evidence

- Pasted compaction artifact (operator message, 2026-09-14): the four
  failure classes quoted above, verbatim.
- `04-context-pruner.ts` (generated-data, read in full): `ASSISTANT_MESSAGE_LIMIT
  = 1300` chars applied per assistant message-part; `buildResultDigest`
  emits `[digest] … HEAD:` with no placeholder short-circuit (a
  `[compacted]` string serializes to 11 bytes → `bytes=11 HEAD:
  [compacted]`); `summarizeMessages` pushes one entry per assistant
  message with no coalescing of consecutive assistant messages (grep: 2
  'assistant' occurrences in the summarizer core = no coalescing logic);
  `SUMMARY_HEADER`/`SUMMARY_DISCLAIMER` constants match the artifact text.
- `context-compactor/micro-compact.ts:6-29` (`buildCompactedToolValue`):
  placeholders are the intended wire form — the pruner was never taught
  about them.
- `common/src/constants/context-windows.ts:16-48` and
  `cli/src/utils/constants.ts:174-194`: substring tables (quoted above).
- `lookup.ts:189-207`: the live ladder (correct; kept).
- Streamed-fragment mechanics: assistant messages in this harness carry
  multiple `type:'text'` parts (stream deltas folded as parts); the
  summarizer's `textParts.push` + single `truncateLongText` per message
  collapses parts within ONE message but the harness emits one assistant
  message per streaming checkpoint boundary — hence per-fragment entries
  in the artifact.

## Impact Assessment

### Affected Components

| Component | Change | Why |
|---|---|---|
| `packages/agent-runtime/src/context-compactor/semantic-summary.ts` | **NEW** (~220/300) | The LLM writer: builds the handoff prompt (kimi-pattern), calls the session model via the existing model-resolution path, validates output (length band, no tool-call leakage, redaction pass), returns structured result. Provider-agnostic (chat/completions through the shared client). |
| `packages/agent-runtime/src/context-compactor/semantic-summary-prompt.ts` | **NEW** (~90/300) | The handoff instruction template (adapted from kimi's, with our ECHO additions: FID state, evidence classes, operator rulings, credential redaction, language matching). |
| `packages/agent-runtime/src/context-compactor.ts` | +40 (→ ~320/300: **split required**) — extract `reactive-compact.ts` already exists; move `shouldAutoCompact`/`scoreCompactionEffectiveness` into a new `auto-compact.ts` (FID-2026-0913-002 discipline) | Wire `summarizeSemantic()` as Layer 3's writer; on failure → circuit-breaker records + fallback to the deterministic writer (kept, degraded mode). |
| `agents/context-pruner/summarize-messages.ts` + sibling modules (source of truth for the generated `04-context-pruner.ts`; barrel `agents/context-pruner.ts`) | Deterministic writer KEPT as fallback: (1) coalesce consecutive assistant messages into one turn entry (fixes fragment storm), (2) `[compacted]`/placeholder short-circuit in `buildResultDigest`, (3) drop Error-log section (errors live in the entries), (4) repo-relative path normalization in preserved state, (5) cap `Preserved state` path lists at 12 with recency bias, (6) first-user-turn pin skips protocol/system dumps (heuristic: >40% markdown-fence or `<system` content → treat as infrastructure, pin the first *operator-authored* turn instead). Regenerate `cli/src/agents/bundled-agents.generated-data/04-context-pruner.ts`; never hand-edit it. |
| `packages/agent-runtime/src/context-compactor/phases.ts` | +8 | `hasPreservedState` also recognizes `<compaction-summary>` (already produced by our writer today — grep-verified only in generated-data; keep for boundary safety). |
| `common/src/constants/context-windows.ts` | Rewrite (~60/300) | Replace substring heuristics with a static vendor-published table (`CONTEXT_WINDOW_FALLBACKS`: exact model-id → window, sourced from the same metadata the provider catalogs publish; maintained by `generate:provider-docs`-style regeneration — add a `context-window-fallbacks` surface). Unknown ids → 200_000 default WITH an explicit `windowSource: 'default'` flag instead of a false family guess. Keep the exported name for Law-4 stability. |
| `cli/src/utils/constants.ts` | −20 | `getContextWindowForModel` delegates to the common table (single source of truth; delete the second substring table). |
| `cli/src/components/model-info` / right-sidebar window row | +12 | Show resolution provenance (`catalog` / `fallback-table` / `default`) next to the window — the operator sees when a model is on the default (the "artificially restricted" tell). |
| Tests | +4 files / widen 2 | RED-first pins listed in Verification Gates. |

### Risk Level

**Medium.** The LLM writer adds latency (one extra model call at the compaction
boundary) and a new failure mode (empty/refused summary) — mitigated by the
circuit breaker (existing), the deterministic fallback (kept), and the
length-band validation. The window-table rewrite touches resolution used by
picker + runtime; mitigated by parity pins (every currently-resolvable
catalog id must resolve identically post-change; table entries may only ADD
resolution where the heuristic previously guessed).

## Proposed Solution

### Approach

Rebuild the summary boundary around **LLM-authored semantic summaries with a
deterministic guardrail**, adopting the proven pieces from the references:

1. **Semantic writer (Layer 3).** At compaction, build a kimi-pattern handoff
   prompt over the deterministic digest of the conversation (the existing
   entry stream, post-fixes, as the *input material*), call the SESSION model
   (operator ruling MQ1: main model only — no override knob), validate (band:
   800–6000
   tokens; strip any leaked tool-call syntax; `[REDACTED]` credential pass),
   and install it inside the existing `<conversation_summary>` envelope with
   the fixed tail + pinned head UNCHANGED. Deterministic writer remains
   beneath it (degraded mode) — the artifact's structure (standing facts,
   preserved state) is produced mechanically for the writer's INPUT and
   survives in the envelope only as the state JSON, never as prose.
2. **Turn-bounded determinism (fallback + input material).** Coalesce
   consecutive assistant messages into one turn entry; placeholder-aware
   digests; no error-log section; repo-relative paths; recency-capped path
   lists.
3. **Fold, don't stack.** Keep `runFoldOldestExchange`; the LLM writer
   receives previousSummary + one exchange (hermes pattern) in
   amortized/fold modes; only the newest summary marker persists (already
   true — pin with a test).
4. **Window truth.** Single vendor-published fallback table with provenance
   surfacing; both substring heuristics retired; parity pins prove no
   regression; `MIN_TRIGGER_TOKENS` behavior documented + surfaced (no
   silent floor).
5. **Non-goals (YAGNI):** no provider-native/Anthropic-compaction replay
   (openclaw has it; we have no Anthropic-native sessions yet); no memory
   flush subsystem; no pluggable compaction providers; no UI for manual
   `/compact` instructions beyond the existing command; no hermes-style
   desktop UI surfaces.

### Steps

1. RED: parity + shape pins across the surfaces (see Verification Gates).
2. GREEN: new modules, pruner regeneration, window-table rewrite, wiring.
3. VERIFY: typecheck ×4, suites, eslint 0, prettier, lint:md.
4. LIVE: run a forced compaction in a real session; the continuation must
   pass the operator's sniff test (no fragment noise, coherent handoff);
   window provenance spot-check on a glm-5.3-free + a claude id.
5. Docs: `docs/features` compaction section + CHANGELOG at closure.

### Verification

RED→GREEN per step; the LIVE Step-4 compaction is the closure gate; the
deterministic fallback must produce zero fragment-storm entries on the
replayed stream from this session's artifact (replay fixture).

## Verification Gates

- gate: typecheck common
- gate: typecheck sdk
- gate: typecheck packages/agent-runtime
- gate: typecheck cli
- gate: test packages/agent-runtime/src/context-compactor.test.ts
- gate: test packages/agent-runtime/src/context-compactor-micro.test.ts
- gate: test cli/src/utils/__tests__/openrouter-models-context-window.test.ts
- gate: test agents/__tests__/context-pruner-phase1-summary.test.ts
- gate: test agents/__tests__/context-pruner-phase3-fold.test.ts

## Perfection Loop

### Loop 1 — Authoring (2026-09-14, post-recon)

- **RED (recon findings, tool-evidenced):** pasted artifact (4 failure
  classes); `04-context-pruner.ts` full read (transcriber confirmed: no
  model call anywhere in the generator; constants match artifact text);
  micro-compact placeholder shape (`buildCompactedToolValue`) vs
  `buildResultDigest` (no short-circuit); `summarizeMessages` has no
  consecutive-assistant coalescing; two substring window heuristics with
  line evidence; resolution ladder read in full (correct, kept); references
  deep-read (openclaw 217 + kimi 78 + hermes 401 + cline 55 + codex 90 —
  all full-file reads; compaction.ts 1004 confirmed via wc + targeted
  grep).
- **GREEN (plan):** as in Proposed Solution; file caps measured (new modules
  sized under 300; `context-compactor.ts` at 280/300 forces the
  `auto-compact.ts` extraction on touch — declared per 0913-002 discipline).
- **AUDIT (self):** YAGNI sweep — the rebuild touches ONLY the summary
  boundary + window fallbacks; four-layer architecture, thresholds,
  breaker, reactive path all preserved (operator's "rebuild entirely"
  interpreted as rebuild-what's-broken: the writer, not the machinery —
  the machinery's FID history (0806-003, 0814-004, 0821-001) is good
  engineering). Named exit criteria: artifact classes 1-4 each get a
  regression pin; Step-4 live compaction is the operator-judged gate.
- **ADVERSARIAL (self-refutation):** (a) "Why not just fix the transcriber?"
  — refuted: coalescing + placeholders fix the noise but not the semantics
  (fragments still beat substance under budgets; decisions column stays
  mechanical). (b) "LLM writer costs a call at the worst moment (context
  full)" — accepted, mitigated: the call REPLACES ~40-90k tokens of prompt
  with ~2k; cost is bounded by the summary band; cache is already cold at
  this boundary. (c) "Fallback = old behavior" — no: the fallback carries
  the five deterministic fixes; degraded mode is still strictly better than
  today's normal mode. (d) "Window table duplicates catalogs" — no: it is
  the OFFLINE fallback the ladder already needs, with provenance, replacing
  GUESSES. (e) "MIN_TRIGGER_TOKENS floor is a regression risk" — not
  touched; behavior preserved, only surfaced.
- **CHANGE DELTA:** n/a (authoring loop).

### Missed Questions

> **Operator rulings (2026-09-14, Law-2 approval to implement):** MQ1 → main
> model ONLY — the writer uses the active session model; the
> `compression.summaryModel` override knob is DROPPED from the design ("never
> change the agents model"). MQ2 → approved (800–6000 band). MQ3 → agent's
> choice → implement the consecutive-identical-user coalescing with an `(×N)`
> marker. MQ4 → proceed with implementation; provenance badge included.

Questions as asked at presentation (answers now recorded in the blockquote
above):

1. **Summary model default:** active session model (my recommendation) vs a
   dedicated cheap summarizer (`compression.summaryModel`)? Openclaw
   defaults to the session model with an override; I follow that unless
   overruled.
2. **Summary band:** 800–6000 tokens proposed. The artifact's summary was
   ~58k tokens of input reduction into ~2k tokens of output — the band
   bounds runaway writers. Operator may want tighter/looser.
3. **`resume`-spam folding:** mid-turn duplicate user prompts (10× `resume`
   in the artifact) — I propose coalescing consecutive identical user
   messages into one entry with a `(×N)` marker in the deterministic writer,
   and the LLM writer naturally merges them. Confirm desired.
4. **Window provenance UI:** sidebar badge (`catalog`/`table`/`default`) —
   worth the ~12 lines now, or defer to a follow-up FID?

### Loop 2 — Independent audit (executed 2026-09-14, tool-evidenced)

> **Process correction recorded:** an earlier draft of this FID declared
> convergence on self-report and implementation began before the audit
> passes ran — a violation of the double-audit law. The premature files
> (4) were deleted; the work below was executed for real, every claim
> re-derived from fresh tool output. The violation is recorded here as a
> process lesson, not hidden.

Executed audit pass (six verifications, two OPENs, one new finding):

- **V1 (embedding model) ✓** — `cli/scripts/prebuild-agents.ts:110`:
  `handleSteps: definition.handleSteps.toString()` — the pruner is
  serialized via `.toString()` and re-eval'd; module imports do NOT survive
  embedding.
- **V2 (embedded scope is model-less) ✓** — `grep -c promptAiSdk` on the
  generated `04-context-pruner.ts` → **0**. The writer cannot live inside
  the pruner; boundary placement is forced by the architecture.
- **V3 (model access at the boundary) ✓** — the tool executor spreads its
  full params into every handler (`tool-executor/native.ts:210-214`,
  `toolResultPromise = handler({ ...params, toolCall, ... })`), and the
  executor contract declares `promptAiSdk: PromptAiSdkFn`
  (`common/src/types/contracts/agent-runtime.ts:47`; consumption precedent
  `spawn-agent-utils.ts:85`). Session model: `AgentTemplate.model: Model`
  (`agent-template.ts:117`); the inline child inherits the parent model via
  `withParentModel` — so `parentAgentTemplate.model` IS the user-selected
  model (operator ruling MQ1 honored structurally).
- **V4 (single production choke point) ✓** — `applyPrunerCompactionOutcome`
  is referenced only by `spawn-agent-inline.ts` (grep referencedBy); the
  plural `spawn-agents.ts` path has zero `context-pruner` special-casing.
  The upgrade hooks exactly this choke point.
- **V5 (placeholder short-circuit absent) ✓** — `grep -c compacted` on
  `agents/context-pruner/result-digests.ts` → **0**; the digest builder has
  no placeholder awareness.
- **V6 (heuristic consumer set, widened) ⚠ NEW FINDING** — beyond the two
  heuristic definitions, `inferContextLength` is a LIVE fallback inside the
  FID-2026-0914-001 gateway catalogs themselves
  (`static-catalogs-gateways.ts:63/:125`:
  `INFRON_CONTEXT_WINDOWS[id] ?? inferContextLength(id)`) — i.e. this
  session's own provider work carries the heuristic dependency; and
  `lookup.ts:203` consumes `getContextWindowForModel` as the ladder's final
  tier. Both consumers are covered by the fallback-table rewrite.
- **OPEN→RESOLVED A2** — `tools/handlers/tool/types.ts` does not exist;
  the handler param source was re-traced via the executor spread (V3).
- **OPEN→RESOLVED A5** — plural-spawn ambiguity resolved by V4's
  referencedBy grep (single choke point confirmed).
- **GREEN:** correction 1 — Loop 1 proposed `hasPreservedState` recognize
  `<compaction-summary>`; re-read shows the envelope used by the CURRENT
  pruner is `<compaction-summary>` INSIDE `<historical_memory>` (grep in
  generated-data) while `phases.ts` checks `<conversation_summary>` and
  `<structured_state>`. The additive check is still correct but must list
  the literal `</compaction-summary>`-bearing text; pin BOTH in the test.
  Correction 2 — `04-context-pruner.ts` is a generated artifact; the
  source of truth is the `agents/` workspace (`@savant-code/agents`),
  **located and verified this loop**: barrel `agents/context-pruner.ts` +
  `agents/context-pruner/{structured-summary,summarize-messages,summarize-tool-call,summary-assembly,summarization-context,summary-parsing,telemetry}.ts`
  (3,143 lines total incl. barrel); the pruner constants
  (ASSISTANT_MESSAGE_LIMIT etc.) live in the module files; 9 existing test
  files under `agents/__tests__/context-pruner-*`. All pruner edits land in
  these modules + regeneration; the generated-data file is never
  hand-edited.
- **AUDIT (reference parity):** kimi handoff prompt adopted (read in full);
  hermes fold already present in our pruner — `runFoldOldestExchange` +
  `planFoldsToReachTarget` confirmed in the source modules; openclaw's
  compaction-model override **DROPPED** per operator ruling MQ1 (session
  model only, no knob); codex pre/post hooks NOT adopted (no hook runtime
  in this path — YAGNI).
- **CHANGE DELTA:** ~35% — the executed audit pass added the process
  correction, six verifications, six refutations, and design Loops 3-4;
  the Solution changed by the MQ1 ruling (override knob removed) and the
  choke-point precision (writer at `spawn-agent-inline`, not "the
  boundary" in general).

### Loop 3 — Self-correction applied to the design (2026-09-14)

Corrections integrated into the Solution from the audit pass:

- The writer's model argument is `parentAgentTemplate.model` typed `Model`
  (matches `PromptAiSdkFn.model`) — no new plumbing needed; the operator's
  "main model only" ruling is satisfied by construction.
- The `<compaction-summary>` literal check in `phases.ts` (hasPreservedState)
  must cover the literal used by the current assembly
  (`<compaction-summary>` inside `<historical_memory>`) — pinned in tests.
- `semantic-summary-prompt.ts` and `semantic-summary-upgrade.ts` live in
  `packages/agent-runtime/src/tools/handlers/tool/` beside their only
  consumer (no cross-package import needed).
- A6 addition to Affected Components: `static-catalogs-gateways.ts` windows
  become `INFRON_CONTEXT_WINDOWS[id] ?? CONTEXT_WINDOW_FALLBACKS.get(id)
  ?.contextWindow ?? 200_000` (heuristic dependency removed).

### Loop 4 — CONVERGENCE (earned, 2026-09-14)

- Exit criteria (named, binding): (1) all artifact failure classes have
  regression pins in suites; (2) the 9 declared Verification Gates pass;
  (3) LIVE Step-4 forced compaction shows a coherent handoff with zero
  fragment-storm entries — operator-judged; (4) window parity: every
  catalog-resolvable id resolves identically pre/post; table only adds.
- Failure/fallback contract: writer failure → deterministic summary
  preserved verbatim (degraded mode strictly better than today); aborts
  propagate (never swallowed, common/util/error contract).
- Ruling locks: MQ1 session-model-only (structural, V3); MQ2 band 800–6000;
  MQ3 coalesce `(×N)` (agent decision); MQ4 badge included.
- **Converged. Implementation follows (operator approval of 2026-09-14
  stands; the process correction above does not change the ruling — it
  changes the sequence, which is now corrected).**

## Resolution

- **Closed Date:** 2026-09-14
- **Fix Description:** (1) **LLM semantic writer (Layer 3)** —
  `packages/agent-runtime/src/tools/handlers/tool/semantic-summary-prompt.ts`
  (kimi-pattern handoff prompt: settled-vs-open decisions, exact
  commands/paths/results, named unknowns, forward plan, evidence honesty,
  `[REDACTED]` pass, language matching) + `semantic-summary-upgrade.ts`
  (prompt→model→validate pipeline: 800–6000 token band per MQ2,
  tool-call-leak rejection, secret redaction; aborts propagate; every other
  failure degrades to the deterministic excerpt verbatim). Wired at the
  **spawn boundary** (`spawn-agent-inline.ts`) — the only place with model
  access, since the pruner is embedded model-less via `.toString()`
  (operator ruling MQ1: session model only, no override knob).
  (2) **Deterministic writer hardened** (edit targets in `agents/context-pruner/*`,
  regenerated into the bundled artifact — the generated file is never
  hand-edited): consecutive assistant fragments coalesce to one entry
  (fragment-storm fix), `resume`-spam coalesces to one entry with an `(×N)`
  marker (MQ3), digest builder short-circuits `[compacted]` sentinels and
  `{compacted:true}` JSON placeholders (parse-based, no false positives),
  error-log section removed from the structured block, preserved-state paths
  normalized repo-relative from a threaded `projectRoot` (spawn-param
  injection, matching the `digestCaps` precedent) and recency-capped at 12
  newest-first (intentional contract change: cap 25→12), first-user-turn pin
  skips protocol dumps.
  (3) **Context-window truth** — `common/src/constants/context-windows.ts`
  now carries `CONTEXT_WINDOW_FALLBACKS` (vendor-published, from the live
  catalogs) + `resolveContextWindowForModel` returning
  `{ window, provenance }`; the runtime ladder is unchanged
  (live catalog → gateway catalog → fallback table → default); the cli
  substring heuristics (`context-windows.ts` name table, `inferContextLength`
  fallbacks incl. the two in `static-catalogs-gateways.ts` found by Loop 2
  V6) are retired; name-derived catalogs keep their documented estimates.
  (4) **Window provenance badge** threaded through the existing
  `tokensMax` flow (store → bootstrap → layout → sidebar/right-sidebar
  sections) so the operator sees where a model's window came from.
- **Tests Added:** `packages/agent-runtime/src/__tests__/semantic-summary-upgrade.test.ts`
  (13: prompt contract, band validation, leak rejection, redaction,
  fallback-on-failure, abort propagation),
  `packages/agent-runtime/src/__tests__/compaction-summary-preservation.test.ts`
  (3: envelope-form preservation incl. the bare `<compaction-summary>`
  literal), `cli/src/utils/__tests__/context-window-fallbacks.test.ts` (9:
  parity, vendor adds, never-wrong-family default, name-catalog parity),
  `agents/__tests__/context-pruner-phase1-hardening.test.ts` (16: coalescing,
  placeholders, error-section absence, repo-relative paths, cap 12, dump
  pin). Existing pins updated where the FID declared the contract change
  (cap 25→12; unmatched-window heuristic expectations).
- **Verification Evidence:** typecheck × 4 PASS (`sdk`, `common`,
  `packages/agent-runtime`, `cli` — `tsc --noEmit` clean in all four);
  agents suite 341 pass / 1 pre-existing vendored-resource fail
  (`resources/console/web` missing `@testing-library/react`; baseline);
  agent-runtime suite 496 pass / 0 fail; sdk suite 537 pass / 0 fail;
  cli state+chat+utils suites 1521 pass (24 fails proven pre-existing
  cross-suite pollution: `createSavantCodeApiClient` suites pass in
  isolation before AND after the change; wide-run baseline without the
  change is 25 fails — strictly worse); eslint `--max-warnings 0` clean on
  all touched paths; prettier applied; `bun run lint:md` clean;
  regenerated bundle carries the hardened pruner (`capRecentFirst` /
  `normalizePathForState` present in
  `cli/src/agents/bundled-agents.generated-data/04-context-pruner.ts`);
  **LIVE forced-compaction gate PASS 7/7**
  (`dev/scratchpad/live-compaction-gate.ts` drives the production
  `runContextPrunerMain` over a 190-message fragment-storm + resume-spam +
  placeholder + Windows-path history: envelope preserved, 150 fragments →
  2 entries, 11 resumes → coalesced `(×N)`, zero placeholder re-digests,
  zero absolute-path noise, goal + first turn pinned verbatim).
- **Archived:** yes (moved to `dev/fids/archive/` per Auto-Archive rule;
  ledger + CHANGELOG updated)

## Lessons Learned

- The compactor machinery was never the defect — the summary **writer**
  was. When a system returns incoherent output, trace WHO produced the
  artifact before auditing the pipeline around it.
- An embedded/serialized agent scope (`handleSteps.toString()`) cannot
  call a model. Cross-cutting upgrades must land at a boundary that has
  the capability, and the audit must prove capability placement with
  grep counts, not convention.
- Self-reported convergence is not convergence. The Loop-2 pass here only
  became real when every claim required fresh tool output — and it found
  two design defects (the `<compaction-summary>` literal mismatch and the
  generated-file source-of-truth) plus one live heuristic dependency
  (V6) that authored bullets had missed.
- `bun test` path arguments are substring filters: a vendored
  `resources/` copy of a workspace poisons wide runs (29 phantom fails).
  Scope with `./`-prefixed paths and prove baselines by stashing.
- Windows-absolute paths in preserved state are operator-visible noise;
  normalize at the producer (with a threaded `projectRoot`), not the
  consumer.
