# Session Summary — 2026-09-19 ~05:30 UTC — FID-2026-0919-016 implemented

> Single-agent ECHO session (solo protocol
> `dev/echo-v0.1.2-single-agent.md`). Operator reported
> `kiosapi/grok-4.6-free` showing a 2000.0k context window while the
> OpenRouter page for `x-ai/grok-4.6` says 500k, then directed
> "fid+perfection loop".

## Root cause (live-proven, `dev/scratchpad/probe-grok-window.ts`)

1. `toCanonicalModelId` (lookup.ts) stripped only
   `tokenrouter|tokenharbor|nvidia/` — `kiosapi/` survived, so the exact
   branches of `findModelFieldFromOpenRouter` could never hit.
2. The version-blind family fallback (first hit in **id-sorted** order;
   openrouter.ts:73 sorts the catalog) reduced the query to family
   `"grok"` and picked `x-ai/grok-4.20` — `"2" < "3"` sorts before the
   real `x-ai/grok-4.6` — borrowing its 2,000,000 window (displayed as
   2000.0k). The repo's own audited pin says 500k
   (`context-windows.ts` tokenbom row; FID-2026-0913-001).
3. `resolveContextWindowSourceForModel` reported the poisoned value as
   `'catalog'` — authoritative-looking. Max-output shared the matcher.

## Fix (FID-2026-0919-016, `verified`)

- Registry-driven `GATEWAY_PREFIX_STRIP_REGEX` from
  `Object.keys(PROVIDER_REGISTRY)` (longest-first) — the hardcoded trio
  had rotted with every gateway added since; future gateways inherit
  correct stripping automatically.
- Exact-version preference in **both** family branches (3 and 3b): the
  candidate whose terminal segment equals the query's (`grok-4.6`) wins
  before sorted-first fallback. First attempt ranked only branch 3 and
  stayed red — branch 3b is the path stripped-vendor ids actually flow
  through (`startsWith('grok')` cannot match `x-ai/grok-4.6`).
- `findGatewayModel` untouched (raw-id gateway catalog; AUDIT).

## Verification

- New suite `openrouter-models-fid-0919-016.test.ts` 7/0 (sorted-grok
  fixture mirrors the live poisoning shape; per-version isolation;
  tokenbom/infron strip pins; legacy trio guard; max-output pin;
  twinless-version fallback; conservative default).
- Sibling openrouter-models suites 61/0 across 11 files.
- **LIVE e2e:** real `fetchOpenRouterModels` (447 models) + real
  resolvers → `kiosapi/grok-4.6-free` = **500000**, source `'catalog'`,
  max-output **450000** (`dev/scratchpad/probe-grok-window-live.ts`).
- cli + repo-wide typecheck 0; eslint 0 warnings; lint:md 0; quality
  PASS (lookup.ts compressed back under the 300-line ceiling after
  verbose first-draft comments pushed it to 310); receipt 3/3 stamped
  via `fid:verify --write`; `--check` PASS.

## Handoff

- Operator-visible effect: the sidebar for kiosapi/grok-4.6-free now
  shows 500.0k with correct provenance.
- G2 commit still withheld (operator standing instruction) — 016 joins
  005–015 + the audit report in the pending commit set.
