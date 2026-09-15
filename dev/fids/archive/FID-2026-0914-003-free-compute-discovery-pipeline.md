# FID: Free-compute discovery pipeline (freeairouter daily harvest → verified candidate proposals)

**Filename:** `FID-2026-0914-003-free-compute-discovery-pipeline.md`
**ID:** FID-2026-0914-003
**Severity:** medium
**Status:** closed 2026-09-14 (operator approval recorded verbatim: "approve"
after the final amended presentation; implemented + gate-verified same day)
**Created:** 2026-09-14 (operator directive: "Is there anyway we could scaffold
out a system that auto parses and updates savant-code w/ free compute
automatically using this [freeairouter.com]?" → research-first ruling →
Deep Research brief → report → adversarial verification → this FID)
**YAGNI-Compliance:** Verified (amended Loop 5) — no new dependencies
(fetch/parse/probe use Bun built-ins); automation is the operator-ruled
boot-check (cached 24h, background, fail-silent — not a scheduler, no
cron/CI); no auto-PR machinery; removal reuses the shipped `/provider
remove` command rather than building a new destructive surface; the agent
context block is bounded, sanitized, and once-per-candidate-set (no nag
loop, no untrusted prose in model context).

## Summary

Manual provider discovery ("find me the free ones") does not scale against a
free-compute ecosystem with 48-hour churn windows. This FID adds a **local
dev pipeline** that turns the freeairouter.com daily-open dataset into
verified, human-reviewed integration candidates:

- **harvest** — fetch + filter + safety-screen,
- **probe** — our own read-only endpoint introspection (the feed's
  model-list coverage is 12/214, so vendor-surface ground truth is ours),
- **propose** — generate an FID-001-shaped scaffold for operator approval,
- **integrate (Loop 5)** — daily boot-check automation, a sanitized
  agent-context block so the main agent can mention new candidates,
  wizard-driven one-step add for probe-passed candidates, and health
  tracking with agent-surfaced removal for pipeline-accepted providers.

Zero auto-merge; keys never enter the pipeline; the built-in
`PROVIDER_REGISTRY` is never written by the pipeline — additions land as
user-confirmed **custom providers** via the existing provider wizard, and
removal reuses the shipped `/provider remove` command (destructive acts
stay human-executed).

**Operator constraint locked:** the harvest must support **daily** cadence
(operator ruling 2026-09-14: "it needs to be daily because the churn in this
space is insane").

## Environment

- Primary feed: `https://freeairouter.com/data/sites.json` (operator-confirmed
  "true endpoint"). 3.3 MB; `Access-Control-Allow-Origin: *`;
  `Cache-Control: public, max-age=300`; per-record daily probes;
  robots.txt `Allow: /` except `/go`.
- Research basis: `docs/design/Free LLM API Aggregator Research.md`
  (Gemini Deep Research) + its **adversarial verification record**
  (`docs/design/Free LLM API Aggregator Research — Verification.md`) — the
  verification record supersedes the report wherever they conflict
  (cheahjs repo REFUTED-dead; zukixa stale; quota appendix seed-only).
- Registry diff target: `PROVIDER_REGISTRY` (`common/src/providers/registry.ts:22`,
  18 keys after FID-2026-0914-001).
- Production seams (Loop-5 ground check):
  `customProviders?: CustomProviderConfig[]` settings field
  (`cli/src/utils/settings/types.ts:77`, fail-closed per-entry validation in
  `settings/validation.ts:191`); provider wizard add path with live
  re-registration (`cli/src/commands/router/route-provider-wizard.ts:50,172`);
  shipped removal command `/provider remove <id>`
  (`cli/src/commands/provider-subcommands-handlers.ts:164` — custom-only,
  built-ins protected, captures `wasActive` before registry reset so the
  active-selection fallback is safe). No system-reminder seam exists in the
  cli (0 grep hits) — the agent-context block rides the session bootstrap
  context instead.

## Evidence (all first-hand, 2026-09-14, tool output on record)

1. **Feed shape (loop-audit probe):** 214 records; record =
   `{card, probes[], report, analysis, analyzedAt}`; card fields include
   `host, url, category, categoryConfirmed, status, kind, platform, freeQuota_en,
   freeModels_en, probe{reachable, latencyMs, modelsCount, modelsPublic,
   signupOpen, quotaHint}, discoveredFrom, firstSeenAt, lastProbedAt`.
   Value domains: `status ∈ {verified:106, risky:84, down:24}`;
   `kind ∈ {relay:130, product:62, unknown:22}`;
   `platform ∈ {unknown:68, new-api:78, openai-compatible:54, one-api:13, voapi:1}`;
   `category ∈ {first-party-free:50, commercial-aggregator:37, free-relay:19,
   monitor-directory:9, free-product:5, null:94}`.
   The rendered site label "Up" = data value **`verified`** (not `"up"` —
   caught by audit, never hardcode the rendered label).
2. **Funnel viability:** stage-0 filter (`status=verified` ∧
   `probe.reachable` ∧ `category ∈ {first-party-free, commercial-aggregator}` ∧
   `categoryConfirmed`) yields **55 candidates** (35 + 20) from 214 —
   a workable daily set, not a firehose.
3. **Typosquat screen (executed prototype):** Levenshtein ≤ 2 against 20
   canonical vendor hosts flags **2** of 214: `api.celebras.ai` (true
   positive, distance-1 from `api.cerebras.ai`) **and `api.z.ai` (FALSE
   POSITIVE — legitimate Zhipu brand, distance-1 from `api.x.ai`)**. A naive
   hard-fail would auto-reject a major legitimate provider → gate design
   corrected in Loop 3 (two-tier, below).
4. **Feed limitation that forces our own probes:** `probe.modelsPublic=true`
   on only **12/214** records — the feed cannot supply model lists; vendor
   `/v1/models` introspection is mandatory for anything real.
5. **Threat basis (verified research):** arXiv `2604.08407` — 428 commodity
   LLM proxy routers measured; 26 actively injected malicious content, 17
   intercepted credentials; `api.celebras.ai` present in the raw feed.
   Anonymous relays (`category=free-relay`, `kind=relay`) are excluded at
   stage 0 by construction.
6. **Safety posture precedent:** this repo's established pattern — agent
   proposes, operator releases (self-improving harness governance; FID-001
   curated-catalog review discipline; pre-push credential scan as backstop).
7. **Removal primitive already shipped (Loop-5 probe):** `/provider remove`
   handles custom-only deletion, rejects built-ins, and neutralizes the
   active-provider edge (`provider-subcommands-handlers.ts:188-204`) —
   the lifecycle design reuses it instead of building a parallel path.
   Custom providers already round-trip through wizard + settings + live
   re-registration (42-codebase grep, `customProviders`).

## Affected Components

| Path | Change | Why |
|---|---|---|
| `scripts/providers/harvest-freeairouter.ts` | **NEW** (~350 lines) | Stage A+B: fetch, parse, stage-0 filter, typosquat screen, registry dedupe, `--probe` mode (GET /v1/models + 401-boundary check + TLS check per candidate), emit report |
| `scripts/providers/propose-provider.ts` | **NEW** (~200 lines) | Stage C: `--propose <host>` generates the FID-001-shaped scaffold (catalog entry draft, test-pin skeleton, docs blurb) into `dev/scratchpad/` — never edits the registry |
| `.gitignore` | +1 line | `dev/provider-candidates/` — Loop-2 V4 defect: only `dev/scratchpad/*` is ignored today (`.gitignore:51`); without this row the daily artifacts would flood `git status` |
| `package.json` | +2 script rows | `providers:harvest`, `providers:propose` |
| `docs/` provider docs | +1 short section | Operator runbook for the daily loop |
| `dev/provider-candidates/` | **NEW, gitignored** | Stable daily-replaced artifacts: `report.md` (data-backed, full audit trail, overwritten each run — MQ8) + `candidates.json` (rolling machine state with downStreak/snapshots) |
| `common/src/providers/types.ts` (+ validation) | +2 optional fields | `CustomProviderConfig.source?: 'discovery-pipeline'`, `acceptedAt?: string` — provenance stamp enabling health tracking; additive, fail-closed validated |
| `cli/src/commands/router/route-provider-wizard.ts` | +prefill path | Wizard accepts a discovery candidate (probed models/endpoint pre-filled); user confirms; saved as a custom provider with the stamp — the human gate |
| `cli` session bootstrap context | +1 bounded block | Size-capped, sanitized candidate/health notice (hosts, model counts, probe verdicts, dates only — never feed prose; once per candidate set) so the main agent can mention new sources conversationally |
| `scripts/providers/harvest-freeairouter.ts` health section | +~40 lines | Pipeline-sourced custom providers get the same probes daily (liveness, `/v1/models` shape, **401-boundary drift** = compromise signal); results feed the report + context block |

**Explicitly NOT touched:** `common/src/providers/registry.ts` (built-ins),
the removal command's logic (reused as-is), git hooks, CI workflows. The
touched cli surfaces are the wizard add path + bootstrap context block only;
both pinned.

## Risk Level

**Medium** (was Low pre-Loop-5). The harvest/probe/propose core remains pure
dev tooling (read-only egress, transparent UA, operator-gated), but Loop 5
adds three production cli surfaces: settings types, the wizard add path, and
the session bootstrap context block. Mitigations are structural: additive
optional fields with fail-closed validation; the wizard confirmation IS the
consent gate; the context block is sanitized to non-injectable facts
(host/count/status/date) and size-capped; removal stays the human-executed
shipped command.

## Proposed Solution

### Approach — three stages, human gate between C and the registry

**Stage A — Harvest (daily, `bun run providers:harvest`):**
fetch `sites.json` once (UA `SavantCode-DiscoveryBot/1.0
(+https://github.com/savant-code/savant-code)`, 30s timeout, single daily
poll in off-peak UTC when automated later, exponential backoff on failure,
never evade blocks); parse cards; apply the stage-0 filter (Evidence #2);
run the two-tier typosquat screen (Loop-3 corrected):

- **Tier 1 (auto-reject):** Levenshtein distance 1–2 vs any of the
  canonical vendor hosts, **unless the host itself is in the
  legitimate-vendor allowlist** (z.ai, x.ai, etc. — the allowlist ships as
  a reviewed constant in the script; `api.celebras.ai` dies here).
- **Tier 2 (review-flag):** distance 3–4 → carried into the report flagged,
  never auto-rejected (catches `api.openrouterPro.ai`-class lookalikes
  without nuking short-name brands).

Dedupe against `PROVIDER_REGISTRY` keys and prior-day candidates; diff
classification: `new` / `changed` (quota or model deltas) / `lapsed`
(was a candidate, now down 3 consecutive days → pruned per the 72-hour
grace rule from the verified research).

**Report contract (MQ8, operator ruling): one stable, data-backed report,
replaced in place every run** so the operator can pull it up anytime:

- `dev/provider-candidates/report.md` — **overwritten each run** (never
  accumulated; stable path). Contents: feed metadata (fetched-at UTC,
  total records, stage-0 counts); the **full candidate table** (every
  stage-0 pass with its probe results — model count, shape validity,
  latency, 401-boundary verdict); the **audit trail** (every gate decision
  with its reason: typosquat rejections + flags, risky exclusions,
  open-relay rejections, registry dedupes); new/changed/lapsed sections;
  the health section for tracked providers (Stage E). Every claim in the
  report cites its probe evidence — data-backed by construction.
- `dev/provider-candidates/candidates.json` — the machine state,
  also replaced each run, carrying per-candidate `downStreak` and the
  last-probe snapshot so diff + 72h-prune logic needs no per-date
  directories or separate history store.

Summary table printed to stdout. All artifacts gitignored.

**Stage B — Probe (same command, `--probe`):** for each `new` candidate that
passes Tier 1: read-only `GET /v1/models` (10s timeout, 1 retry) → record
model count, OpenAI-shape validity, latency; **authentication-boundary
check:** unauthenticated `POST /chat/completions` with a 1-token dummy body
must return **401/403** — a 2xx auto-rejects the candidate as an open relay
(LLMjacking class); TLS must validate against the exact host (no wildcard
dynamic-DNS hosts); results appended to the report. **No key material is
ever sent, stored, or required.**

**Stage C — Propose (`bun run providers:propose -- <host>`):** operator picks
a candidate; the script generates into `dev/scratchpad/` an FID-001-shaped
scaffold: gateway-catalog entry draft (models from our own probe + vendor
docs links), context-window column marked **PROVIDER-DOCS-REQUIRED**
(never from the feed — verification record finding #11), test-pin skeleton,
docs blurb, and a **HIGH-RISK banner block** if the training-consent
heuristic (ToS text contains training/improve-our-services language near
user-data without a free-tier opt-out) or the research flags demand it.
The operator then runs the normal FID-001 curation flow by hand.

**Hard invariants (all stages):** zero auto-merge; zero writes outside
`dev/scratchpad/` + `dev/provider-candidates/` (both non-shipping); no key
handling; no `risky`-status provider ever reaches a report (hard-excluded);
feed text is a lead, vendor surfaces are ground truth (verification record
architecture, adopted).

**Stage D — Automate + mention (Loop 5, operator rulings MQ1–MQ5 locked to
recommended defaults):**

- **Boot-check (MQ4):** on CLI start, if the newest harvest report is >24h
  old, run stages A+B in the background (non-blocking, fail-silent,
  never delays the TUI, max once/day). Off-peak-UTC poll timing applies to
  the run itself.
- **Report surface (MQ1):** stdout summary + gitignored artifacts (unchanged).
- **Agent mention (MQ5):** the newest candidate/health summary rides the
  session bootstrap context as a **bounded block** — host names, model
  counts, probe verdicts, dates ONLY, plus the stable report path
  (`dev/provider-candidates/report.md`) so the operator can ask the agent
  to pull up the full data-backed report at any time. Never feed prose,
  never quota text, never untrusted third-party strings
  (prompt-injection surface = zero by construction). Size-capped; once
  per candidate set (no nag loop). The agent mentions it conversationally;
  it has no add/remove authority.
- **One-step add (MQ6):** for probe-PASSED candidates only, the agent's
  mention offers the add path; user consent drives the existing provider
  wizard with the candidate pre-filled (models/endpoint from our probe);
  saved as a custom provider with the provenance stamp. Built-in registry
  still untouched.
- **risky handling (MQ2):** hard-excluded (unchanged). **Scheduling
  (MQ3):** manual command + boot-check only; no cron/CI (unchanged).

**Stage E — Health-track + remove (Loop 5, MQ7 locked: yes):**

- Pipeline-sourced custom providers (stamped `source:
  'discovery-pipeline'`) are probed by every daily harvest: liveness,
  `/v1/models` shape validity, and **401-boundary drift** — a provider
  that begins answering unauthenticated generation requests is flagged as
  a compromise signal, not mere downtime.
- The harvest report gains a health section; drift/degradation surfaces in
  the agent context block with the exact remediation: the shipped
  `/provider remove <id>` command (custom-only, built-ins protected,
  active-provider fallback already safe — `provider-subcommands-handlers.ts:164`).
- **The agent never receives a destructive provider tool.** Removal is
  always user-executed; the agent detects, phrases, and points.
- Lifecycle complete: discover → verify → propose → accept (wizard,
  stamped) → track (daily probes) → remove (agent suggests, human
  executes).
- A pipeline-accepted provider that proves itself can still be upstreamed
  into the built-in registry via normal FID-001 curation — unchanged.

### Steps

1. `scripts/providers/harvest-freeairouter.ts` (stages A+B+health section,
   CLI flags `--probe`, `--json`, `--min-distance`).
2. `scripts/providers/propose-provider.ts` (stage C).
3. Loop-5 production seams: `CustomProviderConfig` stamp fields +
   validation; wizard prefill path; bootstrap context block (bounded,
   sanitized, TTL); boot-check trigger (24h cache, background,
   fail-silent).
4. `package.json` script rows + docs runbook section.
5. Pins: parser fixtures (frozen slice of the real payload), stage-0 filter
   counts, two-tier screen (celebras rejected; z.ai survives via allowlist),
   401-boundary auto-reject, lapsed-prune rule, report emission, no-write-
   outside-dev-dirs guard; MQ8 pins: stable-path overwrite (second run
   replaces, never appends), report carries full audit trail (every
   rejection has a reason), downStreak persistence across runs; Loop-5
   pins: provenance-stamp round-trip, health-drift detection (incl.
   401-drift flag), context-block sanitization + size cap + TTL + report
   path, boot-check 24h gating, wizard-prefill consent path.

### Verification

RED→GREEN per step; fixtures from the real payload (no live network in
tests); the LIVE gate is one real harvest run whose output the operator
sniff-tests.

## Verification Gates

- gate: typecheck × 4 (sdk, common, packages/agent-runtime, cli)
- gate: bun test scripts/providers/ (new pin suites)
- gate: bun test ./agents/__tests__/ ./packages/agent-runtime/src/__tests__/ (no regression)
- gate: bun x eslint scripts/providers/ --max-warnings 0
- gate: bunx prettier --check scripts/providers/
- gate: bun run lint:md
- gate: LIVE — one real `providers:harvest --probe` run; report reviewed by
  operator; zero writes outside dev/ dirs (git status proof)

## Perfection Loop

### Loop 1 — Authoring (2026-09-14, post-research + post-verification)

- **RED (issues + evidence):** manual discovery cannot track 48-hour churn
  (research B7 + operator constraint); feed model-list coverage 12/214
  (probe #4) means any pipeline that trusts feed model data is built on air;
  typosquat class is live in the feed (`api.celebras.ai`, probe #3); the
  Deep Research report's recommended primary feed is dead (verification
  record #5) — architecture must be vendor-ground-truth-first.
- **GREEN plan:** three-stage local pipeline (above), dev-tooling footprint,
  human gate before registry.
- **Self-audit:** footprint minimized to 2 scripts + 2 package.json rows +
  docs; no scheduler, no CI, no auto-PR (YAGNI); registry untouched.
- **Self-refutation (adversarial):** *"Why not auto-open PRs for strong
  candidates?"* — refuted: research shows malicious lookalikes survive even
  curated feeds' own probes; a single auto-merged typo-squat gateway poisons
  every user session. *"Why not trust freeairouter's risk scores?"* —
  refuted: they are LLM-sentiment synthesis over community chatter (report
  dossier), not audits; we consume liveness only. *"Why not weekly?"* —
  refuted by operator constraint + churn evidence; daily is the feed's own
  probe cadence, so we align with it. *"Why our own /v1/models probes
  instead of the feed's?"* — evidence #4: 12/214. *"Why not parse quotas
  from freeQuota_en?"* — refuted by verification record #6/#11: upstream
  sync source is dead/tertiary; quotas are vendor-docs-at-propose-time.

### Missed Questions — all ruled 2026-09-14, operator: "defaults"

1. **MQ1 — daily report surface:** **stdout + gitignored artifacts** ✓
2. **MQ2 — `risky`-status providers:** **hard-excluded** ✓
3. **MQ3 — scheduling:** **manual command + boot-check; no cron/CI** ✓
4. **MQ4 — Layer-1 trigger:** **boot-check (24h cache, background,
   fail-silent)** ✓
5. **MQ5 — agent mention:** **session-bootstrap context block, sanitized +
   bounded + once-per-set** ✓
6. **MQ6 — one-step add:** **wizard-driven, probe-passed candidates only,
   provenance-stamped custom provider** ✓
7. **MQ7 — health tracking + agent-surfaced removal:** **yes — stamped
   providers probed daily; agent surfaces drift + the exact `/provider
   remove` command; agent has no destructive tool** ✓
8. **MQ8 — daily report:** **one stable data-backed report at a fixed path
   (`dev/provider-candidates/report.md`), replaced in place every run —
   full candidate table + complete gate audit trail + health section;
   operator (or the agent, on request) can pull it up anytime** ✓

### Loop 2 — Independent audit (executed 2026-09-14, tool-evidenced, pre-authoring)

- **A1 ✓ feed schema/domain audit:** full distribution dump captured
  (Evidence #1) — corrected the rendered-label assumption ("up" is really
  `verified`; had the FID hardcoded the rendered value, stage-0 would match
  0 records).
- **A2 ✓ funnel viability executed:** stage-0 prototype over the live
  payload → 55 candidates (35/20 split) — pipeline is viable at daily
  cadence without flooding.
- **A3 ✓ typosquat screen executed:** caught `api.celebras.ai` AND produced
  one false positive (`api.z.ai`) → gate corrected in Loop 3.
- **A4 ✓ feed-limitation probe:** `modelsPublic` 12/214 → our-probe design
  forced (was assumed in the draft; now measured).
- **A5 ✓ research verification record:** cheahjs dead (404, owner's 117
  repos checked), zukixa stale (pushed 2025-10-15), arXiv paper real —
  the FID's architecture inherits the corrected stack, not the report's.
- **A6 ✓ registry surface:** `PROVIDER_REGISTRY` at
  `common/src/providers/registry.ts:22` confirmed for dedupe + diffing.
- **A7 ✓ etiquette targets:** robots.txt `Allow: /` (except `/go`), CORS
  `*`, 5-min cache — daily single-poll consumption is the intended use.
- **A8 ✓ 401-boundary validated against ground truth:** unauthenticated
  dummy `POST /chat/completions` returned **401** from all three probed
  real vendors (api.groq.com, api.cerebras.ai, api.mistral.ai) — the
  "2xx = open relay = auto-reject" gate has correct positive controls.
- **A9 ✓ scaffold template exists:** FID-2026-0914-001 read 0-EOF —
  catalog-entry + static-pins + docs shape confirmed; runbook confirmed at
  `docs/archive/design/Adding New Providers.md`.
- **A10 ✓ registry + filter soundness:** `PROVIDER_REGISTRY` measured at
  exactly **18 keys** (loop-audit import); stage-0 drops nothing viable —
  all 18 `category:null` verified+reachable records have
  `categoryConfirmed=false`; and **17 risky-status** first-party/aggregator
  providers exist (e.g. `mx.236600.xyz`) — concrete MQ2 evidence for hard
  exclusion.

### Loop 5 — Automation + lifecycle amendment (2026-09-14, operator-driven)

Operator request: automate the loop and let the agent mention/accept/remove
suggested providers ("it gets built but it doesnt work out, they can inform
the agent and remove it"), then ruled "defaults" on MQ1–MQ7.

- **Ground check executed:** `customProviders` settings field + fail-closed
  validation, wizard add path with live re-registration, and the shipped
  `/provider remove` command all located and read (`provider-subcommands-
  handlers.ts:164-204` — incl. the `wasActive` edge). Removal design reuses
  shipped code instead of a parallel destructive path.
- **Design additions:** Stage D (boot-check automation + sanitized agent
  context block + wizard one-step add) and Stage E (health tracking of
  stamped providers, 401-boundary drift as compromise signal,
  agent-surfaced `/provider remove`).
- **Self-refutation:** *"Give the agent a removal tool — it's more
  autonomous."* Refuted: destructive acts must stay human-executed (repo
  posture; wizard confirm + slash command are the consent surfaces).
  *"Put feed summaries in the context block — richer for the agent."*
  Refuted: third-party prose is a prompt-injection surface; only
  host/count/status/date facts pass. *"Health-track ALL custom
  providers."* Refuted (scope): only pipeline-stamped providers —
  user-authored ones are out of contract; YAGNI.
- **Risk re-grade:** Low → **Medium** (three production cli surfaces
  added; mitigations structural, pinned).
- **Addendum (MQ8):** operator requirement — the report must be
  **data-backed and stable-path** ("creates a daily report with everything
  it found… replaces the file daily so the user can pull it up and look at
  it anytime"). Diff/prune memory moved inside `candidates.json`
  (downStreak + snapshots) so replacing the report daily loses no history
  the 72-hour rule needs. Per-date directories dropped.

- Typosquat gate: naive "hard-fail at distance ≤ 2" → **two-tier with
  legitimate-vendor allowlist** (A3 false positive: `api.z.ai`).
- Stage-0 status literal: `"up"` → `"verified"` (A1 domain dump).
- Model-list source: feed → **our own probe** (A4).
- Report artifacts: committed → **gitignored** (churn: 365 files/year would
  pollute the repo; stdout is the operator surface).
- Quota/context columns: feed text → **PROVIDER-DOCS-REQUIRED** markers
  (verification record #11 provenance audit).
- Gitignore coverage: `dev/provider-candidates/` added to the footprint
  (V4 — was implicit-only; the daily artifacts would otherwise pollute
  `git status` from day one).
- Boundary gate validated: A8 positive controls (3 real vendors → 401)
  recorded before implementation.

### Loop 6 — CONVERGENCE (re-earned post-amendment, 2026-09-14)

Loop 5's additions each cite executed tool evidence (production seams grep,
removal-command read, settings-types read). All seven MQ rulings recorded
verbatim. Gates unchanged plus Loop-5 pins. Status: **converged**; no
implementation code exists; final Law-2 approval pending.

### Loop 4 — CONVERGENCE (earned, 2026-09-14, re-affirmed post second-pass audit)

All loop claims above cite executed tool output from this session (live
payload analyses, GitHub API checks, arXiv resolution, registry import
measurement, live vendor 401 probes, runbook path check). No unevidenced
PASS stands; the second-pass audit produced one footprint correction
(gitignore row) and one evidence strengthening (A8/A10). Status set to
**converged**; no implementation code exists yet; Law 2 presentation
follows immediately.

## Resolution

- **Closed Date:** 2026-09-14
- **Fix Description:** Implemented in full: Stage A+B harvest/probe
  (`scripts/providers/harvest-freeairouter.ts` + 6 lib modules), Stage C
  proposal generator (`scripts/providers/propose-provider.ts`), Loop-5
  production seams (stamp validation in `common` parser — single truth;
  boot-check + sanitized announce block in `use-chat-bootstrap.ts`;
  MQ6 wizard prefill via `provider-wizard-discovery.ts` + `adoptActiveSession`
  + empty-adopt consent gesture in the step machine), Stage E health
  tracking (401-boundary drift as compromise signal), MQ8 stable report
  (replaced in place; full audit trail; downStreak in `candidates.json`).
  Open-relay enforcement landed at BOTH consumption surfaces after the
  LIVE run caught a real one: wizard prefill hard-refuses
  `open-relay-reject` hosts; propose banners DO-NOT-CURATE.
- **Tests Added:** `scripts/providers/__tests__/harvest-core.test.ts` (23),
  `scripts/providers/__tests__/discovery-seams.test.ts` (16),
  `cli/src/commands/__tests__/provider-wizard-discovery.test.ts` (15 —
  RED-first for the MQ6 seam). All 54 green; full cli suite 3696 pass /
  0 fail; common 724 pass / 0 fail; sdk 611 pass / 0 fail.
- **Verification Evidence:** typecheck ×4 exit 0; `eslint --max-warnings 0`
  pass on all 16 touched files; `lint:md` pass; prettier clean; Law-4
  reachability greps recorded (prefill seam consumers, boot-check wiring,
  stamp consumers, package.json rows, assertWithinDev enforcement in
  `report.ts:128`); **LIVE gate:** real `bun run providers:harvest --probe`
  run — 214 feed records → 55 stage-0 → 55 new (first run), 1 rejection
  (`chutes.ai` — open relay, LLMjacking class, caught in the wild), 7
  tier-2 flags with exact distance evidence, report + `candidates.json` +
  `agent-context.txt` written and sniff-verified.
- **Archived:** dev/fids/archive/ (this move)

## Lessons Learned

- **The site is not the schema.** The rendered label "Up" was the data
  value `"verified"` — the naive draft would have matched 0 records.
  Always diff the raw payload before coding against an API.
- **Distance gates need allowlists.** A naive Levenshtein hard-fail
  permanently banned `api.z.ai` (legitimate Zhipu). Two-tier +
  legitimate-vendor allowlist is the correct shape for fuzzy security
  screens.
- **Measure distances, never guess them.** Multiple test fixtures were
  written with wrong assumed distances (`api.ggroq.com` is distance-1,
  not 2; `api.gr0qzz.com` is 3, not 2). The `levenshtein` helper became
  the arbiter of every fixture.
- **The LIVE gate is not ceremony.** The first real run caught a genuine
  open relay (`chutes.ai`) immediately — and exposed that the auto-reject
  verdict was advisory at the consumption seams. A gate that only writes
  to a report is a label, not a gate; enforce the verdict at every place
  a candidate becomes actionable.
- **Run the script, not just the tests.** The harvester's cross-tree
  relative-import depth was wrong in a way no typecheck caught (no test
  imports the driver). Executing the real entrypoint is the only
  verification of a script's module graph.
- **Standing verdicts must carry forward.** Post-closure day-two LIVE run
  (2026-09-14) caught probe-evidence erosion: `diffCandidates` rebuilt
  per-run state and only patched new/changed hosts, so an unchanged
  re-sight wiped ALL 55 day-one boundary verdicts to null — the wizard
  prefill guard would have been fully blind on day two (it would have
  prefilled `chutes.ai`, a measured open relay). Fix: standing
  `lastBoundary`/`lastProbe` carry forward unless a fresh measurement
  overwrites them, pinned in `harvest-core.test.ts` ("boundary evidence
  CARRIES FORWARD") and enforced again in the prefill reader (standing
  verdict authoritative over the per-run snapshot). Verified with a third
  LIVE run: 55/55 verdicts survived, zero classification drift across
  runs two and three (0 new / 0 changed / 0 lapsed — the no-nag announce
  correctly stayed silent).
- **Output IS a product surface.** Operator review (2026-09-15): the
  first report draft was "terrible visually and nearly impossible to
  read" — a 55-row table of constant defaults plus a ~140-bullet audit
  log. Restructured to professional form: executive summary, changes-only
  section, grouped + readiness-sorted candidates, counted reason-groups,
  capped model roster. Two latent defects surfaced in the same review:
  the fingerprint hashed LLM-rewritten quota prose (false `changed`
  classifications — proven live: prose-hash flagged 2 hosts the
  models-hash run correctly ignores) and the Models column rendered a
  bare 0 for endpoints that merely hide their list. Fingerprint is now
  MODELS-ONLY, hashed (8-hex FNV-1a) inside a `_meta`+`hosts` state
  wrapper with bit-identical legacy migration; model counts distinguish
  probed vs feed-listed (†) vs unknown (—). Lesson: machine-state files
  are read by humans more often than designs assume — hash what only
  machines compare, show what humans decide on.
