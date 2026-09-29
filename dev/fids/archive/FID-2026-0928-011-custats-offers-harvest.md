# FID-2026-0928-011: custats free-offer feeds as a second discovery source

**Filename:** `FID-2026-0928-011-custats-offers-harvest.md`
**ID:** FID-2026-0928-011
**Severity:** low
**Status:** closed
**Created:** 2026-09-28
**Automation level:** 3
> **Status progression.** `created` at authoring; `closed` same session after
> RED-first implementation (18/18 pins; two real defects caught by the pins
> before any live run — a fixture that didn't reproduce the malformed-row
> contract, and a matcher that missed brand-label prose like "Vercel AI
> Gateway"). The operator directive ("i want to add this source as well")
> fires the re-activation trigger recorded on the shelf item
> (`dev/idea-shelf/custats-free-offers-feed-harvest-source.md`, logged
> 2026-09-28 after a live surface probe). LIVE harvest verified end-to-end:
> 43 attributed / 44 unattributed / 1 expiring soon; models leg 161 rows,
> 31 archived.

## Summary

The free-compute discovery pipeline (FID-2026-0914-003) is single-source:
`freeairouter.com/data/sites.json`. This record adds **custats** (two feeds
run by one operator, luongnv89) as a second, differently-shaped source:

1. **`freetokens.custats.info/feed`** — RSS 2.0, ALL 196 offers as items.
   The `<category>` element is absent; the category and expiry ride the
   description tail (`… — API providers · ongoing.` /
   `… · expires Oct 4, 2026.`). The operator-linked slice (`?category=api_provider`)
   is **87 items** (probe: amount-parseable 58/87, expiry-parseable 87/87,
   `lastBuildDate` same-day). Offers are TIME EVENTS (credits, trials,
   expiry windows) — they feed an offers ledger + report, NOT the host
   candidate queue.
2. **`free-llm-models.custats.info/free_models.json`** — OpenRouter-schema
   catalog, 161 free models across 6 providers (openrouter, groq, cerebras,
   google, huggingface, nvidia-nim — all already tracked), with per-row
   `providerId`, `expiration_date`, and feed-level `newModelIds` /
   `archivedModels` / `fetchedAt`. This leg is **enrichment + retirement
   signal** for already-known providers, not new-host discovery.

**Doctrine (unchanged, from the shelf record):** the feed is INPUT to the
pipeline, never the pipeline. RSS content is untrusted data. Offer text
never produces automated config changes; our own gauntlet decides promotion.
No automated network probes are added for offers in this record — the two
feed fetches are the only network surface.

## Environment

- Repo `savant-code` v0.0.34, `main`, Bun 1.3.14, Windows/Git Bash.
- Pipeline home: `scripts/providers/` (harvest-freeairouter.ts main flow:
  fetch → parseFeedSites → mergeSeedCards → stage0 → typosquat →
  diffCandidates → runProbeMergePhase → runReportWritePhase; state in
  gitignored `dev/provider-candidates/`, writes fenced by `assertWithinDev`).
- Feed shape evidence: see Summary (probed LIVE 2026-09-28).

## Detailed Description

New `scripts/providers/lib/custats.ts` (pure parser/matcher — offline
testable) and `scripts/providers/harvest-custats.ts` (orchestration):

1. **Parse offers** (`parseCustatsFeed`): items → `{ title, url, description,
   category, expiryKind: 'ongoing'|'expires', expiryDate?, amountHint? }`.
   Category + expiry from the description tail (defensive: unparseable tails
   keep the raw text as the hint — a note, never a config change). CDATA
   stripped, malformed items skipped.
2. **Parse models** (`parseCustatsModels`): typed lift of `free_models.json`
   — `fetchedAt`, `models[] {id, providerId, contextLength, expirationDate}`,
   `archived[] {id, providerId, removedAt}`, `newModelIds`. Unknown shapes
   skipped (untrusted input contract, same as `parseFeedSites`).
3. **Freshness gates** (single-operator bus-factor mitigation): feed
   `lastBuildDate` ≤ 72h and catalog `fetchedAt` ≤ 48h at harvest time, else
   the cycle is SKIPPED with a logged reason and the last-good state is kept
   (soft exit — a stale source must not break operator scripting).
4. **Host attribution** (`matchOfferHosts`): domains extracted from
   title+description, the custats host itself excluded, matched against the
   known-host set (candidates ledger + seed hosts + registry baseUrls) by
   exact-or-subdomain rule. Attributed offers become per-host notes;
   unattributed offers are listed for operator review — new lanes enter the
   pipeline through the existing SEED_HOSTS manual-review path, never
   auto-queued.
5. **Persistence + report**: `dev/provider-candidates/custats.json` (ledger:
   freshness stamps, attributed offers, unattributed offers, new/archived
   models) and `dev/provider-candidates/custats-report.md` (expiring-soon
   first, then ongoing; new free models; retired models; host-attribution
   table). Main report.md is untouched — report custody stays with the
   freeairouter leg.
6. **Wiring**: `providers:custats` package script. No registry, catalog, or
   gate changes of any kind.

## Root Cause

Not a defect — a scoped extension of the discovery pipeline to a second,
differently-shaped source, de-risking the single-feed dependency recorded as
the pipeline's known gap.

## Impact Assessment

- Discovery gains a second, independently-refreshed source with a built-in
  delta field (`newModelIds`) and a principled retirement signal
  (`expiration_date`/`archivedModels`) the freeairouter leg lacks.
- Offer expiry windows (time-limited free credits) become visible to the
  operator without human browsing — the shelf's "would have caught the
  Space-Bunny window" case.
- Zero new automated probes; zero gate changes; zero registry changes.

## Proposed Solution

Steps 1–6 as in Detailed Description, RED-first: parser/matcher pins run
against fixture XML/JSON (CDATA items, missing tails, malformed entries,
stale-source gates, attribution matching) before the orchestration file is
wired; the LIVE probe output above pins the real feed shape the fixtures
reproduce.

> Gate note (sits above the heading per the positional rule): `typecheck
> scripts` is not a legal gate (`scripts` is deliberately absent from
> `VALIDATION_WORKSPACE_POLICY`, `scripts/validation-gates.ts:22` — the same
> wall FID-2026-0928-001 documented). The `scripts/**` tree is instead
> type-gated by the standing `typecheck:scripts` leg inside the repo-wide
> `bun run typecheck` (FID-2026-0928-007), which was run green live during
> this record's implementation.

## Verification Gates

- gate: test scripts/providers/__tests__/custats-harvest.test.ts
- gate: quality

### Verification Receipt

- fingerprint: sha256:9bc7035ccfe55c9e08e8179a31c894726bafc2a790c6ac3ce3d69ec34a027f50
- verified: 2026-09-28T23:30:44.167Z
- test scripts/providers/__tests__/custats-harvest.test.ts: exit 0
- quality: exit 0

## Step Status

- [x] Proposed Solution step 1 — offer parser (`lib/custats.ts: parseCustatsFeed`): category/expiry tail lift, CDATA strip, entity decode, malformed-item skip, amount hint
- [x] Proposed Solution step 2 — models catalog parser (`parseCustatsModels`): envelope + per-row lift, id-less rows skipped, archived rows with removedAt
- [x] Proposed Solution step 3 — freshness gates (`feedFreshness`): RSS ≤72h / catalog ≤48h, unparseable dates fail closed, stale cycle soft-skips with exit 0
- [x] Proposed Solution step 4 — host attribution (`matchOfferHosts`): host literals + conservative brand-label tokens (≥3 chars, non-generic); custats host excluded; everything unmatched → operator-review bucket
- [x] Proposed Solution step 5 — ledger (`dev/provider-candidates/custats.json`: firstSeen/lastSeen per offer URL, hosts, freshness stamps) + `custats-report.md` (expiring-soon first); main report.md untouched
- [x] Proposed Solution step 6 — `providers:custats` package script; harvest-custats.ts orchestration-only

## Perfection Loop

### Missed Questions

1. **Why don't offers enter the host candidate queue?** The queue is
   host-keyed and the offers carry no machine host field — attribution is
   prose-derived and lossy. Auto-queuing prose-derived hosts would bypass
   the typosquat screen's judgment. New lanes go through SEED_HOSTS review,
   which exists for exactly this.
2. **Why is the models leg enrichment-only?** All 6 catalog providers are
   already tracked (registry or pipeline); the feed's unique value is the
   delta/retirement fields and free-window dates, not new hosts.
3. **Why a separate report instead of extending report.md?** The MQ8 stable
   report is the freeairouter leg's contract; merging a second source into
   it couples two refresh cadences and two schemas. Separate ledger + report
   keep custody clean; the operator reads both from one directory.
4. **Why soft-exit on staleness?** The source is one operator's project; a
   stale week must degrade to "no new data + a log line", not a red exit
   that breaks automation. The freshness stamps in the ledger make staleness
   visible either way.
5. **License?** We consume two public feeds (RSS + JSON), not code; no
   vendoring. Recorded in the report header.

## Code Verification Evidence

- [x] Implementation matches Proposed Solution steps 1-6
- [x] RED-first pin suite observed failing before the implementation files existed (structured import error), and caught 2 real defects on first GREEN run
- [x] Typecheck/tests/quality pass — see Verification Receipt
- [x] LIVE probe artifacts retained (dev/scratchpad/active/custats-offers-probe.ts); LIVE harvest run completed end-to-end (ledger + report written)
- [x] Status reflects reality

## Lessons Learned

1. **Fixture fidelity is a contract, not a convenience.** The "malformed
   row" fixture still carried a valid `id`, so the parser correctly accepted
   it and the pin failed — the fixture was lying about the contract it
   claimed to test. The fix was to the fixture, not the parser.
2. **Prose names brands, not hosts.** "Vercel AI Gateway" contains no
   domain; a host-literal-only matcher silently drops it. Brand-label
   tokens (second-to-last domain label, ≥3 chars, non-generic) recover
   these — while short labels (`z` in "Z AI") stay unattributed by design,
   because a 1-char match rule is a false-positive machine.
3. **Soft-skip beats hard-fail for optional sources.** A single-operator
   feed going stale must degrade to a log line and last-good state, not a
   red exit that breaks automation built on the command.

## Resolution

- **Resolved by:** this record — steps 1-6 implemented in full; LIVE harvest
  verified end-to-end (43 attributed / 44 unattributed / 1 expiring soon;
  models leg 161 rows, 0 new, 31 archived).
- **Resolution date:** 2026-09-28
- **Verified by:** `bun run fid:verify --write` (18/18 pin suite + quality
  LIVE at stamp; `typecheck:scripts` leg green in the repo-wide typecheck) +
  LIVE dual-feed harvest run.
- **Verification date:** 2026-09-28
- **Verification receipt:** see `### Verification Receipt` below.
- **Closed by:** operator session directive implementing the shelf item's
  re-activation trigger; closure commit hash pending (G2) — recorded at push.
- **Close date:** 2026-09-28
- **Archived:** yes — moved to `dev/fids/archive/` on close.
- **CHANGELOG entry:** yes — under 0.0.34.
