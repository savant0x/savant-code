<!-- markdownlint-disable MD013 -->
# Token Optimization & Context Engineering — Redesign v2

**Scope:** Re-design of Savant's context-compaction, token-cost, and code-minimalism stack, grounded in the
`docs/research/Savant Code Token Optimization Plan.md` research doc, a deep-dive of the vendored harnesses under
`resources/` (openclaw, hermes-agent, zero, DeepSeek-Reasonix, axon, goose, continue, gemini-cli, cline, kilocode,
OpenHands), and an audit of the current implementation.

**Ambition:** Not feature parity. Every harness in `resources/` solved one or two corners of the problem well.
This design takes the strongest idea from each, resolves their contradictions, and integrates them into Savant's
ECHO Perfection Loop so the whole is structurally stronger than any single vendor's implementation.

**Status:** Design (RED/GREEN loop for implementation to follow via FIDs).

---

## 1. Thesis

Context engineering has three separable problems that the industry keeps conflating:

1. **Correctness** — compaction must not lose the state the model needs to keep working (plans, skills, user
   intent, exact identifiers, file reachability).
2. **Economics** — compaction must be budgeted against prompt-cache hits, not just raw token counts; a summary
   that breaks the cache prefix every turn can cost more than it saves.
3. **Stall-avoidance** — a single giant mid-session summarization call is a user-visible freeze; the cost should
   be amortized.

Every major harness nails one of these (Hermes: amortization + user-message fidelity; OpenClaw: correctness via
structured summaries + quality audits; Zero: correctness via preserved structured state; DeepSeek: cache
economics + fixed tail budgets; Axon: observability hooks). **No vendor integrates all three with a
protocol-enforced code-minimalism layer.** Savant's ECHO harness is the only one with a bounded FSM, an
adversarial audit phase, and Law-enforced tool boundaries — which is exactly the substrate the YAGNI ladder
needs to be *enforced* rather than *suggested* (the failure mode the research doc calls out for standalone
prompt-injected skills).

The re-design therefore has **five pillars**, each mapped to a source of truth:

| Pillar | Idea | Strongest source |
|---|---|---|
| P1 Compaction Fidelity | Structured summary contract; never summarize user messages; carry structured state (plan, skills, file ops) across compaction | Hermes + OpenClaw + Zero |
| P2 Cache Economics | Fixed tail budgets, cache-reset-point budgeting, cheap tool-result snipping pre-pass | DeepSeek + research Layer 4 |
| P3 Amortization | Micro-compaction (one exchange per turn) with anti-thrash guards; idle compaction | Hermes |
| P4 Observability | PostCompact hooks, per-agent token telemetry, cache-hit-rate alerts, context-usage UI | Axon + Gemini + research OTel |
| P5 Enforcement | Ponytail YAGNI ladder + Caveman telegraphic output wired into ECHO laws, Forge/Thinker/Verifier/Adversary | Research doc + Savant FSM |

---

## 2. Current State (audited, not assumed)

All paths verified against the working tree.

### 2.1 What exists today

| Component | File | What it does | Gap vs. plan |
|---|---|---|---|
| ContextCompactor (Layers 2–4) | `packages/agent-runtime/src/context-compactor.ts` | Micro-compact clears stale tool results (keeps last 3, `[compacted]` placeholder); auto-compact threshold check with circuit breaker; reactive compact preserves first message + last 20% + images | No user-message guarantee, no structured summary contract, no fixed tail budget, no anti-thrash scoring |
| Context token counting | `packages/agent-runtime/src/run-agent-step/context-tokens.ts` | Per-step count (web API for hosted, gpt-tokenizer local w/ 1.35× fudge); WeakMap per-message cache | No per-turn telemetry sink; cache-hit-rate invisible |
| Token counter | `packages/agent-runtime/src/util/token-counter.ts` | gpt-4o tokenizer, image flat 1600, per-message overhead 8, LRU text cache | Solid baseline — keep |
| Tool-result simplification | `packages/agent-runtime/src/util/simplify-tool-results.ts` | read_files + terminal results collapsed to metadata | Already a Layer-3 pre-pass for 2 tools; needs generalization (grep/glob/db) + deterministic byte limits |
| Cache-debug subsystem | `packages/agent-runtime/src/util/cache-debug.ts` + `run-agent-step/cache-debug.ts` | Prompt snapshots enriched with provider usage (`CacheDebugUsageData`) + `onCacheDebugUsageReceived` hooks, gated by `CACHE_DEBUG_FULL_LOGGING` | The substrate P4 telemetry must EXTEND, not duplicate; today it's debug-only, not a first-class telemetry sink |
| Context-pruner agent | `agents/context-pruner/` (handle-steps, summarize-messages, apply-budgets) | Full LLM summarization; role-tagged `[USER]`/`[ASSISTANT]` entries; budgets (assistant+tool 20k, user 50k); cache-miss detection; `<conversation_summary>` + `<historical_memory>` wrapper | Free-form prose summary — no required sections, no exact-identifier rule, no preserved structured state, no re-distill contract, no quality audit |
| Pruner trigger | `agents/savant/handle-steps.ts` | Spawns context-pruner at 80% of maxContextLength (250k/400k variants) | Single ratio; no idle trigger; no force-ratio |
| ECHO enforcement layer | `packages/agent-runtime/src/echo/` (pre-write-gates, post-write-scanners, law4-turn-end, advisory-logger) | Law-gated writes, turn-end checks, advisory receipts | The enforcement substrate the YAGNI ladder needs — extend, don't bypass |
| Verifier + Adversary | `agents/verifier/verifier.ts`, `agents/adversary/adversary.ts` | AUDIT + ADVERSARIAL phases with evidence rules | Add YAGNI assessment duties (P5) |

### 2.2 What the research doc proposed that does NOT exist yet

- `packages/agent-runtime/src/yagni-ladder.ts` — MISSING
- `packages/agent-runtime/src/run-agent-step/token-telemetry.ts` — MISSING
- `packages/agent-runtime/src/tools/handlers/tool/ponytail-debt.ts` — MISSING
- `dev/YAGNI-LEDGER.md` — MISSING
- `FID-TEMPLATE.md` `YAGNI-Compliance:` field — MISSING

### 2.3 Corrections to the research doc (grounded in source)

- **`main-prompt.ts` is NOT the prompt assembler.** It is the entry point that routes to `loopAgentSteps`; the
  real assembly lives in `packages/agent-runtime/src/system-prompt/prompts.ts` (`knowledgeFilesPrompt`,
  `getProjectFileTreePrompt`, `getSystemInfoPrompt`) and `getAgentPrompt` in
  `packages/agent-runtime/src/templates/strings.ts`. The "re-architect main-prompt.ts" prescription must target
  those files instead.
- **Four-layer compaction already exists** (`ContextCompactor` Layers 2–4 + the pruner as Layer 1.5). The
  research's "fundamental overhaul" is overstated; the redesign is a fidelity + economics upgrade, not a rebuild.
- **"Phase 1 baseline across all nine canonical agents"** — the roster is now **10** (Adversary was added,
  FID-2026-0805-004). Any telemetry baseline must include the Adversary.

---

## 3. Industry Deep-Dive (what the leaders actually do)

### 3.1 Hermes (`resources/hermes-agent`) — amortization + user-message fidelity

- **Micro-compaction:** after each completed turn, fold exactly **one** oldest un-absorbed *exchange* (full agent
  turn: assistant + tool results + follow-ups, bounded by user messages on both sides) into a running summary.
  One call per turn, bounded cost, no mid-session stall. Off by default (`compression.micro_compact`).
- **User messages are NEVER compacted.** The asymmetry is deliberate and argued precisely: assistant narration
  ("I read this, I ran that") survives summarization with little loss, but *user instructions are the intent
  everything derives from and cannot be reconstructed* — paraphrasing them is how an agent confidently does the
  thing you told it not to, six turns later.
- **Anti-thrash guard (hard-won):** effectiveness must be scored against the *goal* — did the real prompt token
  count get under the threshold? — judged in `update_from_response` (the one place with the provider's real
  post-response count), NOT in `should_compress` (a rough preflight estimate that re-opens the loop), and never
  computed analytically as `floor = current - estimate` (tokenizer skew silently disables compaction).
- **Idle compaction:** opt-in predicate `_should_idle_compact` — session resuming after an idle gap (e.g.
  >30 min) with context above a floor compacts up front; cooldown prevents re-fire.
- **Structured summary template:** Resolved / Pending question tracking; historical (reference-only) section
  headings — deliberately NOT "Next Steps"/"Remaining Work", which the model would read as active instructions.
- **Token-budget tail protection** (keep the recent N tokens verbatim, not N messages); scaled summary budget
  proportional to the compressed content; cheap tool-output pruning pre-pass before the LLM summarization call.

**Take for Savant:** P1 (user-message guarantee, exchange-level folding), P3 (micro-compaction + anti-thrash +
idle), and the "reference-only headings" rule.

### 3.2 OpenClaw (`resources/openclaw`) — correctness via structured summaries + audits

- **Safeguard mode is the default** (stricter guardrails + summary quality audits); `mode: "default"` opts out.
- **Required summary sections** (`compaction-safeguard-quality.ts`): `## Decisions`, `## Open TODOs`,
  `## Constraints/Rules`, `## Pending user asks`, `## Exact identifiers` — with a strict policy that exact
  identifiers (IDs, URLs, file paths, ports, hashes, dates, times) survive **literally**, plus a keyword /
  pending-ask overlap audit of the produced summary.
- **Language-preservation instructions** (`compaction-instructions.ts`): summary body in the conversation's
  primary language; code/paths/identifiers/errors never translated. Custom instructions bounded to ~800 chars
  and treated as *untrusted prompt data* (injection-safe wrapping).
- **File-operation extraction:** compaction entries carry `readFiles` / `modifiedFiles` so the
  read-before-touch and reachability story survives across a compaction boundary.
- **Pre-compaction memory-save reminder:** before compacting, the agent is reminded to write important notes to
  memory files — prevents context loss at the boundary.
- **Compaction model override:** a dedicated (cheap local, or more capable) summarization model per agent config.
- **Overflow-error recovery:** matches dozens of provider error strings → compact and retry.
- **Session-tree entries:** full history stays on disk; compaction only changes what the next turn sees.
- **Active memory:** a deep-recall lane that escalates only when deterministic memory recall is insufficient.

**Take for Savant:** P1 (required sections, exact-identifier rule, file-op carry-over, memory-save reminder),
P4 (quality audit of the produced summary).

### 3.3 Zero (`resources/zero`) — preserved structured state

- **Compaction is a pure function** with the `Summarize` LLM call injected — trivially testable, provider-free.
- **`compaction_preserve.go`:** the active **plan**, loaded **deferred-tool schemas**, loaded **skills**, and
  **project instruction blocks** are appended to the summary as a single-line JSON block under a stable label
  (`## Preserved state (active plan + loaded skills; carried across compaction)`), with hard caps
  (`maxRecentEdits` 20, `maxEditNoteBytes` 160, `maxTaskObjectiveBytes` 512, `maxPreservedSkillBytes` 2 KiB).
  Structured state survives **exactly**, never paraphrased away.
- **Summary instructions** (`summaryInstructions`): preserve user goals and explicit constraints verbatim,
  decisions and why, files modified with paths + key code changes, commands + important results, in-progress
  items; carry earlier summaries forward (never drop prior facts); terse bullets; no invention.
- Proactive trigger at `compactionTriggerRatio = 0.7` of the context window, `defaultCompactionPreserveLast = 6`.

**Take for Savant:** P1 (preserved-state JSON block: FID state, todos, loaded skills, file ops — the Savant
analogue of Zero's plan/skills), P2 (pure-function compaction for testability).

### 3.4 DeepSeek-Reasonix (`resources/DeepSeek-Reasonix-main-v2`) — cache economics

- **Compaction as a cache-reset point:** the prompt grows append-only (high KV-cache hits) until `compactRatio`
  (0.8), then compacts to a **fixed token tail budget** (16 384) — a fixed budget, not a fraction, so a huge
  window compacts rarely and a small one still lands under the trigger (kills the re-compaction loop).
- **Layered ratios:** soft 0.5 (report growing context, keep cache-stable prefix intact), tool-result-snip 0.6
  (rewrite stale tool results *cheaply* before summary compaction), compact 0.8, force 0.9, target cap 0.5.
- **First-user-turn pinning:** pin the first user message verbatim (≤1500 tokens, ≤15% of window) — the request
  is the contract.
- **`<compaction-summary>` tags** so the model can distinguish summary from live input and strip/skip it.
- **90 s summarizer timeout** with a mechanical fold fallback (no hang).
- Summary system prompt mirrors Zero: `## Standing facts & constraints`, `## Goal`, `## Decisions & rationale`,
  `## Files & code`.

**Take for Savant:** P2 (fixed tail budget, cache-reset-point mindset, tool-result-snip pre-pass, first-user
pinning, summary tags), P1 (Standing-facts section).

### 3.5 Axon (`resources/axon`) — PostCompact hooks

- **PostCompact hook:** after compaction completes, emit `{ originalTokens, compressedTokens, compressionRatio,
  summary, sessionId }` to a hook (log, update memory, update UI). Hook failure is non-blocking; supports
  timeout + retry. Auto-compact framework centralizes threshold/max-output/available-input math.

**Take for Savant:** P4 (PostCompact event with ratio metrics → CLI status line, analytics event, memory update).

### 3.6 The rest

- **Goose** (`resources/goose/crates/goose/src/prompts/compaction.md` + `tests/compaction.rs`): a first-class
  compaction prompt as an auditable artifact with tests. Take: our pruner prompt deserves the same treatment.
- **Continue** (`resources/continue/core/util/conversationCompaction.ts`): re-summarization-aware — walks back to
  the *last* existing summary and only re-summarizes the delta; the summary chain never duplicates. Take: P1
  re-distill contract ("re-distill prior summaries with new messages, drop stale detail").
- **Gemini CLI** (`resources/gemini-cli`): live context-usage display with color thresholds (warning at
  `compressionThreshold`, error at ≥100%), configurable per model. Take: P4 context-usage meter in the CLI.
- **Cline** (`resources/cline/docs/features/auto-compact.mdx`): user-facing auto-compact docs + settings surface.
  Take: settings knobs (enable, threshold, keep-recent, model) as first-class config.

---

## 4. The Re-design

### P1 — Compaction Fidelity (the correctness pillar)

**1a. Structured summary contract.** Replace the free-form pruner output with required sections, OpenClaw-style,
adapted to Savant's FSM:

```text
## Standing facts & constraints      (user intent verbatim — never paraphrased)
## Goal                              (the converged FID objective / user request)
## Decisions & rationale             (why — so they are not re-litigated)
## Files & code                      (paths, signatures, exact edits, line locations)
## Open TODOs                        (reference-only — historical, not active instructions)
## Pending user asks                 (unresolved asks MUST not be dropped)
## Exact identifiers                 (IDs, URLs, paths, ports, hashes, dates — literal)
## Preserved state                   (JSON block — see 1b)
```

Rules: user messages are never summarized into anything but the Standing-facts/Goal sections (Hermes rule);
"Next Steps"/"Remaining Work" headings are forbidden (reference-only rule); prior `<conversation_summary>` blocks
are re-distilled with new messages and stale duplicate detail removed (Continue rule); identifiers are preserved
literally (OpenClaw strict policy).

**1b. Preserved-state JSON block** (Zero pattern → Savant analogue). `apply-budgets.ts` gains a
`buildPreservedState(messages)` that extracts, into one single-line JSON block:

- Active FID state (from the converged FID / `fid-validator` — status, decisions, acceptance criteria)
- Todo list state (toolName `write_todos` calls)
- Loaded skills (name + head, ≤2 KiB each, re-loadable)
- File ops: `readFiles` / `modifiedFiles` / `createdFiles` (OpenClaw file-op carry-over — keeps ECHO Law 1
  read-before-touch and Law 4 reachability truthful across the boundary)
- Hard caps on every field so the block can't defeat the compaction it rides in on.

The preserved-state block must survive **both** compaction paths: the pruner (Layer 1.5/3) AND `reactiveCompact`
(Layer 4 emergency truncation), which today preserves only first + last 20% + images — add the preserved-state
message to its preserve set so a mid-session overflow never drops FID/todos/skills state.

**1c. User-message guarantee.** The pruner already preserves `[USER]` entries separately from
`[ASSISTANT]/[TOOL]` entries; formalize it as a **hard invariant** (tested): user messages above a small
dedupe-with-standing-facts allowance are never dropped or paraphrased into assistant prose. Pin the first user
turn verbatim (DeepSeek: ≤1500 tokens / ≤15% window).

**1d. Memory-save reminder.** Before compaction, instruct the agent (in the summary prompt's preamble, not as an
active instruction) to persist durable knowledge to `knowledge.md`/`AGENTS.md` files. Historical/reference
register — the agent may act on it only through normal write tools, never inside the summary.

### P2 — Cache Economics (the cost pillar)

**2a. Fixed tail budget.** `apply-budgets.ts` already enforces independent *role* token budgets
(`ASSISTANT_TOOL_BUDGET` 20k / `USER_BUDGET` 50k, estimated via `CHARS_PER_TOKEN`) and force-keeps the newest
entry. Add a **fixed verbatim recent-tail token budget** (default 16 384, configurable) *alongside* those role
budgets — DeepSeek's fix for the re-compaction loop. The auto-compact threshold stays proportional to the window
(current `window − 30k`), but *what survives verbatim* is budgeted absolutely.

**2b. Cache-reset-point budgeting.** Document and instrument that compaction is a deliberate cache-reset point:
between compactions the prompt prefix is cache-stable. The pruner must not run more often than needed — the
research's "prefix stability" chapter is preserved, but implemented in the actual assembly files
(`system-prompt/prompts.ts`, `templates/strings.ts`): static blocks (laws, tool schemas, project context) in a
stable prefix, dynamic history last, with a single cache breakpoint before recent history.

**2c. Tool-result snip pre-pass.** Generalize `simplify-tool-results.ts` from read_files/terminal to
grep/glob/code_search/database results with deterministic byte limits (research Layer 3: 50 000 B API/db,
2 000-line grep, 500-char preview + scratchpad pointer). Run as a cheap no-LLM pass **before** any summary
compaction (DeepSeek snipRatio 0.6).

**2d. Summary tags.** Wrap the produced summary in `<compaction-summary>…</compaction-summary>` (DeepSeek
pattern) so the model can distinguish it from live input and skip it when reasoning about the current turn.

### P3 — Amortization (the stall-avoidance pillar)

**3a. Amortized compaction (off by default) — NOT to be confused with the existing Layer-2 `microCompact`
(stale tool-result clearing in `ContextCompactor`).** Add `compression.amortizedFold` to config. When enabled,
after each completed turn fold **one** oldest un-absorbed exchange into the running summary (Hermes pattern),
reusing the P1 summary contract. Turn does not close until the pass finishes; document the prompt-cache tradeoff
honestly (Hermes does).

**3b. Anti-thrash guard.** Port Hermes's hard-won guard: effectiveness is scored in the one place that sees the
provider's real post-response count (`loop.ts` / `loop-iteration.ts` where usage arrives) — did the real prompt
get under the threshold? — never in `shouldAutoCompact` (preflight), never analytically (tokenizer skew).
Strike counting + circuit breaker already exist in `ContextCompactor`; wire the *correct* success signal into
`recordCompactionResult`.

**3c. Idle compaction.** Opt-in predicate (`_shouldIdleCompact`) evaluated on session resume: idle gap >
`idleAfterSeconds` (default 1800) AND context > floor (default 40 000) → compact up front; cooldown window
prevents re-fire (Hermes predicate, ported to the trigger logic in `agents/savant/handle-steps.ts`).

**3d. Force ratio.** Keep the 0.8 proactive trigger; add a 0.9 force ratio where compaction proceeds even for
low-value folds rather than risking a hard overflow.

### P4 — Observability (the measurement pillar)

**4a. Token telemetry — EXTEND the existing cache-debug subsystem, do not create a parallel module.**
`packages/agent-runtime/src/util/cache-debug.ts` already snapshots the prompt and enriches it with provider
usage (`CacheDebugUsageData`, `enrichCacheDebugSnapshotWithUsage`), and `run-agent-step/cache-debug.ts` exposes
`onCacheDebugUsageReceived` / `onCacheDebugProviderRequestBuilt` hooks (gated by `CACHE_DEBUG_FULL_LOGGING`).
Add a lightweight `TokenUsageEvent { agentId, phase, promptTokens, completionTokens, cachedTokens,
estimatedCostUsd }` emitted from that existing hook path (where usage already arrives via the `onCostCalculated`
credits flow in `step.ts` / `loop-iteration.ts`). No new external OTel dependency in v1 — structured JSON events
first, OTel export can be a later adapter.

**4b. Cache-hit-rate monitor.** Derive cached-token ratio per turn from the provider usage in the cache-debug
hook. **Fallback:** providers don't all return `cachedTokens` — when absent, report the ratio as `unknown` (not a
false 0) and rely on the prompt/system/tools hash deltas the cache-debug snapshot already records
(`systemHash` / `toolsHash` stability across turns) as the prefix-stability signal. Alert (logger warning +
advisory) when the ratio drops sharply or a previously stable hash pair changes mid-run — the signature of a
prefix-stability regression (research: "sudden drop → refactor prompt").

**4c. PostCompact hook + status line.** After every compaction emit a `PostCompact` event
`{ originalTokens, compressedTokens, compressionRatio, summaryPreview, sessionId }` (Axon pattern) →
analytics event, and surface in the CLI status line (Gemini pattern): context %, compactions count, and
estimated USD saved. Non-blocking, timeout + retry on the hook.

**4d. Context-usage meter.** CLI renders a live context % with color thresholds (warning ≥ 70%, error ≥ 100%).

### P5 — Enforcement (the code-minimalism pillar)

The YAGNI/Caveman ideas from the research doc become **enforced protocol**, not prompt suggestions — this is the
industry-leader differentiator.

**5a. YAGNI ladder module.** New `packages/agent-runtime/src/yagni-ladder.ts`:

- `YagniAssessment { isSpeculative, reusedEntities, stdlibAlternatives, dependenciesAvoided, debtMarkersInserted }`
- The 6-rung ladder as a typed evaluator (does-this-need-to-exist → already-in-codebase → stdlib → native →
  installed-dependency → one-liner), each rung mapped to evidence sources (code-map search, dependency manifest).
- Safe-by-construction exemptions: trust-boundary validation, error paths (Law 14), type safety (Law 6) — never
  minimized (research doc's own warning: unstructured "write one-liners" drops path-traversal guards).

**5b. Forge gate.** Forge emits a `yagni_check` JSON block before writing code (research doc); a new pre-write
gate in the ECHO enforcement layer (`pre-write-gates.ts`) *validates* the block shape and rejects writes that
declare `isSpeculative: true` without a documented debt marker.

**5c. ponytail-debt tool + ledger.** New `packages/agent-runtime/src/tools/handlers/tool/ponytail-debt.ts`
(`harvest_yagni_debt`): regex-scans for `ponytail:` inline markers (name the ceiling + upgrade path), appends
formatted entries to `dev/YAGNI-LEDGER.md`. Reviewed by the Orchestrator at session start (research doc).

**5d. Verifier + Adversary duties.** Verifier's ECHO Audit Checklist gains a **YAGNI Assessment** item (structural
diff vs. the FID — FAIL on unrequested abstractions, single-implementation interfaces, "for later" scaffolding),
and a **Caveman review format** (single-line, evidence-citing, zero pleasantries — it already has the evidence
rules from FID-2026-0805-004). The Adversary's role (already defined) explicitly protects necessary complexity
from overzealous reduction — the "Auto-Clarity" boundary.

**5e. FID template field.** `templates/FID-TEMPLATE.md` gains
`YAGNI-Compliance: [Pending | Verified | Debt-Incurred]`.

**5f. Caveman output rules (opt-in).** A `compression.caveman` setting applies telegraphic style to
Orchestrator/Detective/Scribe output with Auto-Clarity bypasses (code blocks, paths, error messages, security
warnings stay byte-exact). Language-preservation default from OpenClaw: never translate or reformat identifiers.
This is the *last* pillar to ship — it touches every agent prompt and must not land before P1–P4.

---

## 5. Config Surface (protocol.config.yaml + cli settings)

`protocol.config.yaml` IS consumed at runtime via `readProtocolConfig(cwd)` in
`common/src/util/protocol-config.ts` (used by `prebuild-agents.ts` and the `transition-phase` tool handler). New
keys require extending the `ProtocolConfig` schema + its loader and the consumers — not just the YAML. The CLI
meter targets `cli/src/components/status-bar.tsx`.

```yaml
compression:
  enabled: true
  microCompact: false            # P3a — off by default (cache tradeoff)
  keepRecentTokens: 16384        # P2a — fixed tail budget
  autoCompactRatio: 0.8          # P3d
  forceCompactOffset: 15000      # P3d — force tier (tokens below window)
  idleCompaction:                # P3c
    enabled: false
    idleAfterSeconds: 1800
    floorTokens: 40000
  model: null                    # dedicated summarization model override (OpenClaw)
  summary:
    requiredSections: true       # P1a
    exactIdentifiers: strict     # P1a
yagni:
  enforced: true                 # P5b — Forge gate active
  ledger: dev/YAGNI-LEDGER.md    # P5c
caveman:                         # P5f
  enabled: false
  autoClarity: true
telemetry:                       # P4
  enabled: true
  cacheHitAlertDrop: 0.3         # alert when cached-token ratio drops 30+ points
```

## 6. Phased Implementation Plan

| Phase | Delivers | Primary files | Verify |
|---|---|---|---|
| 1 | P1a + P1b + P1c (summary contract, preserved state, user-message guarantee) | `agents/context-pruner/*`, `common/src/types/messages/*`, pruner tests | pruner unit tests; long-conversation fixture |
| 2 | P2a–P2d (fixed tail budget, snip pre-pass, tags, cache-reset docs) | `context-compactor.ts`, `simplify-tool-results.ts`, `apply-budgets.ts` | compaction tests; token assertions |
| 3 | P3a–P3d (micro-compaction, anti-thrash, idle, force) | `context-compactor.ts`, `loop-iteration.ts`, `loop.ts`, `handle-steps.ts` | anti-thrash tests (Hermes port), idle predicate tests |
| 4 | P4a–P4d (telemetry, cache-hit alerts, PostCompact, CLI meter) | `token-telemetry.ts` (new), `step.ts`, `loop.ts`, CLI status components | telemetry unit tests; CLI snapshot |
| 5 | P5a–P5e (ladder, Forge gate, debt tool+ledger, Verifier/Adversary, FID field) | `yagni-ladder.ts` (new), `ponytail-debt.ts` (new), `pre-write-gates.ts`, `verifier.ts`, `adversary.ts`, `FID-TEMPLATE.md` | gate tests; ledger e2e |
| 6 | P5f + config surface + docs (Caveman, settings, CHANGELOG, README) | agent prompts, `protocol.config.yaml`, docs | full gates; manual long-session run |

Hard gates per phase (ECHO): typecheck ×12, full test suite, eslint 0, prettier clean, lint:md 0. Every phase
ships behind its own FID; no phase lands until the previous one's gates pass. Phases 1–2 are safe on their own;
3–4 are additive/opt-in; 5–6 are the enforcement layer and must be sequenced last.

## 7. Risks & Guardrails

- **Micro-compaction breaks prompt-cache prefix every turn** (Hermes admits this) → off by default; economics
  surfaced by P4b so users see the actual tradeoff, not a promise.
- **Anti-thrash regressions** → the Hermes lesson is encoded as the *test contract*: effectiveness scored only
  against real post-response counts; the exact two defects (mixed-basis scoring, message-shrinkage yardstick)
  get regression tests.
- **Summary injection attacks** → custom compaction instructions are bounded (≤800 chars) and wrapped as untrusted
  prompt data (OpenClaw `wrapUntrustedPromptDataBlock` pattern).
- **YAGNI ladder over-reduction** → rungs 1–6 are gated by Law 6 (type safety) and Law 14 (error paths)
  exemptions; the Adversary is the explicit over-penalty guard.
- **Identifier loss across compaction** → `## Exact identifiers` section + preserved-state JSON block + language/
  identifier literal rules, audited in P4c PostCompact metrics (compression ratio must not exceed a sane bound
  for identifier-heavy sessions).
- **Scope creep into other harnesses** — we adopt *ideas*, not code; every port is a clean-room reimplementation
  sized to Savant's Message/AgentState types.

## 8. Success Metrics

- **Context stability:** sessions run 3× longer before hard overflow; zero re-compaction loops (tested).
- **Fidelity:** post-compaction task continuation succeeds on a long-conversation fixture with the preserved
  state block present vs. absent (A/B).
- **Economics:** cache-hit ratio stays above baseline between compactions (P4b); median tokens/query down without
  fidelity loss.
- **Minimalism:** Forge gate reduces unrequested abstractions (measured in reviews); `dev/YAGNI-LEDGER.md`
  accumulates and gets consumed.
- **UX:** no user-visible stall during micro-compaction sessions; context meter always visible.

## 9. References

- `docs/research/Savant Code Token Optimization Plan.md` — the originating research doc
- `resources/hermes-agent/` — micro-compaction, user-message fidelity, anti-thrash, idle compaction
- `resources/openclaw/` — safeguard mode, required sections, exact identifiers, file-op carry-over, active memory
- `resources/zero/` — preserved structured state, pure-function compaction
- `resources/DeepSeek-Reasonix-main-v2/` — cache economics, fixed tail budget, summary tags
- `resources/axon/` — PostCompact hooks
- `resources/goose/`, `resources/continue/`, `resources/gemini-cli/`, `resources/cline/` — supporting patterns
