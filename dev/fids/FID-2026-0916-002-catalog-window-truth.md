# FID: Catalog window truth for the pre-program static providers + dead-channel hygiene

**Filename:** `FID-2026-0916-002-catalog-window-truth.md`
**ID:** FID-2026-0916-002
**Severity:** medium
**Status:** fixed
**Created:** 2026-09-16 (operator report: tokenharbor deepseek-v4-flash
showed 131k; orcarouter glm-5.3-flash-free rejected a long prompt with a
vendor free-tier cap error; tokenrouter glm-5.2-free returned "No available
channel"; operator: "i thought we fixed the low windows for all models?")

## Summary

The earlier context-window fix program (the vendor fallback table in
`common/src/constants/context-windows.ts`) covered only the providers
integrated through it — unorouter, bazaarlink, infron, tokenbom, hcnsec
(+ one cloudflare row). **Four static-catalog providers predate the
program and were never migrated**: tokenrouter (35 curated ids),
tokenharbor (20), commandcode (~30), opencode-go (15). Their CLI catalog
fetchers still call `inferContextLength(name)` — the family heuristic —
so `tokenharbor/deepseek-v4-flash` displays 131,072 when the upstream
model's vendor-published window is 1,048,576 (measured on two
independent keyed rosters, 2026-09-16). The operator's "we fixed the low
windows" belief was true for 5 of 9 static/curated providers; this FID
makes it true for all.

Second: TokenRouter's curated catalog carries dead channels —
`z-ai/glm-5.2-free` (operator-reported 503 + LIVE re-confirmed) and
`z-ai/glm-5.3-free` (LIVE 503, same "No available channel … group
default (distributor)" error) — plus 3 curated ids absent from the
keyed 133-row roster (`MiniMax-M3`, `openai/gpt-5.3-codex`,
`miromind/mirothinker-1-7-deepresearch`) that must be LIVE-verified
before removal.

Third: OrcaRouter's free-tier channels (`*-free`, `orcarouter/free`,
`orcarouter/auto`) publish NO `context_length` in the vendor's own
roster (honest), but enforce an unpublished free-tier input cap — the
operator measured a block on glm-5.3-flash-free with a "Shorten it, or
add credits" error (vendor text; bisect today was capacity-blocked
404). Our catalog must keep rendering those windows as unknown (—),
never heuristic-fill them, and the vendor cap gets documented.

## Problem Statement

The picker teaches the operator false context budgets (131k shown for a
1M model → prompts sized wrong), offers dead channels (select → 503),
and the only honest row in the orcarouter story (no published window)
must stay honest while the vendor cap is recorded.

## Scope Boundary

Window rows + fetcher wiring for the four missed static providers;
dead-channel removals in tokenrouter's catalog with the evidence rule
below; orcarouter documentation note. NO gate logic changes, no registry
entry changes, no live-catalog parse changes (orcarouter's undefined-ctx
rows already stay undefined), no new UI surfaces.

## Operator Rulings (2026-09-16, mid-loop amendments)

1. **Codex id** — "Fix protocol in this FID": TOKENROUTER_PROTOCOLS +
   registry wiring landed here (Scope Boundary amended accordingly — the
   registry entry change IS in scope). Grounding then widened the fix far
   beyond codex: the vendor roster's `supported_endpoint_types` proves
   6 Responses-only ids, 7 Anthropic-only, 1 Gemini-only, 1 image-only.
2. **OrcaRouter paid rows** — "This harness is a public release, we are not
   cutting paid model access." No catalog filtering. The operator also
   reported 402-style errors **on free models** — verified LIVE: the
   vendor's free-tier **prompt cap** (measured between ~12k and ~36k input
   tokens) rejects long prompts on `*-free` channels with the misleading
   "Shorten it, or add credits" text. Tiny-prompt probes had masked this.
   Resolution: docs note with the measured bound; catalog untouched.
3. **OpenRouter "User not found"** — operator: "i added a new key … it
   still happens with a fresh key too." Verified: the stored key 401'd at
   first probe, then validated HTTP 200 minutes later (key replaced
   mid-session); stored-key fingerprint equals the `.env.local` value, and
   `applyPersistedProviderApiKeys` + the resolver's process-lifetime cache
   mean a replaced key needs a CLI restart. Resolution: docs note (rotation
   + restart); no code change.
4. **MQ3 rule vindicated LIVE** — `MiniMax-M3` (absent from the keyed
   roster) returned HTTP 200 to a keyed chat call: roster absence ≠ dead.
   Removed only the three ids that failed a keyed call (both free GLMs,
   mirothinker) plus image-only seedream.

## Implementation

- **Fallback table**: 94 exact-id rows added to
  `CONTEXT_WINDOW_FALLBACKS` for tokenrouter (31), tokenharbor (20),
  opencode-go (15), commandcode (28). Sources: bazaarlink + orcarouter
  keyed rosters (2026-09-16), OpenRouter public catalog as tiebreak;
  2-of-3 vendor votes marked inline (glm-5.2 → 1,048,576; qwen3.6-plus →
  1,000,000; glm-5.1 → 204,800). `tokenharbor/th-orchestra` pinned at the
  conservative default 200,000, flagged NEEDS-REVIEW (no vendor window
  published for the ensemble router).
- **Fetcher wiring**: all four static-catalog fetchers switched from
  `inferContextLength(name)` to `getContextWindowFallback(id)`.
  `inferContextLength` is now deprecated with zero production callers in
  the static catalogs.
- **Dead channels**: tokenrouter catalog 35 → 31 ids (removed
  `z-ai/glm-5.2-free`, `z-ai/glm-5.3-free`,
  `miromind/mirothinker-1-7-deepresearch` — keyed 503s; and
  `bytedance-seed/seedream-5.0-pro` — vendor `image-generation`-only).
  Display-name map pruned in step.
- **Protocol fix (operator-approved scope amendment)**: new
  `TOKENROUTER_PROTOCOLS` map (vendor `supported_endpoint_types`,
  2026-09-16) registered in `PROVIDER_PROTOCOL_MAPS`; union member added
  to `ProviderProtocolMap`; registry entry `protocol: 'openai'` →
  `'multi'` + `protocolMap: 'TOKENROUTER_PROTOCOLS'`. The Responses-only
  GPT family (codex 404 "Use the v1/responses endpoint instead"), the
  Anthropic-only Claude family, and the Gemini-only id now dispatch
  correctly; the SDK factory's fail-closed `resolveProtocol` covers every
  surviving id (pinned).
- **Pins (RED-first)**: `cli/src/utils/openrouter-models/__tests__/
  window-truth.test.ts` — 19 tests: closed-world table-coverage
  invariant over all four catalogs (this gap class cannot silently
  reopen), spot windows incl. the operator-reported 131k→1,048,576 fix,
  2-of-3 conflict rows, dead-id absence, MiniMax-M3 kept, protocol-map
  dispatch. The pins caught a real draft defect mid-loop: the
  `mirothinker` catalog entry survived the first edit pass with only a
  comment claiming its removal.
- **Superseded pin**: FID-2026-0914-002's byte-parity exit criterion
  (heuristic estimates frozen) is explicitly superseded in
  `context-window-fallbacks.test.ts` — the fetcher-wiring invariant now
  asserts `getContextWindowFallback(id)` resolution.
- **Docs**: OrcaRouter free-tier cap note and OpenRouter key-rotation +
  restart note added to `docs/installation.md` (provider table).

## Perfection Loop

### Missed Questions

- **MQ1 — window source of truth:** vendor-published `context_length`
  from keyed LIVE rosters pulled 2026-09-16 — bazaarlink's keyed roster
  for shared upstreams (deepseek-v4-flash 1,048,576; deepseek-v4-pro
  1,048,576; deepseek-v3.2 163,840; glm-5.2 1,048,576; glm-5.1 204,800;
  kimi-k3 1,048,576; kimi-k2.6/k2.7-code 262,144; minimax-m3
  1,048,576; mimo-v2.5-pro 1,050,000; qwen3.5-397b-a17b/122b-a10b
  262,144; qwen3.7-max/plus 1,000,000; gpt-5.3-codex 400,000; the
  claude/gpt-5.6/qwen3.8 flagships as on the bazaarlink rows) and
  orcarouter's keyed roster for variants it carries (claude fast
  variants, glm-4.7/5/5.3, grok-4.5, gemini-3.6-flash, nemotron,
  mirothinker, seedream, minimax-m2.7). Two independent vendors
  publishing the same upstream window (e.g. deepseek-v4-flash) is the
  cross-check. Models neither roster carries keep their current curated
  value ONLY if a vendor doc pins it; otherwise the table row uses the
  most conservative defensible value and the FID names it.
- **MQ2 — wiring:** the four static fetchers switch from
  `inferContextLength(...)` to the bazaarlink pattern —
  `getContextWindowFallback(id).contextWindow` (vendor table first,
  heuristic only as last-resort for future ids). A pin enforces the
  invariant: **every curated static id must have a vendor fallback
  table row** (closed-world: static ids ∖ table rows = ∅), so this
  gap class cannot silently reopen when the next provider is added.
- **MQ3 — dead-channel rule:** remove a curated tokenrouter id when a
  keyed chat call returns 503 "No available channel" (channel gate,
  not listing — glm-5.3-free proves listing ≠ alive) OR when the id is
  absent from the keyed roster AND the LIVE call confirms non-existence.
  Each removal is LIVE-verified at GREEN before the catalog edit; the
  two already-confirmed channels (glm-5.2-free, glm-5.3-free) ship with
  today's evidence.
- **MQ4 — orcarouter free cap:** no catalog change (undefined ctx stays
  undefined — the one honest display); the vendor's unpublished
  free-tier input cap (operator-measured block on glm-5.3-flash-free)
  is recorded in the FID + provider docs note. Measuring the exact cap
  is out of scope (capacity-blocked today); the vendor error text is
  the citation.
- **MQ5 — gates:** typecheck ×2 (cli, common), the static-catalogs
  suite, a new window-truth pin test (fallback-table coverage
  invariant + spot windows incl. tokenharbor/deepseek-v4-flash =
  1,048,576 and the dead ids' absence), and a LIVE probe gate — a
  small `bun` script that re-pulls the two keyed rosters and asserts
  every static-catalog id's table window matches the vendor payload
  (drift alarm for the future).

### Code Verification Evidence

- `cli/src/utils/openrouter-models/static-catalogs.ts` lines 143/164/
  181/198 — four fetchers call `inferContextLength(name or id)`; the
  vendor fallback table (`common/src/constants/context-windows.ts`)
  carries zero `tokenharbor/`, `tokenrouter/`, `commandcode/`,
  `opencode-go/` rows (coverage grep 2026-09-16: 17 unorouter, 12
  bazaarlink, 9 infron, 7 tokenbom, 7 hcnsec, 1 cloudflare).
- Keyed LIVE (2026-09-16, key never printed): bazaarlink roster —
  deepseek-v4-flash `context_length: 1048576`; orcarouter roster —
  `deepseek/deepseek-v4-flash` ctx 1048576, `z-ai/glm-5.3-flash` ctx
  1,000,000, all `*-free` rows ctx undefined.
- TokenRouter keyed: 136-row roster; curated `z-ai/glm-5.2-free` and
  `z-ai/glm-5.3-free` → HTTP 503 "No available channel for model …
  under group default (distributor)"; 5 curated ids absent from the
  roster (listed above).
- Operator report: orcarouter glm-5.3-flash-free rejected a long prompt
  with the vendor's free-tier cap message (request id
  202609160300041771159568268d9d65hGslkrK).

## Verification Gates

- gate: typecheck cli
- gate: typecheck common
- gate: test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts
- gate: test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts
- gate: test cli/src/utils/__tests__/context-window-fallbacks.test.ts
- gate: probe scripts/providers/verify-window-truth.ts

### Verification Receipt

- fingerprint: sha256:1af6e8a70b333172bc7393cb923f6db6068a4721562e1e5659ce83178278b692
- verified: 2026-09-16T04:21:46.214Z
- typecheck cli: exit 0
- typecheck common: exit 0
- test cli/src/utils/openrouter-models/__tests__/static-catalogs.test.ts: exit 0
- test cli/src/utils/openrouter-models/__tests__/window-truth.test.ts: exit 0
- test cli/src/utils/__tests__/context-window-fallbacks.test.ts: exit 0
- probe scripts/providers/verify-window-truth.ts: exit 0

## Lessons Learned

- Tiny probes lie: a 16-token probe returned 200 and masked the vendor's
  free-tier prompt cap; production-shaped payloads (~36k tokens)
  reproduced the operator's error immediately. Probe with real sizes.
- Roster absence ≠ dead: `MiniMax-M3` was absent from the keyed roster
  yet served HTTP 200. Channel state lags listings — verify by call.
- Vendor endpoint metadata is protocol truth: `supported_endpoint_types`
  revealed 15 mis-dispatched ids where family naming implied otherwise.
- Parity pins are per-FID exit criteria, not forever laws; supersedement
  must be explicit and traceable to the new mandate.
