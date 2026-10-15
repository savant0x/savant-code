# Deep Research report — adversarial verification record

**Companion to:** `Free LLM API Aggregator Research.md` (Gemini Deep Research,
2026-09-14). **Method:** every load-bearing claim re-tested against primary
sources (GitHub API, direct HTTP probes, arXiv) on 2026-09-14. Verdict per
claim: CONFIRMED / PARTIAL / REFUTED / UNVERIFIED.

## Why this matters

The report is strong on threat analysis but weak on source longevity — the
exact failure mode it warns about. One of its three architectural pillars did
not survive verification. The FID must be built on the corrected stack below,
not the report's.

## Claim-by-claim

| # | Report claim | Verdict | Evidence (checked 2026-09-14) |
|---|---|---|---|
| 1 | freeairouter `data/sites.json` is an open, daily, machine-readable feed | **CONFIRMED** | Direct probes: `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=300`, 3.3 MB, per-record `lastProbedAt` same-day; robots.txt `Allow: /` except `/go` |
| 2 | freeairouter discovers from `for-the-zero/Free-LLM-Collection` (562★) | **CONFIRMED** | GitHub API: 562 stars, pushed 2026-08-30; `discoveredFrom` present in feed records |
| 3 | LLMjacking measurement study "Your Agent Is Mine" (428 routers; 26 injecting, 17 harvesting credentials) | **CONFIRMED** (real paper; figures accepted from paper HTML) | arXiv `2604.08407` resolves with exact title. The 26/17 numbers are cited to the paper's own measurement — adoptable with the citation attached |
| 4 | `api.celebras.ai` typosquat present in the raw feed | **CONFIRMED** (first-hand, pre-research) | Found in `sites.json` before the research ran: `categoryConfirmed: false`, status `down` — the feed lists it anyway |
| 5 | `cheahjs/free-llm-api-resources` = PRIMARY ground-truth feed, 29.4k★, strict inclusion criteria | **REFUTED — repo is gone** | `gh api repos/cheahjs/free-llm-api-resources` → **404** today. Owner exists (117 repos, none matching; recent pushes are unrelated GW2 addons). Zombie artifacts persist: Mintlify docs site + star-history page (what the crawler saw). A third party re-uploaded a copy 2026-05-05 (`Solrac28276/https-github.com-cheahjs-free-llm-api-resources`, 7★, `fork: false`) |
| 6 | freeairouter syncs quotas daily from cheahjs | **PARTIAL / now questionable** | If the upstream died, the sync either points at a dead source, a rename, or has degraded. Consequence: **do not treat freeairouter's quota text as authoritative** — discovery + liveness only |
| 7 | `zukixa/cool-ai-stuff` = tertiary metadata layer, updated "weekly to daily" | **PARTIAL — stale** | Repo real (1,212★) but **last push 2025-10-15 (~11 months dead)**. Usable only as a static capability-matrix reference, never a live feed |
| 8 | OpenRouter free tier = 30 RPM / 500 req/day | **CONFLICTED** | freeairouter's own rendering (read directly this session) says ~20 req/min, 50/day under 10 credits, 1000/day at ≥10 credits. Report cites OpenRouter's data-api docs page (not the quota page). Quota figures need per-provider primary-source checks at harvest time |
| 9 | GitHub Models endpoint `models.inference.ai.azure.com` | **STALE** | Cited to a 2024 blog; GitHub Models migrated to `models.github.ai`. Whatever the pipeline adopts must come from vendor docs fetched at run time, not research snapshots |
| 10 | Google AI Studio free tier 15 RPM / 1M TPM / 1500 RPD; 1M–2M context; training consent on free tier | **PLAUSIBLE / UNVERIFIED here** | `ai.google.dev` terms not fetched this session. The *training-consent* claim matches widely reported policy; the numbers change frequently — re-verify at harvest |
| 11 | Per-provider appendix (15 providers) quota/limit figures | **MIXED provenance** | Only Groq (console docs) and Google (ai.google.dev) cite vendor-primary pages. SambaNova ← slideshare, Cloudflare/HF ← third-party blogs, Mistral ← puter.com tutorial. Treat the table as a **candidate seed list**, not evidence |

## Corrected architecture (what the FID should specify)

The report's tripartite consensus is the right *shape*; two of its three
pillars need replacement:

1. **Discovery + daily liveness telemetry: freeairouter `sites.json`** — its
   genuine, verified strength (daily probes, uptime history, latency,
   reachability). Never authoritative for quotas or safety.
2. **Ground truth for every concrete fact: the vendor's own surface** —
   fetched live at harvest time: `/v1/models` for the model list, official
   docs for quotas, ToS for the data-training posture. Directory text is a
   *lead*, never evidence.
3. **Cross-check layer: replace the dead/stale repositories.** cheahjs
   survives only as (a) the preserved re-upload and/or (b) its Mintlify docs
   (open question for the FID: are the docs still maintained? if yes, the
   *docs* may be the canonical successor). zukixa is a static reference
   matrix. Practical substitute for liveness cross-checking: our own daily
   probe results (the pipeline itself becomes the second opinion after the
   first run).
4. **Hard gates (adopted verbatim from the report, now first-party-enforced):**
   Levenshtein typosquat screen vs. the top-100 known AI vendor domains
   (hard fail, distance ≤ 2); TLS-to-official-domain validation; 401-required
   on generation endpoints; ≥ 8,192-token context floor; training-consent
   detection flags a HIGH-RISK banner requiring explicit operator override;
   anonymous relays / unregistered-ASN aggregators denylisted; zero
   auto-merge, human approval mandatory.
5. **Daily cadence:** justified by the report's churn evidence (48-hour
   appearance/disappearance windows, dead-endpoint economics) plus
   freeairouter's own daily probe cadence. Operator constraint already
   locked.
6. **Etiquette (adopted):** transparent User-Agent
   `SavantCode-DiscoveryBot/1.0 (+https://github.com/<org>/savant-code)`,
   respect robots.txt, once-daily poll in off-peak UTC, exponential backoff,
   never evade blocks.

## Open questions for the FID

- Is the cheahjs Mintlify docs site still maintained (content dates)? If yes,
  it may be the surviving canonical source for the seed list.
- Wayback continuity of freeairouter's dataset (rate-limited this session —
  retry later; non-blocking).
- Per-provider primary-source quota re-verification happens at harvest time,
  so stale appendix figures are acceptable as seeds only.

## Bottom line

**Adoptable now:** the verification protocol, gate criteria, threat model
(LLMjacking measurements + typosquat class), etiquette, and daily cadence.
**Refuted and replaced:** cheahjs as primary feed (dead) — vendor-primary
ground truth + freeairouter telemetry instead. **Demoted:** zukixa (stale) and
the report's quota appendix (seed-only, tertiary-sourced).
