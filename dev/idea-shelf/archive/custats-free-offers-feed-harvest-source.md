<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Idea-Farm — custats free-offer feeds as harness harvest sources

**Logged:** 2026-09-28
**Status:** SHELVED — Spencer surfaced the site and stated the intent directly: "another live endpoint+rss feed i can build into the harness for the same free inference system we built a week or two ago... it'll just be plugged into the harness via the free routing system that tracks all of the providers." Endpoints probed live 2026-09-28 (see Verified surface). NOT yet a FID. Re-activation trigger at bottom.
**Source (verify + link — MANDATORY per standing rule):**

- Offers board (the one Spencer linked): https://freetokens.custats.info/?category=coding
- Sibling model catalog: https://free-llm-models.custats.info/
- Catalog upstream repo (JSON is reproducible, not just scrapeable): https://github.com/luongnv89/free-llm-models
- Upstream RSS standard for feed consumption: https://www.rssboard.org/rss-specification
- Local Hermes mirror of the same feed-reading doctrine: skill `rss-feeds` (discover/feed read without a browser)

## What it is

One operator (luongnv89) runs a two-site machine-readiness stack, both refreshed near-daily and both with explicit agent-facing surfaces:

1. **freetokens.custats.info** — "Free AI Credits": 196 live free-credit/trial offers, tagged `verified` / `under review` / `unverified`, with sign-up requirement, category (API providers, Coding, Image, Voice, Video, Startup, Student), expiry dates, and per-offer detail pages. Refreshed "a few times a day"; `lastBuildDate` visible in-feed.
2. **free-llm-models.custats.info** — 161 currently-free LLMs across OpenRouter, Groq, Cerebras, Google AI Studio, Hugging Face, NVIDIA NIM, refreshed from provider APIs, in OpenRouter's own catalog schema.

## Verified surface (probed live 2026-09-28 via curl, HTTP codes recorded)

| Endpoint | Status | Content |
|---|---|---|
| `GET https://freetokens.custats.info/feed` | 200, 89,831B, `application/xml` | RSS 2.0 — ALL 196 offers as `<item>`: title, permaLink guid (offer detail page), description carrying terms + `Category · ongoing/expiring` label, pubDate |
| `GET https://freetokens.custats.info/llms.txt` | 200 | top-20 newest-verified summary for agents |
| `GET https://freetokens.custats.info/sitemap.xml` | 200, 31KB | every offer's detail page (`/offers/<slug>.html`) |
| `GET https://freetokens.custats.info/api/offers` | 404 | no JSON API for offers — RSS + sitemap ARE the API |
| `GET https://free-llm-models.custats.info/free_models.json` | 200, 179KB | **the gem** — `{fetchedAt, totalModels, newModelIds, models[161], archivedModels, providers}`. Per model: `id`, `context_length`, `pricing` (zeros), `architecture.modality`, `input/output_modalities`, `supported_parameters` (tools/reasoning/...), `per_request_limits`, `expiration_date`, `addedToFreeList`, `links` |
| `GET https://free-llm-models.custats.info/.well-known/agent-skills/index.json` | 200 | skills-discovery doc w/ sha256 digests pointing at `free_models.json` |
| `GET https://free-llm-models.custats.info/.well-known/api-catalog` | 200 | RFC 9727 linkset (service-desc = the JSON, service-doc = GitHub repo) |
| `GET https://free-llm-models.custats.info/.well-known/mcp/server-card.json` | 200 | live MCP server: streamable-HTTP at `https://free-llm-models.custats.info/mcp` — model catalog browse/search tools |
| `GET https://free-llm-models.custats.info/llms-full.txt` | 200 | full-context dump for LLMs |
| `GET https://freetokens.custats.info/robots.txt` | 200 | Policy A: search/user-agent retrieval allowed, training crawlers (GPTBot/ClaudeBot) blocked — they know exactly what they're for |

Freshness spot-check: catalog already contained `stealth/space-bunny-alpha` (1M ctx) — the exact model we were testing that same day. Independently corroborates our own probes.

## Portable patterns (3–5, mapped to existing harness machinery)

1. **New harvest adapter, not a new system.** The pipeline exists: `scripts/providers/harvest-freeairouter.ts` + `lib/harvest-phases.ts` + `lib/candidates-io.ts` → candidates → `lib/health-probe.ts`/`probe-pool.ts` → `propose-provider.ts`. The shape of the fix is ONE more source module feeding the same candidate queue (probably `scripts/providers/harvest-custats.ts`): fetch `free_models.json`, diff `newModelIds` against the candidates ledger, emit new candidates with context/params/modalities pre-filled. Zero changes to gates.
2. **`newModelIds` = built-in delta trigger.** Our poll loop currently re-diffs full lists; this feed ships the delta field for free — and `archivedModels` + per-model `expiration_date` give a principled RETIREMENT signal (lanes that went paid/died get dropped automatically instead of rotting in the pool).
3. **RSS `/feed` = the offer layer JSON can't carry.** Expiry windows (Space-Bunny-on-Zen ends Sep 30), trial caps (BigModel 8M/day for 5 days), OSS grants (Claude-for-OSS 6-mo Max, Codex-for-OSS) are TIME events, not model rows. A small feed-leg in the harvest parses `<item>` descriptions for `ends <date>` and surfaces "expiring soon" into the agenda/telemetry instead of the candidate queue.
4. **Third-party attestation slots into confidence scoring.** The board's `verified / under review / unverified` + `checked Xd ago` labels are external evidence our harness doesn't have to generate — usable as one more signal in `propose-guard.ts`/`quality-gauntlet.ts`, never as a substitute for our own live probe. (Doctrine unchanged: feed is INPUT to the pipeline, never the pipeline. RSS content is untrusted data; the gauntlet decides.)
5. **MCP server-card as optional live-query layer.** `/.well-known/mcp/server-card.json` + streamable-HTTP `/mcp` means an agent can ask "what's free WITH tool-support + vision right now" on demand without re-fetching 179KB. Nice-to-have; the JSON pull covers 95%.

## What is NOT portable

- Do not trust catalog completeness for non-Western providers; it mirrors OpenRouter/Groq/Cerebras/HF/NIM — our Freebuff/Kimi/Antseed lanes live elsewhere. This ADDS a source, never replaces existing ones.
- Single-operator bus factor: if luongnv89 stops refreshing, feeds silently stale — mitigated by the `fetchedAt` field (assert freshness ≤48h at harvest time, else skip-cycle + log).
- Offer descriptions are human-curated strings, not schema — parse defensively; anything that can't be parsed becomes a candidate note, never an automated config change.
- License attribution: check the repo license before vendoring any of their scripts (we consume feeds, not code — low risk, but record it).

## Shelf companion

AntSeed P2P dossier (this session): Nova vault `reference/antseed-p2p-inference-intel.md` (C:\Users\spenc\Documents\Obsidian\Vaults\nova-and-mya). Same doctrine, different lane: AntSeed = marketplace to buy INTO cheap; custats = radar that tells us what's free THIS WEEK. The RSS expiry layer would have caught the Space-Bunny/OSS-grant windows days earlier than a human browsing did.

## Re-activation trigger

File when either: (a) the next sprint touches `scripts/providers/` harvest plumbing anyway (cheapest moment to add an adapter), or (b) we miss a promo window that this feed would have flagged (proof the expiry-leg pays for itself), or (c) Spencer opens the free-routing FID he described — "plugged into the harness via the free routing system that tracks all of the providers."
