# Gemini Deep Research brief — free-compute harvester for savant-code

**Status:** research prep (no code). Output of this research feeds the FID for
the freeairouter feed→proposal pipeline (daily cadence is already an operator
constraint: churn in this space is high enough that weekly is too slow).
**Usage:** paste everything below the line into Gemini Deep Research. When it
returns, save the report as `dev/research/freeairouter-deep-research-<date>.md`
and cite it in the FID's Evidence section.

---

## Research mission

I maintain **savant-code**, an open-source AI coding agent (TypeScript/Bun
monorepo) whose users configure LLM providers — including "gateway" providers
with curated free tiers. Adding a provider today is a manually-curated,
audited process (static allowlist catalog: registry entry, model list with
vendor-published context windows, closed-world test pins, docs). I want to
build a pipeline that **automatically discovers new free-compute providers
from public feeds, verifies them, and drafts integration proposals for human
approval — daily**. Before building it, I need deep research on the source,
the landscape, and the verification problem.

## Primary source under evaluation

**freeairouter.com** — "free LLM API radar", 214 sites / 9 pages. Verified
facts from my own probing (treat as ground truth, verify the rest):

- Open data feed: `https://freeairouter.com/data/sites.json` (3.3 MB,
  `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=300`,
  probed daily, `Last-Modified` same-day). robots.txt: `Allow: /` for all
  agents except `/go` redirect links. No published ToS/privacy page.
- Record shape: `card.{host, url, name, kind, platform, category,
  categoryConfirmed, status, discoveredFrom, firstSeenAt, lastProbedAt,
  freeQuota, freeQuota_en, freeModels[], freeModels_en[], probe.{reachable,
  latencyMs, modelsCount, modelsPublic, signupOpen, quotaHint}}` plus a
  `probes[]` history array (daily rows) and `report`/`analysis` fields.
- Categories observed: `official-free-tier`, `commercial-aggregator`,
  `first-party-free`, `unknown`; statuses: `up`/`down`.
- Provenance: entries carry `discoveredFrom: "for-the-zero/Free-LLM-Collection"`
  (GitHub, 562★, active).

## Research questions (answer each, with evidence)

### A. Source trust & sustainability
1. Who operates freeairouter.com? Any signal on funding, longevity, update
   cadence history (check Wayback Machine snapshots — has the dataset been
   continuous? gaps?), or editorial policy behind the 0–100 scores and
   "risk review" pages (`/s/<domain>`)?
2. Is the `data/sites.json` feed documented anywhere as a public API? Any
   sign the operator objects to automated consumption (issues, changelogs,
   community posts)? Wayback-history of robots.txt?
3. How does freeairouter actually **verify** entries — do they call
   `/v1/models`, probe signup pages, read quota docs, or aggregate human
   reports? What does `analysis`/`report` contain when populated?
4. Failure modes: how often do entries flip up↔down? Any known incidents of
   the directory listing a malicious/typosquat endpoint? (I already found
   `api.celebras.ai` — lookalike of cerebras.ai, `categoryConfirmed: false`,
   down — quantify how common this class is.)

### B. Landscape & comparison universe
5. Build the comparison table of **all** maintained public trackers of
   free-LLM access (at minimum: freeairouter.com,
   cheahjs/free-llm-api-resources, zukixa/cool-ai-stuff,
   for-the-zero/Free-LLM-Collection, the ~2-dozen "free API" Discords/telegrams
   if documented). For each: machine-readable feed? update cadence?
   verification method? license?
6. Which of these publish **daily-updated machine-readable data** suitable as
   a second/third feed for a harvester that must run daily (churn is high)?
   Rank them as feed candidates.
7. Churn rate: find any data or community reports on how many free
   providers/endpoints appear and die per week in 2025–2026. I need this to
   justify daily polling and to size the dead-entry pruning policy.

### C. Per-provider verification problem (the core question)
8. For a candidate discovered via such a feed, what is the **minimum
   evidence bundle** to consider it safe for a human to consider adding?
   Establish best practice for: endpoint reachability checks, `/v1/models`
   introspection, quota verification from official docs, ToS data-training
   clauses, KYC/phone-verification requirements, domain-provenance checks
   (typosquat detection), and community reputation cross-checks.
9. Which free-tier providers in 2026 require **data-for-training consent** as
   a condition of free access (e.g. Mistral Experiment is known — find the
   full current list)? Which are explicitly no-KYC / no-phone? Which allow
   coding-agent workloads (high tokens/min) vs. only chat-scale quotas?
10. Legal/ToS posture: any documented cases of providers banning automated
    catalog harvesting of *their own* free tiers, or of aggregator sites
    receiving takedowns? What should my pipeline's user-agent / polling
    etiquette be (well-behaved harvester standards for this niche)?

### D. Integration-fit
11. My gateways are OpenAI-compatible (`/v1/chat/completions`,
    `/v1/models`). From the freeairouter dataset's `platform`/`kind` fields
    and the wider landscape: what share of free-tier providers are
    OpenAI-compatible vs. protocol-specific (Codex/Responses-only, Anthropic
    native, etc.)? Which protocol-specific ones are worth a shim?
12. Recommend the evidence bundle + gate criteria you'd use to auto-draft a
    proposal for a new gateway provider, tuned for **daily** cadence with a
    human approve step and zero auto-merge.

## Output format (follow exactly — this feeds a machine pipeline)

1. **Executive summary** (≤ 400 words): verdict on freeairouter as the
   primary feed + the top-3 risks + the recommended feed stack.
2. **Source dossier** (A questions).
3. **Comparison table** (B5) and **feed ranking** (B6) with churn data (B7).
4. **Verification protocol** (C8–C10) — concrete, implementable checks with
   pass/fail thresholds.
5. **Integration-fit findings** (D11–D12).
6. **Per-provider appendix**: for the **top 15 high-confidence free providers**
   found across all sources, one block each with exactly these fields:
   `Provider | Endpoint base URL | OpenAI-compatible (y/n) | Free tier shape
   (quota + rate limits) | Context windows of free models | KYC/data-training
   caveats | Evidence (URL + date) | Confidence (high/med/low)`.
7. **JSON appendix**: the same top-15 list as a JSON array with those field
   names as keys (no commentary inside).

Cite every non-obvious claim with a URL and its access date. If something is
unverifiable, say so explicitly rather than guessing — a confident wrong claim
about a provider's data practices is worse than an admitted gap. Do not
include referral/affiliate links. Write in English.
