# Deep review: Pi harness internals (`resources/pi-main`, `pi-ralph`, `pi-steering-hooks`) (T149)

**Date:** 2026-10-06 · **Scope:** T149 (operator request, verbatim: "now review pi")
**Nature:** Read-only reference review. No code written. Adopting any idea becomes its own
registered item.

This is the deep pass promised by T148's read limits: T148 reviewed pi at README/AGENTS level
(supply chain, git safety, ralph presets at feature level); this review reads the actual package
sources and design specs — the harness durability model, concurrency primitives, compaction,
the steering-hooks extension, and pi-ralph's orchestration internals.

## What was read (evidence base)

- `resources/pi-main/packages/agent/docs/`: `values.md` (full), `tool-durability.md` (full),
  `harness.md` Part 3 (operation state machine) + Part 9 (invariants, race catalog, test tiers),
  `plugins.md` (facets/services excerpt)
- `resources/pi-main/packages/coding-agent/docs/`: `session-format.md` (full), `compaction.md`
  (turns/cut-points/branch-summarization sections), `security.md` (full), `skills.md` (full),
  `containerization.md` (patterns table + Gondolin)
- Sources: `harness/session/mutation-line.ts`, `harness/session/fork-policy.ts`,
  `harness/execution/effect-gate.ts`, `harness/tools/file-mutation-queue.ts`,
  `harness/utils/adaptive-publisher.ts`, `harness/compaction/branch-summarization.ts`,
  `coding-agent/src/core/output-guard.ts`, `core/project-trust.ts`, `core/model-registry.ts`,
  `core/models-store.ts`, `evals/src/pi-harness.ts` (excerpt)
- `resources/pi-ralph/`: `index.ts` (full, 1,164 lines), `lib.ts` (full, 773 lines),
  `skills/ralph-loop/SKILL.md`, `presets/code-assist.yml`
- `resources/pi-steering-hooks/src/index.ts` (full, 238 lines)
- Census: 11 packages, ~177K lines of TS under `packages/*/src` (coding-agent 73K, ai 28K,
  agent 28K, tui 30K)

**Stated read limits:** `packages/tui`, `packages/ai`, `packages/protocol|client|server`,
the runtime `drive/restore` implementations, `lib.test.ts` in full, and the other 6 ralph
presets were not read line-by-line; `oh-my-pi-main` and `pi-steering-hooks` tests were not read.

## Ranked ideas for Savant-Code

### 1. Deterministic before-tool steering rules with audited override — HIGH

`pi-steering-hooks` converts behavioral rules into **before-tool hooks**: regex rules over
`bash`/`write`/`edit` inputs that block violations with 100% reliability and zero token cost
(`resources/pi-steering-hooks/src/index.ts:1-20`). Two details are the transferable part:

- **Audited escape hatch.** A blocked call can be retried with
  `# steering-override: <rule> — <reason>` in the command; the override passes but is logged to
  the session via `pi.appendEntry("steering-override", …)` (`src/index.ts:101,161,189`). Rules
  marked `noOverride: true` (e.g. `rm -rf /`) are hard-blocked.
- **`requires`/`unless` regex conjunctions** (`src/index.ts:26-33`) let a rule say "fire only if
  X, exempt when Y" — e.g. `aws` commands require `--profile` unless `AWS_PROFILE` is set.

Savant fit: our hook surface (`protocol.config.yaml` hooks) plus the existing convention "Do not
force-push `main`" (AGENTS.md) is currently prompt-enforced — exactly the drift this design
names ("Steering accuracy beats prompts"). A Savant `steering-rules` config + a before-tool hook
would make G4-class git rules and `.env` protection mechanical. This is a strict sharpening of
T148 #4 (git safety), not a duplicate: T148 proposed rules in prompts/docs; this is the
enforcement mechanism.

### 2. Race catalog + instrumented-storage writer conformance — HIGH

`harness.md` Part 9 is a testing artifact worth stealing wholesale:

- **Race catalog** (`harness.md:1358`): every durable mutation race is enumerated with exactly
  two durable histories and the required outcome of each order — 27 races, e.g. "`accept(A)` vs
  process loss before `drive(A)`", "checkpoint vs tool settlement". Rule: *test every listed
  order with test-only commit gating and controlled hooks/providers/tools/timers.*
- **Three test tiers** (`harness.md:1393`): Tier A state/drive (construct each of 13 durable
  states, close, reopen, drive, assert next transition — "invoking recovery twice from the
  initial prefix is **not** sufficient"), Tier B **writer conformance** (wrap `Storage.commit()`
  in a spy recording every transaction's writes in order; assert exact write order against the
  spec's transaction tables), Tier C deterministic interleavings of every race in both orders.
- The companion rule: "At every test-controlled committed lane boundary, compare the published
  state with a fresh restore result; divergence is an implementation defect, never silently
  healed by the next transition" (`harness.md` Tier A).

Savant fit: `packages/agent-runtime` has streams, retries, and tool batches with real
concurrency, but no race inventory and no write-order conformance tests. A FID that writes a
Savant race catalog (even 10 races) + a commit-spy test tier would convert "tests pass" into
"every interleaving is claimed and proven". This also gives the Adversary a concrete artifact to
refute.

### 3. Tool outcome durability: `outcome_ready` staging + invocation memos — HIGH (design study)

`tool-durability.md` solves a problem Savant will hit the moment parallel tool effects survive
crashes: parallel tools finish in completion order but transcript placement must be source
order, so without a durable intermediate state a crash reruns effects that already completed
(`tool-durability.md:21-31`). The design:

- Split **outcome durability** (completion order) from **entry materialization** (source order).
  A finalized result is committed immediately to `pi.pending.entry`; the call becomes
  `outcome_ready` and "must never execute again"; placement happens later when the source prefix
  is eligible (`tool-durability.md:31,195-200`).
- **Invocation memos** — durable, invocation-fenced key/value (`getMemo`/`setMemo`) deleted
  atomically with outcome staging — underwrite Flue-style `step.do`: "exactly-once recorded and
  at-least-once executed", with a crash table (`tool-durability.md` "Flue-style step.do").
- **Tool-selected bounded progress checkpoints** (`checkpoint: true` on updates) for reconnect
  diagnosis — explicitly "never proves completion" (invariant 8).

Savant fit: our session log is append-only and tool results are not currently crash-staged. This
is a *design study* — full adoption is a harness-scale FID — but the small immediate takeaway is
the vocabulary and the invariant list: never let a completed effect replay; stage before
placing; auxiliary progress never proves completion. Compare deepseek-harness's "model prose
does not prove the external effect" (T148 #1) — same epistemics, engineered into state
transitions.

### 4. The atomic transition rule + MutationLine serialization — MEDIUM-HIGH

One design sentence worth adopting as a Savant runtime rule:

> "Compute one complete next state in memory, then atomically commit every entry, usage row,
> value/list write, and projection change that makes it true." (`harness.md:664-666`)

Backed by two tiny primitives that are directly clonable (~100 lines total):

- `MutationLine` (`harness/session/mutation-line.ts:2`) — serializes complete read-modify-write
  jobs per Session via a promise-chain tail with `seal(error)` fail-closed semantics.
- `withFileMutationQueue` (`harness/tools/file-mutation-queue.ts:30`) — serializes file mutations
  per canonical path (WeakMap-keyed promise chains; canonical-path resolution with
  not-found/not-supported fallback). Two parallel edits to one file cannot interleave.

Savant fit: the file-mutation queue is a drop-in guard for parallel tool execution against one
file; the transition rule is a one-line discipline for any future durable agent state.

### 5. Compaction: split turns, `firstKeptEntryId` span semantics, cumulative file tracking — MEDIUM-HIGH

Pi's compaction answers questions our own compaction (when we grow one) must answer:

- **Never cut at tool results** — valid cut points are user/assistant/bash/custom messages only
  (`compaction.md` "Cut Point Rules"); a turn too big for the budget is "split": two summaries
  (history + turn prefix) merged (`compaction.md:83-99`).
- **Repeated compactions summarize from the previous kept boundary** (`firstKeptEntryId`), not
  from the previous compaction entry — messages that survived once get re-included, and
  `tokensBefore` is recalculated from the rebuilt context (`compaction.md:81`).
- **Cumulative file tracking**: summaries carry `details: { readFiles, modifiedFiles }` that
  accumulate across compactions and nested branch summaries (`compaction.md:181-187`,
  `branch-summarization.ts:87-112` merges prior `details` before extracting new ops) — the
  summary always knows the full read/modified set across the summarized span.

Savant fit: directly applicable when agent-runtime grows context compaction; the file-tracking
accumulation is also a cheap enrichment for our own session summaries.

### 6. Branch summarization on tree navigation — MEDIUM

When pi's `/tree` abandons a branch, it LLM-summarizes the abandoned path (old leaf → common
ancestor) and injects it into the new branch as a `branch_summary` entry (`compaction.md:150-215`,
`branch-summarization.ts:189-210`). The summary uses a **fixed structured format** (Goal /
Constraints & Preferences / Progress [Done, In Progress, Blocked] / Key Decisions / Next Steps)
that "preserves exact file paths, function names, and error messages", plus an appended
file-operations block. The prompt also supports `customInstructions` (append) and
`replaceInstructions` (full replace) — a two-mode extension seam.

Savant fit: sessions are linear today, but the structured-summary template is already the right
shape for our session summaries / Scribe reviews — a cheap prompt-template borrow independent of
any tree feature.

### 7. ralph orchestration internals: the guard rails T148 only named — MEDIUM

T148 #8 proposed "orchestration presets with guard rails" at feature level. The internals show
*which* guard rails, all directly reusable in Savant's multi-agent loop:

- **Stale-cycle detection** (`pi-ralph/lib.ts:395-425`): try cycle lengths 2…n/3 over the
  `hat:event` history; if the last **three** full cycles are identical → complete the loop.
  Three repeats avoids false positives on legitimate per-task cycles.
- **`max_activations` per hat** (`lib.ts:623-633`) — a per-role activation budget on top of the
  global `max_iterations`/`max_runtime_seconds`.
- **`single_task` injection** (`lib.ts:109-133`, `buildHatInjection` ~line 700): parse the
  scratchpad checklist and inject **only the next unchecked task** ("This is the ONLY task you
  may work on") so the model never sees (and never bulk-implements) the full list.
- **Static preset validation** (`validatePreset`, `lib.ts:171-260`): errors for unusable
  presets (no instructions/triggers/publishes, unreachable starting event); warnings for
  unconsumed events, no hat mentioning the completion promise, and **no loop-back path** in 3+
  hat presets. Broken configs are rejected before the loop ever starts.
- **Event protocol with fallback ladder** (`detectPublishedEvent`, `lib.ts:~380`): explicit XML
  `<event topic=…>` tags first, legacy `>>> EVENT:` second, content-keyword inference as an
  explicit "safety net, not a replacement", finally `default_publishes`. Unrecognized explicit
  events fall back rather than crash.

Savant fit: stale-cycle detection is the standout — our Perfection Loop / agent roster has no
equivalent loop-stuck detector. Single-task injection maps onto Scribe/Forge scratchpad
handoffs.

### 8. Pure-logic extraction with injected clock (pi-ralph `lib.ts`) — MEDIUM

pi-ralph deliberately split "pure logic extracted from index.ts for testability. No pi API
dependencies — just types, parsing, and event detection" (`lib.ts:1-5`): `determineNextAction`
takes a `LoopDecisionContext` including `now: number` ("injected for testability", `lib.ts:570`)
and returns a discriminated `LoopAction` — the entire orchestration decision is one pure
function with a 1,488-line test file covering it, preset validation, and injection building.

Savant fit: a standing convention for our orchestrator/agent-loop code — decision logic in pure
functions with injected time and explicit action unions, I/O shells thin. Cheap, immediate, and
matches our dependency-injection preference.

### 9. Project-trust gating with parent-path inheritance + extension veto — MEDIUM

`security.md` + `core/project-trust.ts`: pi loads project-local settings/extensions/skills only
after a trust decision, keyed by **canonical directory with closest-parent-wins** inheritance in
`trust.json`; `defaultProjectTrust: "ask"`; non-interactive modes fail closed (ignore
resources) unless overridden with `--approve`/`--no-approve` (`project-trust.ts:60-96`).
Extensions may handle a `project_trust` event and the **first extension returning a decision
owns it** (`security.md` "Project Trust"). The doc is also admirably honest: "A partial
in-process sandbox would be easy to misunderstand as a security boundary" — no sandbox is
offered; containerization patterns are documented instead (`security.md`, `containerization.md`).

Savant fit: Savant loads workspace skills/config from the project on open. A trust prompt with
parent-directory inheritance (and a saved decision file) closes the "cloned repo ships a
malicious `.agents/skills/`" hole. The honest threat-model doc style is also worth mirroring in
our security surface.

### 10. AdaptivePublisher — size-aware throttled state streaming — MEDIUM

`harness/utils/adaptive-publisher.ts:18`: publishes latest state without queuing intermediate
mutations — first dirty state after idle is immediate; each publication then *buys* a delay
proportional to its encoded size (`encodedBytes / targetBytesPerSecond`), floored at
`minIntervalMs`; one trailing timer guarantees eventual publication. Comment: "Commit before
delivery. A consumer may apply the update and then throw or reenter the producer; retaining the
old baseline would duplicate that delta."

Savant fit: our OpenTUI CLI streams tool output/agent events; a coalescing size-aware publisher
beats naive per-event rendering for long bash output. ~70 lines, self-contained.

### 11. Session tree format + custom entries outside LLM context — MEDIUM

`session-format.md`: entries form an **id/parentId tree** ("enabling in-place branching without
creating new files"), versioned 1→3 with auto-migration on load, and two entry classes that are
easy to conflate elsewhere: `custom` (extension state, **does not** participate in LLM context)
vs `custom_message` (extension-injected content that **does**), plus `label` entries (bookmarks),
`model_change`/`thinking_level_change` audit entries, and bash entries with
`excludeFromContext` (the `!!` prefix). Compaction entries carry `firstKeptEntryId` (required)
and `usage` so summarization cost lands in session totals (`session-format.md` "CompactionEntry").

Savant fit: our session log is flat; the custom-vs-custom-message split and the settings-audit
entries are borrowable now (Savant's session summaries + `dev/agenda.md` would benefit from
label/bookmark entries). Tree branching is only relevant if SDK consumers ask for it.

### 12. Eval harness with marker-based prompt isolation — LOW-MEDIUM

`evals/src/pi-harness.ts:52-58`: comparative evals strip the documentation block from the system
prompt **using stable prompt markers** rather than forking the production prompt builder, and
the comment pins the contract: "If that setup changes, this transform must be updated so
baseline and candidate still differ only by documentation." The harness also runs real
`AgentSession`s in temp agent dirs with snapshot artifacts.

Savant fit: our evals package runs prompts against models; when we A/B a prompt block (skills
text, system prompt section), marker-based extraction keeps the comparison honest — one
function plus a failing test that the markers exist.

### 13. Miscellanies noted, no action proposed

- `output-guard.ts` — stdout takeover with ENOBUFS/EAGAIN retry loop and a serialized raw-write
  tail; relevant only if Savant's TUI ever contends with subprocess output on the same fd.
- `model-registry.ts` naming: `ModelRegistry` is an explicit **synchronous compatibility facade
  over an async `ModelRuntime`** — a documented façade seam rather than leaking async into
  extensions. Similar shape to our provider registry aspirations (relevant when T147 resumes).
- `models-store.ts` — locked JSON store for refreshed provider catalogs with revision-based
  cache invalidation (avoids re-reading unchanged files; one shared read state). Relevant to
  provider-catalog caching (T62/T147 territory).
- `vitest.base.ts` — workspace source-path table used for import aliasing across test configs;
  the monorepo version of our per-workspace filter problem.
- `fork-policy.ts` — fork projection enumerates reserved namespaces and **throws on unknown
  reserved namespace** (`fork-policy.ts:62-64`) rather than silently copying; a nice
  fail-closed pattern for schema evolution.

## Overlap with T148 (do not re-do)

| This report | T148 relation |
|---|---|
| #1 steering hooks | Sharpening of T148 #4 (git safety) — enforcement mechanism, not the rules |
| #2 race catalog / test tiers | New (extends T148 #5 gate discipline into concurrency testing) |
| #3 tool outcome durability | New (deepseek T148 #1 shares the epistemics; this is the pi engineering) |
| #4-#5 atomic transition / compaction | New |
| #6 branch summaries | New (template partially new vs T148 #11's session-query) |
| #7 ralph guard rails | Deepens T148 #8 (presets) — new: stale-cycle detection, single_task, validatePreset |
| #8 pure-logic extraction | New |
| #9 project trust | New (T148 #4-adjacent: guards the workspace-skill surface) |
| #10-#13 | New; T148 #2 (supply chain) and #3 (session versioning) already covered pi's manifest/lockfile discipline and format migrations — not repeated here |

## Verification limits (honest)

- Read depth: the durability specs (`values.md`, `tool-durability.md`, `harness.md` Part 3/9)
  were read as *design documents*; the corresponding `runtime/drive`, `session/jsonl`, and
  `sqlite-node` implementations were not read line-by-line. Ideas #2–#4 cite spec text, not
  verified implementation behavior. pi's tests were not run (vendored tree, no install).
- Not reviewed in this pass: `packages/tui`, `packages/ai`, `packages/protocol|client|server`,
  `packages/agent/src/agent-loop.ts`, `lib.test.ts` (beyond its describe blocks),
  `pi-ralph/presets/*` beyond `code-assist.yml`, `pi-steering-hooks/src/index.test.ts`,
  `oh-my-pi-main`.
- Line counts are from `wc -l` on 2026-10-06 working tree.

Adopting any idea above is its own registered item; nothing here is scoped into T149.
