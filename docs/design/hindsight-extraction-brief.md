# Hindsight Extraction Brief — Savant Feature Additions

**Status:** Design brief (non-FID)
**Date:** 2026-10-07
**Scope:** Features Savant should add, sourced from reviewing the Vectorize Hindsight repo at `resources/hindsight-main`
**Framing (operator directive):** "we're adding features to savant, not hindsight. Focus on savant"

---

## 1. Purpose

This brief converts a full review of Vectorize Hindsight (an agent memory system)
into a **prioritised backlog of features for Savant**. Hindsight is the source of
the *ideas*; every item below is a Savant feature, with its own landing point in
this tree. This is a design study, not a port — no Hindsight code is copied
(CONTRIBUTING.md declares the project accepts no outside PRs, and the licence
split — root `README.md` says MIT while `hindsight-api-slim/README.md` says
Apache-2.0 — is unresolved, so reimplementation is the safe route anyway).

The brief assumes the ECHO Perfection Loop governs any item taken forward: each
becomes a FID, gets RED evidence, a converged plan, and implementation approval
before code.

---

## 2. What Hindsight Is (one paragraph)

Hindsight is a server-side memory engine for AI agents. It turns raw retain
calls into **world facts**, **experience facts**, and **observations**
(evidence-backed, deduplicated beliefs with proof counts), synthesizes standing
answers ("mental models") and living wiki documents ("knowledge pages") from
those beliefs, and retrieves them through four parallel strategies — semantic
vector search, BM25 keyword, entity/causal graph, and temporal filtering — fused
by reciprocal rank fusion (RRF, k=60) then reranked by a cross-encoder. The
standout operational point for Savant is not the memory model itself (Savant
already has `knowledge.md`, `LEARNINGS.md`, `dev/fids/`, session summaries) but
the **engineering discipline around it**: the code-review skill, the blackbox
test/eval harnesses, the extension slots, the hierarchical config, the
dual-dialect migrations, and the coding-agent integration pattern. Those are
what this brief extracts.

---

## 3. Tier-1: Features with direct Savant fit (recommended)

### 3.1 Sidebar cache-hit tracker (already in scope — see session queue)

**Idea from:** Hindsight's per-request telemetry + Nova's wiring analysis.

**Status:** Already queued this session. The producer exists
(`CacheHitRateMonitor` in `packages/agent-runtime/src/util/token-telemetry.ts`,
fed by `onCacheDebugUsageReceived` from `common/src/types/contracts/llm.ts:80`);
the consumer does not (zero `CacheHitRateMonitor` hits under `cli/src`). This is
a transport problem (agent-runtime → TUI), not instrumentation.

**Savant fit:** Cost visibility is a product surface. The widget should follow
Nova's design language: mono readout `CACHE 94% ▁▂▃▅▇ $0.031`, green
`#3dff9a` → magenta `#ff2a6d` on the monitor's existing drop alert, and
`CACHE —` when `isCachedTokenCountKnown` is false (never a lying 0%). Keyed by
model because Savant rotates models.

**Landing:** `cli/src` statusbar/footer component + a subscription seam on the
run/step context. FID-sized.

### 3.2 Cursor/agent coding-agents memory pattern (bank per repo)

**Idea from:** `hindsight-integrations/coding-agents/` — one bank per repo
(`coding-agent::{gitProject}`, worktree-aware via `git rev-parse
--git-common-dir`), five seeded knowledge pages with tier tags
(`knowledge:component|concept|convention|decision|feature-work`), and an
**additive-only** bank config (`manageBankConfig` never overwrites what the
bank defines).

**Savant fit:** Savant already has per-project `knowledge.md` + `dev/LEARNINGS.md`
and a `context-pruner` that summarizes. The extractable feature is the
**standing-knowledge page tiering** — a tiny taxonomy (components / concepts /
conventions / decisions / in-flight initiatives) that the compactor could
maintain per project, refreshed by a cron or post-consolidation, exactly like
Hindsight's knowledge pages. This is what gives an agent boot-time context
without re-discovery.

**Landing:** `packages/agent-runtime/src/run-agent-step/` or a new
`packages/knowledge-graph` integration; the compactor is the natural
writer. Medium-large FID (novel architecture).

### 3.3 H-cron refresh spreading

**Idea from:** Hindsight's `pageTriggerCron: "H * * * *"` — a `H` token is
replaced per page by a value hashed from (bank id, page name), so N pages
refresh on N distinct minutes instead of piling onto one.

**Savant fit:** Savant has periodic refreshers (cache warm-start, session-end
review, compactor idle passes). Anywhere N periodic jobs share one schedule,
`H`-hashing spreads load. Tiny, mechanical, high value.

**Landing:** a shared cron-utility in `common/src/util` + adoption at the
existing schedulers. Small FID.

### 3.4 Blackbox system-test package (composition tests)

**Idea from:** `hindsight-system-tests/` — a real server driven **only through
the published client**, with a stub LLM/embedder/reranker so no model download
and no secrets are needed (runs on fork PRs). Rules match on content not
request bodies; an unscripted call fails the test; `llm.hold("<step>")` parks a
step to assert on in-flight work; one story per file.

**Savant fit:** Savant's tests are mechanism-per-file (the same shape
`LEARNINGS.md` names as blind to *composition* bugs). A blackbox leg that drives
the shipped CLI/SDK end-to-end against a stub provider would catch the
seam-between-steps class that unit suites structurally cannot. Savant already
has `evals/v2` — this is a sibling shape, not a duplicate.

**Landing:** `evals/` or a new `packages/system-tests`. Medium FID.

### 3.5 LLM-as-judge test contract

**Idea from:** `hindsight-system-evals/` + the code-review skill: when the thing
under test is *how the model interprets a prompt*, MockLLM cannot simulate it;
assert with an independent judge model (`assert_meets_criteria`), never string
matches; judge is configured separately so a model never grades its own output.

**Savant fit:** Savant's compactor and summary paths are prompt-behaviour. The
pattern (judge anything non-deterministic, keep deterministic mechanics in fast
unit tests) is directly transferable. Small-to-medium FID + a shared judge
helper.

### 3.6 Sibling-parity review gate

**Idea from:** the code-review skill step 9a: when a capability exists once per
variant (harness / language / dialect / provider), the diff's variant is where
it silently goes missing. Enumerate the family, diff the capability list, prefer
hoisting, demand a family-wide structural guard test.

**Savant fit:** Savant has real sibling families — provider fetchers, free-key
predicates, EHEL enforcement legs, workspace typecheck legs. The *lesson* is
already half-learned (`catalogPairingIssues` in
`scripts/provider-catalog-parity.ts` is exactly this shape). The feature is a
**generic family-census checker** in `scripts/` that FIDs can declare.

**Landing:** `scripts/` + a template the code-review pass runs. Medium FID.

---

## 4. Tier-2: Worth adopting with effort (conditional)

### 4.1 Hierarchical config resolver (`_CONFIGURABLE_FIELDS`)

Hindsight: `Global (env) → Tenant (extension) → Bank (DB)`; a literal set gates
which fields are per-bank overridable; `get_credential_fields()` guarantees
secrets are NEVER exposed via API. Savant's config is flatter (env + settings
JSON + per-run state). The extractable piece is the **credential/field
partition**: a declared set of fields that can never round-trip through a
config API or export. Savant's `provider-credentials` path already separates
credentials; formalizing it as a declared set would make it auditable.

### 4.2 Dual-dialect migration dispatcher

Hindsight runs one Alembic tree against PostgreSQL and Oracle with
`run_for_dialect(pg=..., oracle=...)`, lint-enforced so a migration omitting a
dialect half fails CI. Savant's `packages/database` is SQLite-first; if Oracle
or MySQL parity ever becomes a goal, the *shape* (a dispatcher + a shape lint)
is the durable pattern. **Adopt only if multi-dialect becomes a goal.**

### 4.3 Memory-defense style secret scanning on retain paths

Hindsight scans every retain for 45 secret/PII patterns and redacts or blocks
before storage (`[REDACTED:github_token]`). Savant already has
`common/src/util/redact.ts` and `cli/src/utils/logger/sanitize.ts` — the
extractable feature is **pre-storage scanning on durable writes** (message
history, session summaries, knowledge files), so a leaked key never lands in a
file at all. Savant's ZTAP provenance already cares about this class.

### 4.4 Webhook-with-SSRF-guard outbound events

Hindsight's webhooks are SSRF-hardened (`url_guard.py`,
`HINDSIGHT_API_WEBHOOK_ALLOWED_HOSTS` — private/loopback ranges refused by
default, HMAC-signed deliveries). Savant's hook system (`hooks:` in
protocol.config.yaml) is local command-based; if outbound webhooks are ever
added, the SSRF guard must ship with them, not after. **Adopt the guard as a
check, not the webhooks themselves.**

### 4.5 Extension slots over forks

Hindsight loads one extension per slot (`TENANT`, `HTTP`, `MCP`,
`OPERATION_VALIDATOR`, `MEMORY_DEFENSE`) from `module.path:ClassName`, config
prefix-stripped. Savant's equivalent seams are agent/tool definitions and the
hook system. The pattern worth copying is **env-declared, in-process
extension points with validate-in-`__init__`** so a misconfigured extension
fails startup, not the first request. Medium FID if a slot is ever needed.

---

## 5. Tier-3: Notes for later / explicitly not adopted

- **Biomimetic memory data structures** (world/experience/observations with
  proof counts): intellectually interesting; Savant's flat `LEARNINGS.md` +
  FID records already serve the "evidence-backed belief" role for less
  machinery. Revisit only if a per-user conversational-memory product is
  ever built.
- **RRF k=60 fusion + cross-encoder reranking**: a search problem Savant does
  not yet have (no retrieval surface). Recorded as the reference algorithm if
  a knowledge-search feature appears.
- **Giotto animated-SVG figures** (`.claude/skills/figure/`): great for PRs,
  but a cosmetic addition; Savant's design-system work has higher priorities.
- **The "no outside PRs" policy**: a governance stance, not a feature —
  recorded for the operator's awareness, not adopted.
- **Licence discrepancy** (MIT README vs Apache-2.0 package header): flagged
  for the operator; irrelevant to feature adoption since nothing is copied.

---

## 6. Evidence provenance

Every idea above was read from the Hindsight tree in `resources/hindsight-main`
(README.md, CLAUDE.md, `hindsight-api-slim/hindsight_api/engine/`,
`hindsight-system-tests/`, `hindsight-system-evals/`,
`hindsight-integrations/coding-agents/`, `hindsight-extensions/`,
`.claude/skills/*`). Benchmarks cited in Hindsight's README (LongMemEval SOTA,
AMB sdebench) are **vendor claims** — external corroboration via
`researcher-web` failed with a 429 this session and was not retried; do not
cite them as fact in any FID without independent verification (ECHO
Cross-Agent Claim Rule).

---

## 7. Recommended order

1. **Cache-hit tracker** (already queued; smallest, highest user-visible value).
2. **Blackbox system-test package** (unblocks the composition-test class the
   LEARNINGS file keeps naming).
3. **LLM-as-judge contract** (paired with the eval work).
4. **H-cron spread + sibling-parity census** (mechanical, low risk).
5. **Coding-agents standing-knowledge pages** (largest; needs its own design
   FID before any code).