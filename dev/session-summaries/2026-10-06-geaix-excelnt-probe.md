# Session Summary: 2026-10-06 — Geaix/Excelnt provider probe stage

**Session ID:** 2026-10-06-geaix-excelnt-probe
**Duration:** 2026-10-06 01:07 (local) — open
**Status:** active

---

## Initial State

### Environment

- **OS:** Windows 11 (win32); single-agent session (ECHO v0.1.2-single-agent,
  `strict_mode: true`, autonomy level 3)
- **Language/Runtime:** TypeScript monorepo, Bun 1.3.14
- **Branch:** main — 57 commits ahead of `origin/main`; working tree clean at
  intake
- **Active FID queue:** empty (`dev/fids/` holds only `README.md`; 483 records
  archived)
- **Gates at intake:** `bun run validate:repository` PASS (run live)

### Task intake (operator instruction, verbatim)

"i need to test a new provider. https://excelnt.ai/dashboard, make a blank
section for the key, then i want to probe it before proceeding"

Corrections received in-session (verbatim):

- "actually i told you the wrong page, the correct provider is
  https://geaix.com/dashboard"
- "actually, i think i got the process wrong, the page is telling me that they
  are sent via request? Look, i have 2 providers" — with both gateways'
  API-key dashboards pasted
- "that was my entire point, the first request should provide the key for you"

### Provider state observed (operator dashboard text, 2026-10-06)

- **Geaix** — `https://geaix.com/v1`, `GEAIX_API_KEY`, Power plan (25 active
  keys; plan ends 2027-01-04), **0/25 active keys ("No keys yet")**, 0
  requests today.
- **Excelnt** — `https://excelnt.ai/v1`, `EXCELNT_API_KEY`, Starter plan (1
  active key; plan ends 2026-10-13), **0/1 active** — the single key
  (`sk_live_…`, created 2026-10-06) is revoked; 2 requests recorded
  2026-10-06 02:14 UTC.
- Both: "Keys are issued in the VS Code extension", the secret is shown once
  at creation, and requests authenticate with `Authorization: Bearer`.

## Interpreted Scope (Law 2 recorded presentation — registered as T146/T147)

1. **T146 (automation level 3):** blank key sections for `GEAIX_API_KEY` /
   `EXCELNT_API_KEY`; an unauthenticated boundary probe of both gateways; a
   universal catalog/completion probe script that sends the key as
   `Authorization: Bearer` on its FIRST request whenever a key is available.
2. **T147 (automation level 1):** the keyed live probe (models + one minimal
   completion), then the provider-registry integration. Blocked on the
   operator-minted key.

Routing decision: the probe stage is simple-task route (direct writes +
verification, no FID). The registry integration (new catalogs, window seams,
docs surfaces — well above the FID threshold) runs as a FID when T147 clears.
No production code is written this pass.

## Boundary evidence (live, 2026-10-06)

- `GET /v1/models` **HTTP 200 with NO key** on both gateways — the catalog is
  public. 40 models per gateway at 01:07 and **41 at 01:25** —
  `muse-spark-1.3` appeared between reads, so the roster is live-updating and
  both hosts move in lockstep. The **bodies are byte-identical** (sha256
  `010dff560bb18876c676f4cad96f93dab3d566c2e54f7f5e6d5ed5a73c1e727c`) —
  Geaix and Excelnt are two brands of one backend (plans and key limits
  differ).
- Row shape: `id, object, created, owned_by, display_name, context_window,
  max_output_tokens, pricing{currency: USD, unit: per_1m_tokens, input,
  output, cached_input}`. Windows 200k–1,050,000. Vendors: openai (8),
  anthropic (9), zhipu ai (4), xai (4), alibaba (2), moonshot ai (2),
  tencent (1), deepseek (3), minimax (1), xiaomi (1), stealth (1),
  google (4). Quirk recorded for the integration: the grok-4.5/4.6/4.7 and
  composer-2.5-fast rows carry `max_output_tokens: 0`.
- `POST /v1/chat/completions` **without** a key → HTTP 401
  `{"code":"missing_api_key"}` ("Send it as \"Authorization: Bearer
  sk_live_…\"") — completions are key-gated; this is not an open relay.
- Key management: `GET /api/keys` → 401 `{"error":"Sign in to manage keys."}`
  (dashboard-session auth); `/v1/keys` and `/api/v1/keys` → 404. A key can
  only be minted by the signed-in account (VS Code extension / dashboard
  session), never by the gateway key itself. The app shell's brand config
  confirms `keyPrefix: sk_live_`, `envVarKey: GEAIX_API_KEY`,
  `envVarUrl: GEAIX_BASE_URL`, `apiBaseUrl: https://geaix.com/v1`.

## Planned Work

1. [x] Boundary probe of both gateways (read-only; evidence above)
2. [x] Blank key sections in `.env.example` (hand-maintained block outside the
       generated markers)
3. [x] `dev/scratchpad/active/gateway-catalog-probe.ts` — catalog probe plus
       opt-in single completion, key sent on request #1
4. [x] Verify: probe script runs (catalog legs + no-key failure path) +
       `bun run validate:repository`
5. [x] Report and hold for the operator-minted key (T147)

## Work Completed

### T146 — probe stage (2026-10-06)

- Blank key sections added to `.env.example` as a hand-maintained block
  outside the generated markers (`GEAIX_API_KEY=` / `EXCELNT_API_KEY=`, both
  blank). Live secrets go in `.env.local` only — the harness blocks agent
  reads of that file, so the key never enters this record.
- `dev/scratchpad/active/gateway-catalog-probe.ts` created — one universal
  probe for both gateways. Key resolution order:
  `~/.savant-code/credentials.json` (`providerApiKeys`) → environment. Every
  request carries `Authorization: Bearer` whenever a key is present, so
  request #1 is already authenticated; the key is never printed. `--chat
  <model-id>` sends exactly one minimal completion request.
- Register updated: T146 completed; T147 registered, blocked on the
  operator-minted key.

## Validation Results

- `bun dev/scratchpad/active/gateway-catalog-probe.ts geaix` → HTTP 200
  (auth: none), 41 rows, **exit 0** (clean, unpiped)
- `bun dev/scratchpad/active/gateway-catalog-probe.ts excelnt` → HTTP 200,
  **exit 0** (clean, unpiped)
- `bun dev/scratchpad/active/gateway-catalog-probe.ts excelnt --chat
  gpt-5.6-sol` → catalog leg 200, then `NO KEY: EXCELNT_API_KEY not present
  in env or ~/.savant-code/credentials.json — --chat cannot run`, **exit 1**
  (the designed no-key failure path)
- `bun x eslint dev/scratchpad/active/gateway-catalog-probe.ts
  --no-warn-ignored --max-warnings 0` → **exit 0** (the file matches an
  eslint ignore pattern, i.e. outside lint scope; no real findings)
- `bunx prettier --check SCOPE.md dev/session-summaries/2026-10-06-geaix-excelnt-probe.md`
  → clean
- `bun run lint:md` → **exit 0**
- `bun run validate:repository` → **PASS**

## Open Questions / Blockers

- **T147 blocker:** no active key exists on either account (Geaix 0/25; the
  Excelnt key is revoked). Keys are minted in the vendors' VS Code extension
  and shown once at creation; `/api/keys` is session-gated and `.env.local` is
  agent-read-blocked by the harness, so the operator places the key on the
  blank line (or provides it directly). The keyed probe then runs before any
  integration work, per "then i want to probe it before proceeding".
- Blocker progression 2026-10-06: both vendor extensions installed into
  Cursor (`excelnt.excelnt` 1.0.20, `geaix.geaix` 1.0.20 via the vendors'
  `install.ps1`, checksums ok). Extension UI map established from the
  installed bundle: sign-in does NOT mint a key — the key is created
  explicitly in the Account view → "API keys" tab → name + Create (secret
  shown once at creation; "API keys are stored securely in VSCode's Secret
  Storage"). Remaining operator steps: create the key there → place it on
  the `GEAIX_API_KEY=` line in `.env.local`.
- Blocker update 2026-10-06 (operator report): key creation is REFUSED —
  the operator cannot create a new key despite 0/1 active (the only key,
  `sk_live_…` named "dead", is revoked). Account state (operator dashboard):
  Balance $600.00 intact, spend today $0.79 ($0.51 GPT 6 Astra + $0.29
  Claude Opus 5.5 at 02:12-02:14 UTC), Starter plan expires 2026-10-13 —
  the expiry is the real pressure on the granted balance, not a spent loss.
  Leading theories: (a) the web "Create key" button only points at the
  extension; (b) the Excelnt extension install is damaged
  (operator-reported); (c) the revoked key still occupies the single Starter
  key slot (revoked != deleted). Candidate unblocks presented: delete the
  "dead" key, reinstall the extension, or mint the key on Geaix (Power plan,
  25 slots, 0 keys, byte-identical backend) to unblock the integration while
  the Excelnt balance question goes to vendor support.
