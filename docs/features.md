<!-- markdownlint-disable MD013 -->

# Features

**Everything you need for AI-assisted coding with structural quality guarantees.**

---

## Multi-Agent Orchestration

Ten canonical agents coordinate through ECHO with explicit separation of duties. Child agents receive only their authorized tool subset through strict allowlist filtering. Parallel agent work supports exploration, research, implementation, and independent review.

---

## ECHO Perfection Loop

Complex changes follow a formal FID Finite State Machine. Routine work uses
Hybrid Mode; the core ECHO laws and applicable verification gates still apply.

1. **RED** — Identify ALL failures and issues with evidence
2. **GREEN** — Implement minimal, surgical changes
3. **AUDIT** — Independent verification by a separate agent
4. **ADVERSARIAL** — Read-only Adversary refutes Verifier findings, re-audits
   unevidenced PASSes, and resolves citations — its verdicts override
5. **SELF-CORRECT** — Fix any blockers found during audit
6. **COMPLETE** — Document results, archive tracking

Complex work is implemented only after its FID converges. Audits require evidence.

---

## Tool Permission Boundaries

Each agent gets exactly the tools it needs via strict allowlist filtering. Detective gets read-only access. Forge gets write access. Thinker gets sequential thinking. No agent has more power than its role allows.

---

## Context Compaction

Four-layer progressive auto-compaction keeps large repositories within model limits. A live in-stream signal (`⚙ Compacting context…` → `✓ Compaction complete (−N tokens)`) and a window-consistent sidebar `Compaction` row give real-time feedback. The display denominator, warning threshold, and pruner trigger all resolve from one model context window (no silent fallback), and the pruner spawn is driven by a single authority — the same `shouldAutoCompact` verdict that fires the warning — so auto-compaction can never silently fail to trigger while the context climbs past the window. `/compact` forces a compact-and-stop pass on demand (force-spawns the context pruner, bypassing cooldown, then ends the turn — no model summary pass). Sessions can run through massive codebases without hitting context limits.

---

## Durable Budgeted Goal Mode

`/goal <objective> [--budget tokens=N turns=N time=MS]` starts a durable,
budgeted goal run backed by an event-sourced goal state machine
(`active | paused | blocked | complete`). A runtime continuation driver runs
goal turns until the model verifies completion via the `update_goal` tool,
blocks on a genuine impasse, or a budget is exhausted. Goal text is injected as
`<untrusted_objective>` so it is treated as data, never instructions.
`/goal status|pause|resume|cancel` manage the record and the sidebar shows live
goal + budget consumption.

---

## Auto Drive

`/auto-drive "<goal>"` (aliases `/auto`, `/drive`, `/autodrive`) turns a
one-sentence goal into an approved, fully-specified plan and then runs it to
completion autonomously — clarify → pre-build plan → one-time operator
confirmation (Law 2) → autonomous execution. See the
[FAQ](faq.md) for operator guidance and the `/goal` vs `/auto-drive`
distinction. The linked [architecture proposal](design/Auto Drive Architecture Blueprint.md)
is historical and is not the implementation contract.

- **Clarity** — if the goal is already a detailed spec it skips straight to
  planning; otherwise it drives the interview ceremony (context gathering +
  ≥3 rounds of `ask_user` + a spec file).
- **Pre-build plan** — a Thinker pass converts the spec into a master-FID
  draft (scope, module breakdown, dependency order, acceptance criteria,
  resolution policy) presented as one `ask_user` confirmation: Confirm /
  Revise / Cancel.
- **Drive lock** — Confirm is the single Law 2 approval: a `<drive-lock>`
  directive records the durable drive and strips `ask_user` /
  `suggest_followups` / `end_turn` for the rest of the run.
- **Autonomous execution** — the plan decomposes into a FID backlog executed
  in dependency order, with phase-completion validation, a self-healing
  ladder for genuine impasses, and a completion certification.
- **Controls** — `/auto-drive status | pause | resume | stop`; Esc pauses
  (first press) and stops (second press); the sidebar shows a live drive
  panel (goal, active FID, phase, open count, Run Log count).
- **Headless** — `savant-code --auto "<goal>" [--spec <path>] [--plan-file
<path>] [--approve] [--plan-only] [--continue]` runs the full cycle without
  the TUI; exit code `0` only when zero FIDs remain open.

---

## Extensible Hook System

A project-scoped `hooks:` block in `protocol.config.yaml` registers external
commands (or internal callbacks) against the tool-executor lifecycle —
`PreToolUse`/`PostToolUse`/`PostToolUseFailure` plus `SessionStart`/
`SessionEnd` and `SubagentStart`/`SubagentStop`. Hooks compose with the EHEL
gate (an additional gate, never a bypass) and fail open: only an explicit
`deny` decision or exit code 2 blocks a tool; a missing binary, timeout, or
malformed output allows execution.

---

## Checkpoint and Rewind

Each user turn can persist the pre-edit content of every first-touched file, including subagent writes. `/rewind` supports:

- **Code only** — restore files while keeping the conversation
- **Conversation only** — restore the transcript boundary without changing files
- **Both** — restore code and conversation together
- **Fork** — restore the selected turn into a fresh chat

Retention is bounded to the most recent 20 turns. No Git repository is required.

---

## Fail-Closed Streaming

Incomplete or malformed tool calls are rejected, not coerced. Stale-fragment replacement for placeholder arguments. Tool errors, cancellation, retry, and child-agent failures are surfaced rather than silently treated as success.

## Turn Termination Safety

Turns can never silently run away to the 200-step cap:

- **Anti-runaway guards** — repetition-shaped non-progress patterns trip an
  early auto-end with a visible notice: repeated identical tool calls (×4),
  consecutive tool-error retries (×5), or think-only continuation loops (×3).
- **Post-terminal breaker** — steps that begin after a step already satisfied
  its end-of-turn condition, with no genuine operator input in between, auto-
  end after 6 such continuations (`Turn auto-ended: no operator input…`).
- **Auto Drive / goal-engine carve-out** — autonomous continuation is real
  product behavior: the breaker and the enforcement surrender are bypassed
  entirely while a drive (`/auto-drive`) or active goal (`/goal`) run is  in progress, so the feature is never killed by the safety net.

---

## Self-Improving Harness & Agent-Created Skills

Savant learns from its own usage and authors its own skills under strict
operator governance (FID-2026-0824-012). Full guide:
[docs/self-improving-harness.md](self-improving-harness.md).

- **Mechanical capture** — a `PostToolUseFailure` hook with the builtin
  `experience-capture` action appends one immutable record per failure to
  `dev/experiences/raw-traces.jsonl` (in-process, fail-open, context-hashed
  inputs, path-normalized keys). No prompt compliance required.
- **Dedup + recurrence** — `sha256(tool+error)` grouping with a persistent
  cross-session counter: promotion needs **≥3 occurrences within a rolling
  14-day window**; expected-failure noise never counts.
- **Versioned agent-created skills** — the `skill_manage` tool
  (Scribe + Orchestrator only) authors skills into `.agents/skills/.quarantine/`
  with on-disk versioning (snapshots + `VERSIONS.jsonl`, semver rules,
  10% patch cap). Nothing an agent writes is loadable until an operator runs
  `/skills trust`; `/skills list|show|trust|untrust|rollback` is the full
  operator boundary; `immutable: true` skills reject every mutation.
- **Proactive evolution** — SessionEnd mechanical review refreshes
  `dev/agenda.md` (≤50 lines); the Scribe's full-fidelity review routes
  recurrences to FIDs and drafts eligible lessons into quarantine skills;
  `learnings:retire` is move-only; `skills:evolve` emits proposals without
  ever mutating.

## Crash Recovery & Resilience

A single error degrades instead of killing the session (FID-2026-0815-015):

- **Error boundary** — a real class-based React boundary wraps the app root and
  the agent-message subtree, so a render error falls back to a fallback panel
  instead of tearing down the terminal.
- **Guarded idle heartbeat** — the idle-activity timer is `try/catch`-guarded
  and cleared on run cancel/finalize, so a deferred write to a frozen
  `agentState` can never throw from a `setTimeout` callback.
- **Cyclic-safe persistence** — chat-state saves omit ephemeral fields
  (timer handles, `provenance`) so `JSON.stringify` can't throw on a cycle and
  drop the save.
- **Non-fatal background async** — unhandled promise rejections log-and-continue
  (the engine default) instead of `process.exit(1)`, so a background analytics,
  ad, or clipboard failure can't take the TUI down.
- **Visible fatal errors** — a genuine crash is written to stderr after the
  terminal reset, so it is never a bare `script dev exited 1`;
  `uncaughtException` remains fatal only as the last resort.

---

## Provider Flexibility

The [provider/model reference](providers.md) explains live catalogs, exact
model IDs, protocol routing, and the model-information block supplied to
agents. `/model` supports keyboard, wheel, scrollbar, and filter navigation
with one terminal line per model/header row; clipped text retains its full ID.

Works with multiple inference providers:

- **Ollama** — Local-first, free, no API key required
- **OpenRouter** — Multi-provider gateway (**default boot provider**; the free
  tier `openrouter/free` is the boot default, and any `openrouter/` model slug
  routes to `https://openrouter.ai/api/v1` with the resolved key)
- **TokenHarbor** — OpenAI-compatible hosted gateway at `https://tokenharbor.ai/v1`
- **TokenRouter** — Multi-provider gateway
- **OrcaRouter** — Multi-provider gateway with a live model catalog (`ORCAROUTER_API_KEY`; the free tier is currently gated vendor-side on GitHub account linkage)
- **B.AI** — OpenAI-compatible gateway with an authenticated live model catalog (`BAI_API_KEY`)
- **HCNSec** — OpenAI-compatible gateway on an audited static 7-model allowlist (`HCNSEC_API_KEY`)
- **TokenBom** — OpenAI-compatible gateway on an audited static 7-model allowlist (`TOKENBOM_API_KEY`)
- **Atria AI** — OpenAI-compatible hosted gateway on an audited static one-model allowlist (`ATRIA_API_KEY`; `Atria-Dawn-Preview`, 256K context)
- **Intern InkStone** — OpenAI-compatible hosted gateway on a static 10-model allowlist (`INTERN_API_KEY`; Shanghai AI Laboratory's 书生·端砚 at `https://discovery-api.intern-ai.org.cn/v1`, the China-hosted twin of Atria AI — context windows pinned from the authenticated live probe 2026-10-04)
- **Infron** — OpenAI-compatible inference-routing platform on a curated static 9-model allowlist (`INFRON_API_KEY`; inference at `llm.onerouter.pro/v1` per vendor docs)
- **UnoRouter** — OpenAI-compatible gateway on a curated static 17-model allowlist (`UNOROUTER_API_KEY`; `:free` slugs never bill per vendor docs)
- **BazaarLink** — OpenAI-compatible gateway on a static 12-model allowlist (`BAZAARLINK_API_KEY`; the identity-audited genuine free channel `qwen/qwen3.7-flash:free` @ 1M ctx + 11 curated paid flagships per the 2026-09-15 top-coding ranking — substituted free channels excluded by ruling)
- **KiosAPI** — OpenAI-compatible gateway with an authenticated live model catalog (`KIOSAPI_API_KEY`)
- **APInex** — Hosted gateway with an authenticated live model catalog (`APINEX_API_KEY`)
- **Vercel AI Gateway** — Managed multi-provider gateway with a keyless live model catalog (`AI_GATEWAY_API_KEY`; OpenAI Chat Completions at `https://ai-gateway.vercel.sh/v1`)
- **Clean APIs** — OpenAI-compatible hosted gateway with an authenticated live model catalog (`CLEANAPIS_API_KEY`; OpenAI Chat Completions at `https://cleanapis.com/v1`)
- **CodeCraft API** — Authenticated live model catalog and OpenAI chat (`CODECRAFT_API_KEY`; `https://codecraftapi.com/v1`)
- **Mistral AI** — Authenticated live model catalog and OpenAI chat (`MISTRAL_API_KEY`; `https://api.mistral.ai/v1`)
- **Apixo** — Keyless live model catalog and [OI] chat (`APIXOAI_API_KEY`; `https://api.apixoai.online/v1`; the vendor publishes a context window on every catalog row)
- **AIHubMix** — Keyless rich live model catalog and OpenAI chat (`AIHUBMIX_API_KEY`; `https://aihubmix.com/v1`; the catalog retains 698 LLM rows and publishes positive limits only on a subset)
- **xKiro** — Public live chat catalog (`XKIRO_API_KEY`; `https://api.xkiro.com/v1`). Anthropic model IDs use Messages; other IDs use OpenAI chat. Vendor namespaces remain intact. Catalog tiers describe requirements; paid-model access depends on the account.
- **ChatAnywhere** — OpenAI-compatible hosted gateway on a static 27-model chat roster (`CHATANYWHERE_API_KEY`; `https://api.chatanywhere.tech/v1`; free-key tier: 10,000 points/day per the vendor's GPT_API_free docs)
- **Tiarina Cloud** — OpenAI-compatible hosted gateway on a static 19-model chat roster (`TIARINA_API_KEY`; `https://ai.tiarina.cloud/v1`; free-key tier)
- **Alibaba Cloud** — OpenAI-compatible hosted gateway with a static measured catalog (`DASHSCOPE_API_KEY`)
- **Anthropic** — Anthropic Messages gateway with a static measured catalog (`ANTHROPIC_API_KEY`)
- **Baseten** — OpenAI-compatible hosted gateway with a static measured catalog (`BASETEN_API_KEY`)
- **Cerebras** — OpenAI-compatible hosted gateway with a static measured catalog (`CEREBRAS_API_KEY`)
- **Cohere** — OpenAI-compatible hosted gateway with a static measured catalog (`COHERE_API_KEY`)
- **DeepInfra** — OpenAI-compatible public live model catalog with fallback windows (`DEEPINFRA_API_KEY`)
- **DeepSeek** — OpenAI-compatible hosted gateway with a static measured catalog (`DEEPSEEK_API_KEY`)
- **Fireworks AI** — OpenAI-compatible hosted gateway with a static measured catalog (`FIREWORKS_API_KEY`)
- **Google AI** — OpenAI-compatible hosted gateway with a static measured catalog (`GEMINI_API_KEY`)
- **Groq** — OpenAI-compatible hosted gateway with a static measured catalog (`GROQ_API_KEY`)
- **Meta Llama API** — OpenAI-compatible hosted gateway with a static measured catalog (`META_MODEL_API_KEY`)
- **MiniMax** — Anthropic-compatible hosted gateway with a static measured catalog (`MINIMAX_API_KEY`)
- **Moonshot AI** — OpenAI-compatible hosted gateway with a static measured catalog (`MOONSHOT_API_KEY`)
- **Perplexity** — OpenAI-compatible hosted gateway with a static measured catalog (`PERPLEXITY_API_KEY`)
- **Together AI** — OpenAI-compatible hosted gateway with a static measured catalog (`TOGETHER_API_KEY`)
- **Venice AI** — OpenAI-compatible public live model catalog with runtime windows (`VENICE_API_KEY`)
- **xAI** — OpenAI-compatible hosted gateway with a static measured catalog (`XAI_API_KEY`)
- **Z.AI** — OpenAI-compatible hosted gateway with a static measured catalog (`ZHIPU_API_KEY`)
- **OpenAI** — Platform API keys via `/provider openai` or `OPENAI_API_KEY`; Responses API at `https://api.openai.com/v1`, with an authenticated live catalog
- **NVIDIA NIM** — NVIDIA-hosted inference
- **CommandCode** — OpenAI-compatible hosted inference
- **Nous Research** — OpenAI-compatible direct inference via `NOUS_API_KEY`; Portal OAuth is a separate integration
- **Cloudflare** — Workers AI; `/provider cloudflare` prompts for both
  `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- **Custom providers** — Define your own OpenAI-compatible providers with
  `/provider add` (guided wizard: id, label, base URL, wire protocol,
  key env var, inline model list, API key). Customs live in the same
  picker, support `/provider edit`/`test`/`remove`, and are stored in
  `settings.json` with keys in the local credentials file
- **Custom endpoint** — Any OpenAI-compatible API via `INFERENCE_BASE_URL`,
  authorized by `INFERENCE_API_KEY` alone — the active provider's key chain is
  never sent to a custom endpoint (a missing key fails fast naming the variable)

Gateway model context lengths can be resolved from the live catalog. In
BYOK/direct mode (`DIRECT_PROVIDER` or `INFERENCE_BASE_URL` set) every backend
call is short-circuited — inference routes straight to the configured endpoint
(FID-2026-0806-009/010). A custom `INFERENCE_BASE_URL` endpoint is authorized
by `INFERENCE_API_KEY` alone; the active provider's key chain is never sent
to it.

---

## Free AI Options Discovery

Savant is BYOK — you wire your own keys, so "free" means the free tiers and
`:free` models of the gateways themselves. A discovery pipeline tracks which
tiers are free right now and surfaces it three ways (FID-2026-0928-011/012,
FID-2026-1001-002):

- **`/provider free`** — live-fetches the keyless free-models catalog (24h
  cache, soft-degrading), then splits the result by YOUR wiring: free models
  available on providers you already keyed, free tiers you have NOT wired
  (each with the exact `/provider <name>` command), and keyless local lanes
  (Ollama). Writes `free-options.md` in your config directory so you and the
  agent read one truth — ask "what free options do I have?" and it reads it.
- **First-launch notice** — a one-time pre-TUI line points you at
  `/provider free`, then retires (persisted flag).
- **Boot summary** — on an empty chat, once per content-set, a system message
  announces your wired/not-wired free-lane counts from the local cache, so
  never typing the command is never the only way to find out. The catalog
  refresh is a fail-silent background task; boot never blocks on the network.

The first-launch notice reaches every Savant-Code invocation (interactive,
`--print`, `--auto`, piped, CI) because it is stderr-only and retires after
one show. The boot summary is interactive-TUI-only (it needs a chat to post
into), so headless runs get the notice and the `/provider free` command.

One model project-wide: the model selected in the UI panel is the only model
used — main chat agent, teacher-forge, headless runs, and spawned subagents all
resolve the operator's active model (never a hardcoded paid fallback). The paid
build resolves its boot model only from the `/model` selection (`openrouter/free`
when unset) and never reads the unreleased savant-free catalog or its persisted
preference, so a stale free-model preference cannot silently switch the operator
to a paid model (FID-2026-0814-010).

---

## Provider Notifications

Provider changes reach you instead of vanishing. A durable notification
service watches your provider routes and live catalogs and records notices
with severity and timestamps (FID-2026-1003-006):

- **Semantic deltas** — models added to, removed from, or changed on the
  providers you have wired
- **Health and removal** — dated provider health/removal notices, with the
  eligible `:free` fallback hints when a 429 makes them relevant
- **Quota and offers** — capability-based quota windows and dated offer
  expiry from the custats feeds

Notices surface as toasts — a retained warning for route-severity items and
a grouped info toast for the rest — and `/notifications` opens the provider
inbox to read and dismiss them. The desktop shell receives the
same notices over the gateway when it advertises the `provider_notices_v1`
capability in its hello.

---

## Headless / Non-Interactive Mode

`--print` runs a single prompt without the TUI and prints the final answer to
stdout (FID-2026-0806-011):

- `savant-code --print "refactor the error handling"` — run one prompt
- Exit codes: `0` success, `1` error or timeout, `2` usage error
- When stdin is piped or the environment is CI, the CLI auto-enters headless
  mode and uses stdin as the prompt
- `SAVANT_CODE_RUN_TIMEOUT_MS` (default 10 minutes) bounds hung runs; the
  headless client never blocks on interactive `ask_user`
- Output is ANSI-stripped when piped, so results stay script-friendly
- `--print ... --json` — the NDJSON delegation transport: stdout carries
  frames (progress, exactly one artifact, errors) and parent control frames
  (`cancel`/`steer`) are read on stdin at step boundaries — cooperative
  cancel, parked steering, unknown frames ignored (FID-2026-0907-003..006)

---

## Consent-Gated Auto-Update

The launcher never stops a running session (FID-2026-0806-014):

- A newer version is staged and a pending-update marker is written
- The update is applied on the **next launch** after an interactive y/N prompt
- Non-TTY launches defer the prompt
- `SAVANT_CODE_NO_AUTO_UPDATE=1` opts out entirely

---

## Research — web search, scholarly literature, and docs

The Researcher role is backed by a swappable search/docs adapter, so research
works in **every** provider mode — including direct-provider mode (no SavantCode
backend required). Research no longer depends on `DIRECT_PROVIDER`.

`researcher-web` also connects to the public Scholars Reading List MCP service
for semantic/keyword paper search, DOI/OpenAlex/PMCID record lookup, similar-paper
search, and shared-reference citation traversal. The four read-only tools require
no API key. Literature answers use fetched paper records and state abstract-only
limits; full-text claims still require reading the full source. The public service
limits calls to 30 per minute per address; rate limits stop further literature
calls for that turn, and service failures fall back to web research.

### Keyless by default (zero keys, zero setup)

- **`web_search`** — a keyless multi-engine port (Qwant + DuckDuckGo, fired in
  parallel, deduped by URL) returns Serper-compatible results. Works out of the
  box with no API key.
- **`read_docs`** — keyless search-and-fetch locates official docs pages and
  returns the discovered hits (title + link + snippet); full-page extraction is
  left to the SSRF-guarded `read_url` tool.
- **`read_docs` indexed docsets** — a self-populating local SQLite FTS5 cache at
  `~/.savant-code/docsets/<slug>.sqlite`. On a miss, `read_docs` re-discovers
  docs keylessly and merges them into the cache; a 7-day TTL re-searches before
  answering so the agent never silently serves stale docs.
- **Keyless version detection** — the search query is pinned to the current
  release via free registries (npm / PyPI / crates.io / RubyGems /
  proxy.golang.org). An ambiguous name that resolves in multiple ecosystems is
  surfaced for disambiguation rather than silently pinned, and the agent can pin
  explicitly with `read_docs({ libraryTitle, ecosystem: "go" })`.
- **`deep_research`** — unchanged mechanically; its injected `SearchFn` now
  points at the adapter, so it inherits every source below automatically.

### Bring-Your-Own-Key (optional)

Set any of these to promote a paid source to primary (keyless stays the
fallback). Enter them via `/research-keys <service>` (masked, saved to
`credentials.json`) or as shell environment variables (shell wins):

| Service                 | Command                    | Environment variable |
| ----------------------- | -------------------------- | -------------------- |
| Serper (web search)     | `/research-keys serper`    | `SERPER_API_KEY`     |
| Context7 (indexed docs) | `/research-keys context7`  | `CONTEXT7_API_KEY`   |
| Parallel (web search)   | `/research-keys parallel`  | `PARALLEL_API_KEY`   |
| Tavily (web search)     | `/research-keys tavily`    | `TAVILY_API_KEY`     |
| Exa (web search)        | `/research-keys exa`       | `EXA_API_KEY`        |
| Firecrawl (web search)  | `/research-keys firecrawl` | `FIRECRAWL_API_KEY`  |

Every source normalizes to one Serper-compatible `organic[]` shape, so
`deep_research` (URL dedup, domain scoring, source budgets) works identically
across all of them. A configured key never hard-fails the search — the adapter
degrades to the next source and ultimately to keyless.

---

## GitHub Integration

A read-only GitHub helper connects to the official MCP server for:

- PR/issue/CI review
- Code search
- Secret scanning
- Audit trail

Requires `SAVANT_CODE_GITHUB_TOKEN` environment variable.

---

## Database Helper

Four native tools with adapter-enforced safety:

- `list_tables` — List all tables in the database
- `describe_table` — Get schema information
- `execute_query` — Run SQL queries (read-only by default)
- `analyze_query` — Get query execution plans

**Safety contract:**

- Read-only by default
- LIMIT injection for queries without LIMIT
- SQL redaction for telemetry
- Destructive DDL blocking

---

## Browser Automation

Supports:

- Viewport presets (mobile/tablet/desktop)
- Offline WCAG accessibility scan
- Optional session persistence

---

## HTML Export

`/export` writes a fully self-contained branded HTML report of the conversation:

- Offline fonts (no network required)
- Collapsible tool rows
- Per-message and copy-all buttons
- Branded with Savant Code identity

---

## Knowledge Graph

A deterministic, incremental, SQLite-backed codebase knowledge graph:

- **In-process indexing** — no daemon. Built on `packages/code-map` (tree-sitter)
  with sha256 hash-compare so unchanged files are skipped.
- **Structural metadata only** — paths, symbols, edge types, hashes. No file
  contents, so no secrets can leak.
- **Three edge types** — `IMPORTS`, `CALLS`, and `EXTENDS` with deterministic
  weights.
- **Deterministic domain clustering** — graphology Louvain with seeded RNG, so
  cluster ids are reproducible across runs.
- **Incremental updates** — `/graph refresh` re-indexes changed files only;
  `--full` forces a complete rebuild.
- **Agent-accessible** — Detective and Scout can query `query_blast_radius`,
  `query_node_edges`, and `query_domain_clusters`; the Verifier's Law 4
  reachability check is harness-computed and injected into its message history
  (its zero-tool contract is unchanged).
- **Graph export** — `/graph-export` serializes the graph into a self-contained,
  branded HTML file (the Code Universe) rendered on an interactive
  Sigma.js/Graphology WebGL canvas with a precomputed ranked search index,
  cluster color-coding, and a full document viewer. Fully offline.
  Documents are unlimited by default (gzip+base64 embedded payload,
  decompressed lazily off the critical path).

---

## Token Optimization & YAGNI

Structural cost controls layered onto the ECHO runtime (FID-2026-0806-003):

- **Four-layer context compaction** — per-role token budgets, verbatim recent
  tail pinning, tool-result snip pre-pass with byte/line caps, and
  `<compaction-summary>`/`<structured_state>` tags that preserve exact
  identifiers and decisions instead of collapsing them into prose.
- **LLM-semantic summaries (FID-2026-0914-002)** — the deterministic
  transcription is upgraded into a first-person handoff by the session model
  at the spawn boundary (settled-vs-open decisions, exact commands/paths,
  named unknowns, forward plan; validated, redacted, deterministic fallback
  on any failure). The deterministic writer stays as the guardrail:
  streamed fragments and repeated user messages coalesce, compaction
  placeholders are never re-digested, and preserved-state paths are
  repo-relative and recency-capped.
- **Amortization** — optional per-turn fold mode (one oldest exchange folded
  per step), idle-compaction and force-ratio triggers, and anti-thrash scoring.
- **Token telemetry** — per-agent prompt/completion/cached token events, a
  cache-hit monitor, and a live context meter in the CLI sidebar (green/amber/
  red thresholds).
- **YAGNI ladder** — the Forge must clear a six-rung decision ladder (need →
  codebase reuse → stdlib → platform → installed dependency → one-liner) and
  emit a `yagni_check` before writing code; deliberate shortcuts are tagged
  `ponytail:` and harvested into `dev/YAGNI-LEDGER.md`.
- **Opt-in Caveman mode** — telegraphic output rules for Orchestrator /
  Detective / Scribe with Auto-Clarity byte-exact bypasses for code, security
  warnings, and error paths.

Tunable via `compression` / `yagni` / `caveman` / `telemetry` sections in
`protocol.config.yaml`.

---

## Contributor System

`/contribute [github-username]` adds you to the repo's `CONTRIBUTORS.md` and
opens a PR via the `gh` CLI (FID-2026-0806-004):

- No-arg form reads `git config user.name`
- Duplicate-safe append (the table is created with a header when missing)
- Runs git branch → commit → push → `gh pr create`, committing only
  `CONTRIBUTORS.md` and returning to your original branch
- Git/gh calls use argv-array execution (no shell interpolation) with
  Law-14 error wrapping — a failed PR step keeps the local append and prints
  recovery hints
- Ships in the Savant-Code build

---

## Savant Desktop (Tauri v2)

The desktop workspace (`desktop/`) wraps the same engine in a native shell —
see [`desktop/README.md`](../desktop/README.md) for build/run commands:

- **Rust supervisor + sidecar** — the Tauri shell owns a Bun-compiled
  agent-runtime sidecar (spawn/backoff/shutdown/watchdog), with WebView2
  detection + native recovery on Windows.
- **Structured chat surface** — bounded transcript virtualization, markdown
  blocks with per-message copy, traffic-light status panels, phase stepper,
  composer with auto-grow, and the Auto Drive dashboard with Emergency Halt.
- **Command deck (3D)** — an R3F neon-noir agent office where the 10-agent
  robot cast mirrors live chat activity: walk-to-station on tool calls,
  activity beacons, speech bubbles, ambient life (day/night, breaks,
  obstacle-aware routing), and a mini-chat island in the corner.
- **Project FIDs rail** — the repo's FID queue over the gateway, seeded by a
  hello-time inventory push and updated by the file watcher.

---

## Discord Rich Presence

`/presence status | enable | disable` (alias `/discord`) — **enabled by
default** — externalizes your coding activity to Discord Rich Presence: the
active agent (large image), the project basename + model (`details` line), and
the live Perfection Loop phase / activity (`state` line, real-time). The
execution mode (HYBRID/STRICT/SCAFFOLD/ANALYZE) is a hover detail on the mode
overlay's tooltip; the model label is provider-trimmed
(`deepseek/deepseek-v4-pro` → `deepseek-v4-pro`,
`nous/meituan/longcat-2.0:free` → `longcat-2.0`) and the `openrouter/free`
boot default renders as "OpenRouter Free". The model and the mode are
distinct axes — never conflated. See the
[Discord Presence blueprint](design/Discord Presence For Savant-Code.md)
for the full design.

- **Zero-config, on by default** — presence is booted from persisted settings
  (default: enabled) and targets the hardcoded Savant Discord application (the
  client id is compiled in, never operator-mutable — a configurable id is a
  feature-theft vector); `/presence enable` connects, `/presence disable`
  clears the activity and closes the socket.
- **Mechanical privacy** — only the project basename is broadcast (parents
  discarded); tool arguments are dropped absolutely; the FID kebab title is
  stripped (it may name a vulnerability); search queries are masked; a Zod
  schema fails closed to a hardcoded safe payload on any leak.
- **Dormant polling** — if Discord isn't running the client stays dormant and
  retries; a mid-session drop degrades silently without interrupting the
  agent loop.

---

## Slash Commands

| Command                                         | Purpose                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/help`                                         | Show command help and tips                                                            |
| `/new`                                          | Start a fresh conversation                                                            |
| `/history`                                      | Browse and resume previous sessions                                                   |
| `/copy`                                         | Copy the complete conversation to the clipboard                                       |
| `/export`                                       | Write a self-contained branded HTML report                                            |
| `/graph refresh`                                | Re-index the code knowledge graph and show summary stats                              |
| `/graph-export`                                 | Write a branded, interactive HTML report of the code knowledge graph                  |
| `/attest`                                       | Export and verify the current project's signed ZTAP trust receipt                     |
| `/interview`                                    | Create a structured specification                                                     |
| `/learn`                                        | Practice directing and reviewing an AI coding agent through guided exercises          |
| `/plan`                                         | Create an implementation plan                                                         |
| `/review`                                       | Review code changes                                                                   |
| `/auto-drive` (`/auto`, `/drive`, `/autodrive`) | Start or manage an Auto Drive run — clarify, plan, approve, then run to completion    |
| `/compact`                                      | Force an immediate context compaction (compact-and-stop)                              |
| `/goal`                                         | Start or manage a durable, budgeted goal run                                          |
| `/loop`                                         | Schedule recurring checks                                                             |
| `/verify`                                       | Run typechecks                                                                        |
| `/permissions`                                  | View or set the tool permission mode                                                  |
| `/presence` (`/discord`)                        | Show or change Discord Rich Presence: `status`, `enable`, `disable`                   |
| `/rewind`                                       | Restore code and/or conversation from a prior turn                                    |
| `/health`                                       | Check provider, Ollama, model, and permission status                                  |
| `/mode`                                         | List the four modes and their contracts                                               |
| `/model`                                        | Select or switch the active model                                                     |
| `/provider`                                     | Configure a hosted provider key                                                       |
| `/provider free`                                | List free-model lanes you have (and haven't) wired                                      |
| `/notifications`                                | Open the provider notification inbox (route warnings, deltas, health/removal, quota/offers) |
| `/bash`                                         | Run a shell command                                                                   |
| `/image`                                        | Attach an image for multimodal models                                                 |
| `/init`                                         | Create starter agent types and knowledge.md                                           |
| `/logout` (`/signout`)                         | End the current session and sign out                                                  |
| `/contribute`                                   | Add yourself to CONTRIBUTORS.md and open a PR                                         |
| `/telemetry`                                    | Show or change remote analytics consent                                               |
| `/diagnostics`                                  | Show local CLI resource usage                                                         |
| `/ads:enable` / `/ads:disable`                  | Toggle contextual ads                                                                 |
| `/theme:toggle`                                 | Toggle between light and dark mode                                                    |
| `/design`                                       | List, select, create, edit, or reset the active design system                         |
| `/skills`                                       | List, show, trust, untrust, or roll back agent-authored skills (operator boundary)     |
| `/release`                                      | Run the public release flow: `/release preview \| diagnose \| go \| resume \| status` |
| `/feedback`                                     | Share general feedback about SavantCode                                               |
| `/publish`                                      | Publish an agent to the registry                                                      |
| `/connect`                                      | Connect a ChatGPT account (OAuth)                                                     |
| `/exit`                                         | Quit the CLI                                                                          |

**Availability:** Savant-Free and its `/end-session` command were retired on
2026-10-15. Savant-Code provides `/mode`, `/model`, `/provider`, `/publish`,
`/release`, `/image`, `/notifications`, and `/ads:enable` / `/ads:disable`,
subject to each command's backend requirements. Skill commands (`/skill:<name>`)
appear once a skill is loaded. Each mode has its own `/mode:<name>` command (see
[Execution Modes](savant-code-modes.md)).

---

## Design Systems

`/design` manages a lightweight, project-local **design system** — a typed token set that the
agent applies to any visual output it produces (markdown, HTML exports, terminal UI):

- **`/design current`** — show the active system; `use` switches to another
- **`/design create`** — author a new system through an interactive wizard (cancel-before-save
  and cancel-after-preview are both safe)
- **`/design edit`** — edit the active system with a built-in clone-before-edit and revision
  history
- **`/design import` / `validate` / `drafts` / `resume` / `discard`** — full draft lifecycle
- **`/design reset`** — restore defaults; `reset --all` clears custom systems

Built-in systems are immutable. Persistence is atomic: a failed commit leaves the prior valid
version active, and restart persistence preserves the active system across sessions.
A natural-language imperative grammar lets the agent apply design changes conversationally;
ordinary design _discussion_ never writes. The headless file/stdin schema routes through the
same service with bounded machine-readable errors. See
[`docs/design/design-system-library.md`](design/design-system-library.md) for the full spec.

---

## Release Workflow

`/release` drives the governed public-release pipeline (documented in
[Public Release Workflow](public-release.md)):

- **`/release preview`** — mutation-free plan: gate matrix, version/changelog sync, npm/sav
  artifact manifests, receipt simulation
- **`/release diagnose`** — run the deterministic release gates only
- **`/release go`** — execute the approved release (operator-gated, records a receipt)
- **`/release resume`** — continue a paused release from its receipt
- **`/release status`** — show the current release state

Release state is tracked via a temp-dir receipt; the pipeline is fail-closed (each step refuses
to continue if its prerequisite gate is not green) and produces a structured audit trail.

---

## Session-Init Grounding

Every session — interactive or headless, in every mode — starts with a **deterministic grounding
ritual**: the harness reads `ECHO.md`, `ARCHITECTURE.md`, `protocol.config.yaml`, `LEARNINGS.md`,
and the FID template **local-first**, falling back to a **full grounding set embedded in the
runtime** (generated from the repo, drift-checked at validation time) so npm-installed copies
boot with no scaffolding and no crash. A universal tool gate arms at session start and a
first-turn completion gate steers ungrounded text-only replies back on contract; both are
bounded (max 3 retries) and never seed the main agent with a pre-converged protocol state.

---

## Agent-Steering Teacher

`/learn` is a local-first mode for practicing how to direct and review an AI
coding agent. It drives a live exercise end to end: your steering constraint
goes to a read-only, tool-less `teacher-forge` agent, the produced solution runs
in a capability-sandboxed subprocess, behavior-first equivalence and
deterministic mutation-detection graders review it, and you submit a critique
of a seeded defect. Completed attempts are recorded as versioned competency
records with an honest ZTAP process-evidence receipt.

Commands: `/learn` (overview), `/learn start <steering>`,
`/learn critique "<statement>" [--location …] [--witness …] [--impact …]`,
`/learn progress`, `/learn cancel`, `/learn exit`.

See the [Agent-Steering Teacher overview](design/agent-steering-teacher-overview.md)
and [guide](design/agent-steering-teacher-guide.md).

## Zero-Trust Agentic Provenance

Every write is recorded as a per-role Ed25519-signed receipt at the native
write boundary, appended to an append-only hash-only session ledger. Configure
`provenance.mode` as `off`, `record` (default), or `enforce`. Receipts prove
recorded mechanical process and its integrity — **not** LLM independence.

- **Trust Matrix** — a read-only, event-sourced live panel that renders write
  and verdict receipts. `pending` reads as `awaiting audit`; at session close
  `finalize()` auto-resolves any open receipt to an honest `no_verdict`
  terminal ("no independent verdict — session closed") with a signed
  system-role annotation, so receipts never linger as a permanent broken
  `pending`.
- **`/attest`** (alias `/trust-receipt`) — exports the current project's
  signed trust receipt as authoritative JSON plus an offline HTML view, and
  re-verifies the receipt chain in an independent clean-process validator.

See the [Zero-Trust Agentic Provenance guide](design/zero-trust-agentic-provenance.md).

## Terminal UI

The TUI runs on OpenTUI 0.5.3 (exact-pinned; native Yoga since 0.4.1, so the
JS `yoga-layout` dependency is dropped). The 2026-08-16 UI overhaul rebuilt
it in phases: foundation, design tokens, animation engine, native component
evaluation, and responsive layout (see `docs/design/ui-overhaul-plan.md`).

- **Design tokens & visual identity** — themed colors, populated headers,
  sidebar hierarchy, status-bar duty split (`cli/src/chat/styles.ts` +
  `cli/src/types/theme-system.ts`).
- **Animation engine** — all visual motion runs on the OpenTUI timeline
  engine (zero `setInterval` in components): spinners, pulse, shimmer,
  cursor blink, sheen, smooth scroll, fold/collapse tweens, and a chunked
  (~16-char) streaming typewriter. A central animation-budget hook drops to
  15fps when the terminal window is blurred and suspends scissor-hidden
  animations.
- **Native code rendering (evaluated, custom retained)** — the native
  `<code>`/`<line-number>`/`<diff>`/`<image>` renderables verified in the
  test frame buffer but painted nothing in the production renderer, so the
  custom renderers remain the shipped path. `<ascii-font>` branding works and
  is used for the wordmark.
- **Diff viewer** — framed, professional diff block: bordered container,
  header strip (file path + `+N −M` counts), dual old/new line-number
  gutter, sign column, and highlighted hunk bars (`cli/src/components/tools/diff-viewer.tsx`).
- **Phase-transition notifications** — every ECHO phase change renders as a
  full-width **solid phase-color filled chip** with a `SAVANT CODE` title
  row, `Phase → GREEN` + reason, and luminance-inverted text (black on
  bright fills, white on the red fill) — the solid fill renders identically
  in truecolor terminals and ANSI-16 fallbacks like classic PowerShell
  conhost (`cli/src/components/tools/transition-phase.tsx`).
- **Reactive trust matrix** — the sidebar's Adversarial Trust Matrix is a
  collapsed, status-driven surface that appears **only while a receipt is
  still pending** (it unmounts entirely once everything resolves): live
  pending rows carry their tone color, verified/`no_verdict` receipts
  collapse into `✓ N resolved` / `N closed without verdict` counts, and the
  title carries no icon (`cli/src/components/savant-ui/echo/trust-matrix.tsx`).
- **Cyan hover chrome** — interactive chips and buttons (mode selector,
  build-mode buttons, load-previous, connect banner) highlight with a brand
  cyan stroke on hover instead of an off-white one.
- **Responsive layout** — the sidebar collapses to an icon rail below 60
  columns automatically, and can be folded/unfolded manually at any width
  with **Ctrl+B** (or the `»`/`«` edge handles), with the fold persisted for
  the session; model/provider/rewind pickers share a centered dialog chrome
  with animated entry/exit; toasts stack bottom-right with entry/exit
  animations; the `cwd:` line is folded into the input-bar border.
- **Easter egg** — the Savant wordmark hides an escalating click prank
  (nag popups → glitch → full-screen fake-terminal takeover → moral
  freeze). Purely visual and safe. See
  [Easter Eggs](design/easter-eggs.md).

## Learn More

- [ECHO Protocol](echo-protocol.md) — The governance system
- [Agent Roster](agents.md) — The 10 agents and their roles
- [Execution Modes](savant-code-modes.md) — HYBRID / STRICT / ANALYZE / SCAFFOLD / PLAN contracts
- [Design System Library](design/design-system-library.md) — The full `/design` specification
- [Agent-Steering Teacher](design/agent-steering-teacher-overview.md) — The complete `/learn` overview
- [Zero-Trust Agentic Provenance](design/zero-trust-agentic-provenance.md) — The `/attest` trust-receipt system
- [Hook System](design/hook-system.md) — The extensible lifecycle-hook configuration
- [Self-Improving Harness](self-improving-harness.md) — Mechanical capture, versioned agent-created skills, operator trust
- [Goal Mode](design/goal-mode.md) — The durable budgeted `/goal` workflow
- [Public Release Workflow](public-release.md) — The governed `/release` pipeline
- [Installation](installation.md) — Getting started
- [GitHub](https://github.com/savant0x/savant-code) — Source code
