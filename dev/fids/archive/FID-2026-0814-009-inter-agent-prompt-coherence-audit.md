<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# FID: Inter-Agent Prompt & Definition Coherence Audit

**Filename:** `FID-2026-0814-009-inter-agent-prompt-coherence-audit.md`
**ID:** FID-2026-0814-009
**Severity:** high
**Status:** closed
**Created:** 2026-08-14
**YAGNI-Compliance:** Verified — no new code, no new config, no new agent, no new store. Every fix is a prompt-text / metadata correction inside the existing `agents/*` definitions (plus one optional runtime-wiring guard). The audit reuses the existing `spawnableAgents` allowlist and `withParentModel` mechanism; it does not introduce a new abstraction.

---

## Summary

The operator requested a project-wide audit of the inter-agent prompts (with
the **basher** prompt called out as the "vital problem") to find contradictions,
stale references, phase/tool-list misattributions, and model-uniformity gaps —
then a single sweep to make every agent definition uniformly coherent. This FID
catalogs six findings (`B-01`…`B-06`) with `file:line` evidence, proposes
minimal fixes, and runs the Perfection Loop on the FID itself.

The audit covered every agent definition under `agents/` that is spawnable from
the main harness (`agents/savant/savant.ts` `spawnableAgents`), plus the
savant's own prompts (`prompts.ts`, `system-prompt.ts`, `handle-steps.ts`), the
variants (`thinker-*`, `base-chat`), and the infra helpers (`context-pruner`,
`tmux-cli`, `browser-use`, `database`, `github`, `librarian`).

---

## Perfection Loop

### Missed Questions

Asked during the loop, as required: "What questions should I have asked when this FID was created, but failed to?"

1. **Does deleting `thinker-gpt` break the ChatGPT-OAuth delegation?** No — `thinker-gpt` was never in the savant's `spawnableAgents` allowlist, so `@thinker-gpt` could not resolve; the standard `@thinker` (`agents/savant/savant.ts:177`) is spawnable and already inherits the operator's model via `withParentModel`. The fold fixes the dead path rather than removing a working one.
2. **Does the `withParentModel` providerOptions merge drop any parent option?** No — the child's explicit options (e.g. `data_collection: 'deny'`) are overlaid on the parent's, and the parent's other keys are preserved. The only behavioral change is that the infra helpers' `deny` flag now survives when the default (paid) savant spawns them.
3. **Should the savant "verify with bashers" guidance change?** Operator decided no — only the basher's own contradictory prompt is fixed; the guidance stays.

### Code Verification Evidence

```text
$ grep -n "'thinker'" agents/savant/savant.ts
177:      'thinker',
$ grep -n "thinker-gpt" agents/savant/savant.ts
(no match — old delegation was dead)
$ grep -n "data_collection" agents/tmux-cli.ts agents/browser-use/browser-use.ts agents/database/database.ts agents/github/github.ts
(deny flags: tmux-cli.ts:19, browser-use.ts:10, database.ts:17, github.ts:19)
$ bun test packages/agent-runtime/src/__tests__/subagent-propagation-contract.test.ts
5 pass / 0 fail (withParentModel B-06 assertions)
$ bun test cli/src/commands/__tests__/prompt-builders.test.ts
5 pass / 0 fail (@thinker delegation)
```

### Loop 1 — RED (catalog)

The live A–Z v0.0.24 harness run reported: *"The Basher agents were unreliable
(their internal instruction conflicted with running commands — only the ZTAP
group executed). I'll switch to deterministic run_readonly_command calls."*
Source inspection confirms the conflict and surfaces five additional coherence
defects.

- **B-01 (P0, basher contradiction — the "vital problem").**
  `agents/basher.ts` `systemPrompt` (line ~49) says: *"Your job is to: 1. Review
  the terminal command and its output 2. Analyze the output…"* while
  `instructionsPrompt` (lines 55-62) says: *"The user has provided a command to
  run… Run the command and then describe the relevant information… Do not use
  any tools! Only analyze the output of the command."* — **contradiction:** the
  prompt orders the model to "run the command" (which requires the
  `run_terminal_command` tool) while simultaneously forbidding all tool use.
  In fact the deterministic `handleSteps` generator (lines 72-107) already runs
  the command BEFORE the model takes over: it yields `run_terminal_command`,
  returns raw output when `what_to_summarize` is absent, and only yields
  `'STEP'` (handing control to the LLM) when `what_to_summarize` is present.
  The model's only real job at STEP time is to *summarize output already in its
  context*. The prompt misdescribes the two-phase contract, which is exactly why
  the in-harness agent observed bashers failing to run commands reliably.

- **B-02 (P1, Detective phase misattribution).**
  `agents/detective/detective.ts:138`: *"Discover issues with evidence. You do
  NOT implement fixes — that is Forge's RED phase responsibility."* Forge is the
  **GREEN** phase agent (`agents/forge/forge.ts` — "Savant the Forge", spawned
  to implement converged FID specs); Detective is RED. The parenthetical
  misattributes Forge's phase and contradicts the Detective's own
  `spawnerPrompt` ("RED phase agent for the ECHO Perfection Loop").

- **B-03 (P1, Recorder status-vocabulary drift).**
  `agents/recorder/recorder.ts:23`: *"Maintain accurate status (in_progress,
  complete, closed)…"* The FID lifecycle's allowed status values are
  `created | analyzed | fixed | verified | closed` (`dev/echo-v0.1.2-single-agent.md`
  "FID Format"; also the FID template and every active FID header). The Recorder
  — the agent whose sole job is FID lifecycle management — is told to use a
  status vocabulary that does not match the protocol it manages.

- **B-04 (P2, Scout legacy tool-calling instruction).**
  `agents/scout/scout.ts` `instructionsPrompt` carries a stale instruction not
  present on any other agent: *"CRITICAL: Use the set_output tool by calling it
  as a function with a JSON object argument. Do NOT write XML tags like
  <set_output> or </set_output>. Call the tool directly."* This references a
  tool-calling format (XML tags vs. function calls) that is no longer how the
  harness invokes tools, and it is inconsistent with every other agent's
  prompts.

- **B-05 (P1, thinker-gpt paid model hardcode unreconciled).**
  `agents/thinker/thinker-gpt.ts:8` still declares `model: 'openai/gpt-5.4'`
  with **no** FID-2026-0814-004 H-11 reconciliation, while its siblings were
  reconciled: `agents/thinker/thinker-gemini.ts:10-11` and
  `agents/thinker/thinker-with-files-gemini.ts:9-10` now carry the "display
  metadata only… inherits the operator's model via withParentModel" note with
  `model: 'openrouter/free'`. `thinker-gpt` is referenced by `/plan` and
  `/review` (`cli/src/commands/prompt-builders.ts:27,38`) when a ChatGPT OAuth
  account is connected — so the hardcode is a live paid-model surface that the
  unification sweep missed. **Needs operator decision:** whether the
  ChatGPT-OAuth delegation is an intentional exception (route to the user's own
  GPT account) or must inherit the operator's selected model like every other
  sub-agent.

- **B-06 (P1, withParentModel drops the child `data_collection: 'deny'`
  privacy flag).**
  `packages/agent-runtime/src/tools/handlers/tool/spawn-agent-utils.ts`
  `withParentModel` spreads the child template then replaces BOTH `model` and
  `providerOptions` with the parent's. Four infra helpers deliberately set
  `providerOptions: { data_collection: 'deny' }` (`agents/tmux-cli.ts:12-13`,
  `agents/browser-use/browser-use.ts:6-7`, `agents/database/database.ts:16-17`,
  `agents/github/github.ts:16-17`). The default (paid) savant's
  `defaultProviderOptions` is `{}` (`agents/savant/savant.ts`), so spawning any
  of those helpers from the default savant **silently drops** their
  `data_collection: 'deny'` — the privacy flag that keeps browser/DB/token/CLI
  interaction content out of provider training data. (The free savant keeps
  `data_collection: 'deny'`, so the free path is unaffected.)

### Loop 1 — GREEN (minimal fixes)

- **B-01** — Rewrite `agents/basher.ts` `instructionsPrompt` (and tighten
  `systemPrompt`) to state the actual two-phase contract: the command has
  already been executed and its output is in context; the agent's only job is
  to summarize the requested information and call **no** tools. Keep the
  existing fail-fast phase-gate clause (FID-2026-0806-016) intact.
- **B-02** — `agents/detective/detective.ts:138`: change *"Forge's RED phase
  responsibility"* → *"Forge's role (GREEN phase)"*.
- **B-03** — `agents/recorder/recorder.ts:23`: align the status vocabulary to
  the canonical `created | analyzed | fixed | verified | closed`.
- **B-04** — `agents/scout/scout.ts`: remove the stale XML-tag tool-calling
  line; keep the "check exitCode/stderr" line.
- **B-05** — Delete the `agents/thinker/thinker-gpt.ts` variant entirely and
  fold `/plan` + `/review` into the standard `@thinker` (already spawnable and
  already inherits the operator's selected model via `withParentModel`).
  Update `cli/src/commands/prompt-builders.ts` (`@thinker-gpt` → `@thinker`),
  its test, `savant-free/SPEC.md`, and `dev/quality-baseline.json`.
- **B-06** — In `withParentModel`, preserve the child's
  `data_collection: 'deny'` when the parent does not explicitly set a stronger
  option (merge: child's `data_collection: 'deny'` wins). Small, targeted
  change; no new abstraction.

### Loop 1 — AUDIT (self-audit, evidence re-verified)

- **B-01 verified:** `agents/basher.ts:62` quotes *"Do not use any tools! Only
  analyze the output of the command."*; `handleSteps` at lines 72-107 runs
  `run_terminal_command` then yields `'STEP'` only under `what_to_summarize`.
  The contradiction is real, not a misread.
- **B-02 verified:** `agents/detective/detective.ts:138` quotes *"Forge's RED
  phase responsibility"*; Forge's phase is GREEN per its own definition and the
  roster. Confirmed.
- **B-03 verified:** `agents/recorder/recorder.ts:23` quotes
  *"(in_progress, complete, closed)"*; the single-agent protocol and FID
  template use `created | analyzed | fixed | verified | closed`. Confirmed drift.
- **B-04 verified:** the XML-tag line is unique to
  `agents/scout/scout.ts` (grep of all `agents/*` prompts shows no other agent
  carries it). Confirmed stale.
- **B-05 verified:** `agents/thinker/thinker-gpt.ts:8` = `model:
  'openai/gpt-5.4'` with no H-11 note; siblings carry the note. Confirmed
  inconsistency; the ChatGPT-OAuth question is flagged for the operator rather
  than assumed (no guessing).
- **B-06 verified:** `withParentModel` replaces `providerOptions`; four helpers
  set `data_collection: 'deny'`; default savant `defaultProviderOptions` is
  `{}`. Confirmed drop; free path unaffected.

- **Five Questions:**
  1. *All cases?* Yes — the fixes are prompt/metadata corrections plus one
     guarded merge; no behavioral surface is left half-covered.
  2. *1000 agents?* Yes — no new global state; the providerOptions merge is a
     pure function of the two templates.
  3. *Hostile attacker?* B-06 closes a privacy regression; B-01 removes a
     prompt that provokes unreliable tool behavior; no new attack surface.
  4. *2 years?* Yes — aligning vocabularies and removing stale instructions
     reduces future drift, not adds to it.
  5. *Industry standard?* Yes — truthful two-phase prompt contracts and
     preserved privacy flags are the standard.

- **Omission check:** the audit also read `agents/base-chat.ts`,
  `agents/context-pruner.ts` + `context-pruner/constants.ts`,
  `agents/tmux-cli.ts` + `tmux-cli/prompts.ts` + `handle-steps.ts`,
  `agents/librarian/librarian.ts`, `agents/file-explorer/*`,
  `agents/researcher/*`, `agents/thinker/*`, `agents/browser-use/*`,
  `agents/database/*`, `agents/github/*`, `agents/savant/prompts.ts`,
  `agents/savant/system-prompt.ts`, `agents/savant/handle-steps.ts`, and
  `common/src/constants/agents.ts`. No additional contradictions found beyond
  `B-01`…`B-06`. The savant's own "verify with bashers" guidance
  (`agents/savant/prompts.ts:39,77,80,194`; `system-prompt.ts:137,175,200`)
  was noted as a contributing factor to the basher-reliability observation but
  is left out of this FID's fix set — changing the primary-coder verification
  guidance is a behavioral decision that belongs with the operator, and
  `run_readonly_command` is already the deterministic path the in-harness agent
  correctly fell back to. (Flagged here so it is not silently dropped.)

- **Verdict:** no self-correction required; the findings are accurate and the
  fixes are minimal. Loop converged.

### Loop 2 — RED/GREEN/AUDIT (no delta)

Re-verified all six citations after writing; no new findings. The only open
items were two operator decisions; both are now resolved (Loop 3).

### Loop 3 — decisions resolved, converged

Operator decisions (2026-08-14), recorded and folded into GREEN:

1. **B-05** — *"Fold into @thinker."* The `thinker-gpt` variant is a pre-rebrand
   artifact whose `openai/gpt-5.4` hardcode does not route through GPT anyway.
   It is deleted; `/plan` + `/review` delegate to the standard `@thinker`
   (verified spawnable at `agents/savant/savant.ts:177`; `thinker-gpt` was NOT
   in the allowlist, so the old delegation could not resolve — the fold also
   fixes that dead path). The ChatGPT-OAuth connection feature stays untouched.
2. **Savant verification guidance** — *"Leave basher guidance."* Do NOT change
   `agents/savant/prompts.ts` / `system-prompt.ts` to prefer
   `run_readonly_command`; only the basher's own prompt (B-01) is fixed.

**Convergence evidence (fresh tool output, not self-report):**
- `grep -n "'thinker'" agents/savant/savant.ts` → `177: 'thinker'`
  (spawnable); `grep -n "thinker-gpt" agents/savant/savant.ts` → NO match
  (confirms the old `@thinker-gpt` delegation was dead).
- `providerOptions` on `AgentTemplate` is `OpenRouterProviderRoutingOptions`
  (flat: `order`, `allow_fallbacks`, `require_parameters`, `data_collection`,
  `only`, `ignore` — `common/src/types/agent-template.ts:42-69`). The flat
  spread merge `{ ...parent.providerOptions, ...child.providerOptions }`
  typechecks and preserves the child's `data_collection: 'deny'`.
- B-01 edit applied and re-read: `agents/basher.ts:44-60` now states
  "Analyze the output of a terminal command that has already been executed"
  and "Do not call any tools — the command has already run".

**Verdict: converged.** No self-correction required. Implementation proceeds.

## Resolution

- **Status:** `closed` — B-01…B-06 implemented 2026-08-14 under operator approval (B-05 → fold into `@thinker`; verification guidance → leave basher guidance); **B-07 + B-08 implemented and re-closed 2026-08-14** per operator directive that nothing is ever out-of-scope (the paid-model surface discovered during the gate sweep was expanded into scope and addressed).
- **Fix Description:** B-01 basher prompt two-phase contract; B-02 Detective phase attribution (Forge = GREEN); B-03 Recorder status vocabulary; B-04 Scout stale instruction removal; B-05 `thinker-gpt` deleted + `/plan`/`/review` folded into `@thinker`; B-06 `withParentModel` preserves the child's `data_collection: 'deny'`; B-07 best-of-n editor paid-model hardcodes reconciled to `openrouter/free`; B-08 canonical ECHO role agents + infra helpers paid-model defaults reconciled to `openrouter/free` (operator-model inheritance).
- **Tests Added:** two `withParentModel` assertions in `subagent-propagation-contract.test.ts`; `prompt-builders.test.ts` updated (`@thinker-gpt` → `@thinker`).
- **Verification Evidence:** typecheck ×4 + agents clean; full suites agent-runtime 960/0 · common 614/0 · SDK 476/0 · CLI 3088/0 · agents 49/0; ESLint + lint:md + Prettier + `validate:repository` + `fid-ledger` clean; regenerated `bundled-agents.generated.ts` contains **zero** paid-model literals (only `openrouter/free`, free flash-lite, and the free savant catalog).
- **Archived:** Yes — moved to `dev/fids/archive/` on re-closure (2026-08-14).

### Loop 4 — RED (B-07: best-of-n editor paid-model hardcodes)

Per operator directive (2026-08-14): *"NOTHING is ever 'out of scope' unless i
say it… default is to expand the scope and include the issue and address it."*
The paid-model surface discovered during the gate sweep is therefore in scope
and addressed here, not deferred.

The best-of-n editor subsystem (`agents/editor/best-of-n/*`) is a set of
`SecretAgentDefinition`s (a distinct type extending `AgentDefinition`, with
`propose_*` draft tools and a `publisher`). Three sources hardcode paid
models:

- `editor-multi-prompt.ts:16` — `model: 'anthropic/claude-opus-4.8'` (the
  multi-prompt editor itself).
- `editor-implementor.ts` — `createBestOfNImplementor` maps the `sonnet`/`opus`/
  `gpt-5`/`gemini` option to `anthropic/claude-sonnet-4.5` /
  `anthropic/claude-opus-4.8` / `openai/gpt-5.1` /
  `google/gemini-3-pro-preview`; the default `editor-implementor` instantiates
  `{ model: 'opus' }` → `claude-opus-4.8`, and the variants
  `editor-implementor-opus.ts` / `editor-implementor-gpt-5.ts` do the same.
- `best-of-n-selector2.ts` — `createBestOfNSelector2` maps the option to
  `anthropic/claude-sonnet-4.5` / `anthropic/claude-opus-4.8` / `openai/gpt-5.4`;
  the default `best-of-n-selector2` instantiates `{ model: 'opus' }` →
  `claude-opus-4.8`.

**Reachability:** these are NOT in the main savant's `spawnableAgents`
(`agents/savant/savant.ts:171-187`), and no CLI command/trigger spawns
`editor-multi-prompt` directly (only UI rendering helpers
`isMultiPromptEditor`/`getMultiPromptPreview` in `agent-branch-wrapper.tsx`
reference the agent type). They are bundled via
`cli/src/agents/bundled-agents.generated.ts`. **Critically**, every spawn
boundary applies `withParentModel` (`spawn-agents.ts:127`,
`spawn-agent-inline.ts:97`), so a spawned editor agent already inherits the
parent's model — the hardcode is a latent default that only leaks if the editor
is ever run as a top-level agent. That is still a paid-model surface the
operator's one-model rule forbids.

### Loop 4 — GREEN (minimal fix)

Reconcile the three sources to `model: 'openrouter/free'` with the same
"display metadata only — inherits the operator's model via withParentModel"
note used in FID-004 H-11 (the thinker agents). The `model` option param on the
factories is **kept** because it still drives non-model behavior
(`displayName`, `reasoningOptions`, and the `<think>`-instruction branch), but
it no longer maps to a paid model literal:

- `editor-multi-prompt.ts` — `model: 'anthropic/claude-opus-4.8'` →
  `'openrouter/free'` + note.
- `editor-implementor.ts` — replace the 4-way paid-model ternary with
  `'openrouter/free'`; drop the now-unused `isSonnet`/`isOpus` locals (keep
  `isGpt5`/`isGemini` for the `<think>`-branch).
- `best-of-n-selector2.ts` — replace the 3-way paid-model ternary with
  `'openrouter/free'` (keep `isSonnet`/`isOpus`/`isGpt5` for `displayName`/
  `reasoningOptions`/`<think>`-branch).

No agent is deleted; no spawn path changes; the editor still works (best-of-n
over different strategy prompts, all on the operator's model).

### Loop 4 — AUDIT (double audit, tool output)

```text
$ grep -rn "claude-opus-4.8\|claude-sonnet-4.5\|gpt-5.4\|gpt-5.1\|gemini-3-pro" agents/editor/
(0 matches after edit — required)
$ grep -rn "inheritParentModel" agents/editor/
(0 matches — no editor agent opts out of model inheritance)
$ grep -n "withParentModel" packages/agent-runtime/src/tools/handlers/tool/spawn-agents.ts packages/agent-runtime/src/tools/handlers/tool/spawn-agent-inline.ts
spawn-agents.ts:127, spawn-agent-inline.ts:97 (inheritance applied at every spawn)
$ cd cli && bun run prebuild:agents && grep -rn "claude-opus-4.8\|gpt-5" src/agents/bundled-agents.generated.ts
(0 paid-model literals in the regenerated bundle)
```

**Law 4:** no new function or config field is added; the change removes a paid
model literal and keeps the existing `withParentModel` inheritance path as the
sole model source. **AUDIT passes → ADVERSARIAL.**

### Loop 4 — ADVERSARIAL (fresh meta-verification)

- **Refuted concern:** "the editor's best-of-n diversity is lost." Best-of-n
  still runs N implementors with N different strategy prompts and selects the
  best — the diversity is prompt-level, not model-level. The operator's rule
  (one model project-wide) explicitly forbids the model-level diversity, so
  collapsing it is the required behavior, not a regression.
- **Refuted concern:** "`openrouter/free` would silently bill if used."
  `openrouter/free` is the operator-mandated safe fallback; the real model at
  runtime is the parent's via `withParentModel`, and the fallback is free, not
  paid.
- **Omission check:** the `gemini` option (`google/gemini-3-pro-preview`) and
  `openai/gpt-5.1` in `editor-implementor.ts`, plus `gpt-5.4`/`sonnet-4.5` in
  `best-of-n-selector2.ts`, were all in the original paid set and are all
  removed. No remaining paid literal in `agents/editor/`.
- **No refutations; no omissions. ADVERSARIAL passes → ready to implement.**

### Loop 4 — VERDICT

B-07 converged. Implementation proceeds under the operator's standing
automation level 3 grant ("address the issue", "never leave a problem for
later").

### Loop 5 — RED (B-08: canonical-agent paid defaults, discovered while fixing B-07)

Regenerating the bundle after B-07 surfaced that the paid-model surface is
broader than the best-of-n editor. Per the operator's rule (nothing is ever
out-of-scope; one model project-wide; never a paid model fallback), the
canonical ECHO role agents and infra helpers also carried paid `model`
defaults:

- `agents/thinker/thinker.ts:10` — `anthropic/claude-opus-4.8`.
- `agents/forge/forge.ts` — `EDITOR_MODEL_BY_VARIANT` mapped `opus`→`claude-opus-4.8`, `gpt-5`→`gpt-5.1`, `deepseek`→`deepseek-v4-pro`, `glm`/`kimi`/`minimax`→paid provider slugs; the `forge` default is `{ model: 'opus' }`.
- `agents/verifier/verifier.ts:105` — `createReviewer('anthropic/claude-opus-4.8')`.
- `agents/adversary/adversary.ts:88` — `createAdversary('anthropic/claude-opus-4.8')`.
- `agents/context-pruner.ts:10`, `agents/detective/detective.ts:54`, `agents/recorder/recorder.ts:8`, `agents/scribe/scribe.ts:8` — `anthropic/claude-sonnet-4.6`.
- `agents/file-explorer/directory-lister.ts:33`, `agents/file-explorer/glob-matcher.ts:35` — `anthropic/claude-sonnet-4.5`.

All are spawned as subagents, so `withParentModel` (`spawn-agents.ts:127`,
`spawn-agent-inline.ts:97`) already overrides their model at runtime — but the
paid literal is a latent default that the operator's "never a paid model" rule
forbids. **Note:** the infra/read-only helpers (`basher`, `browser-use`,
`database`, `github`, `researcher-web`, `researcher-docs`, `scout`) already use
the **free** `google/gemini-3.1-flash-lite` default, and the `savant-free-*`
variants use the free catalog (`minimax-m3`, `glm-5.2`, `kimi`, `mimo`,
`deepseek-v4-flash`, …). Those are already free and are left as-is — they carry
no billing risk and are overridden by `withParentModel` at runtime.

### Loop 5 — GREEN (minimal fix)

Reconcile every **paid** `model` literal to `model: 'openrouter/free'` with the
same "display metadata only" note:

- Direct literals → `'openrouter/free'` (`thinker`, `context-pruner`,
  `detective`, `recorder`, `scribe`, `directory-lister`, `glob-matcher`).
- `forge.ts` — delete the now-unused `EDITOR_MODEL_BY_VARIANT` map (only
  `opus` was instantiated) and set `model: 'openrouter/free'`; keep
  `EDITOR_VARIANTS_WITH_THINK_TAGS` for the `<think>` branch.
- `verifier.ts` / `adversary.ts` — `createReviewer('openrouter/free')` /
  `createAdversary('openrouter/free')` (`Model` accepts the string via the
  `(string & {})` escape).

No agent is deleted; no spawn path changes; `withParentModel` remains the sole
runtime model source.

### Loop 5 — AUDIT (double audit, tool output)

```text
$ grep -rn "anthropic/\|openai/gpt\|google/gemini\|deepseek-v4-pro\|gpt-5.\|claude-" agents/ --include=*.ts | grep -v "//" | grep "model:"
(0 matches — no paid model literal remains)
$ grep -rn "inheritParentModel" agents/ --include=*.ts | grep -v "removed"
(0 matches — no agent opts out of model inheritance)
$ cd cli && bun run prebuild:agents && grep -oE "model: '[^']+'" src/agents/bundled-agents.generated.ts | sort | uniq -c
(openrouter/free 21; free flash-lite 7; free savant-catalog slugs; no claude/gpt/gemini-pro)
```

**Law 4:** no new function or config field; the change removes paid literals and
keeps `withParentModel` as the sole model source. **AUDIT passes → ADVERSARIAL.**

### Loop 5 — ADVERSARIAL (fresh meta-verification)

- **Refuted concern:** "the free flash-lite defaults should also be removed."
  They are already free (no billing risk) and are overridden by
  `withParentModel` at runtime; normalizing them is a cosmetic consistency
  change, not a correctness fix, and the free savant catalog must stay for the
  free variant's own model selection. Documented here so it is not silently
  skipped.
- **Omission check:** all 10 paid sites (7 direct literals + forge map +
  verifier + adversary) are covered; the regenerated bundle was re-grepped and
  no paid literal remains. The `savant-free-*` variants were verified to be the
  free catalog and left intact.
- **No refutations; no omissions. ADVERSARIAL passes → ready to implement.**

### Loop 5 — VERDICT

B-07 + B-08 converged. Paid-model surface in `agents/` is fully reconciled to
`openrouter/free`; only free fallbacks and the free savant catalog remain.
Implementation proceeds under automation level 3.
