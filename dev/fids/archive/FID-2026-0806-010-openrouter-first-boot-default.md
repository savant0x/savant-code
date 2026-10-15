# FID: OpenRouter-First Boot Default + Direct Routing

**Filename:** `FID-2026-0806-010-openrouter-first-boot-default.md`
**ID:** FID-2026-0806-010
**Severity:** critical
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #2 + operator decision
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

With `DIRECT_PROVIDER=openrouter`, `INFERENCE_BASE_URL=https://openrouter.ai/api/v1`,
and a valid `OPENROUTER_API_KEY`, the model preference still resolves to
`opencode-go/mimo-v2.5` and dies with "OpenCode Go API key not set." Fresh
users never make a single successful model call.

**Operator decision (2026-08-06):** boot default is **OpenRouter**, not OpenCode
Go. Default model `openrouter/free` (free endpoint), routed **directly** to
OpenRouter with the user's `OPENROUTER_API_KEY` (or `OR_MASTER_KEY`).

## RED — evidence (verified against working tree, 2026-08-06)

| Claim | Evidence |
|---|---|
| Default model is opencode-go | `cli/src/utils/settings.ts:14-15,21-22` — `DEFAULT_SAVANT_CODE_MODEL_ID = 'opencode-go/mimo-v2.5'`, baked into `DEFAULT_SETTINGS` (materialized for fresh users) |
| SDK has no OpenRouter branch | `sdk/src/impl/model-provider.ts` — branches for tokenrouter/nvidia/opencode-go/commandcode/cloudflare; `openrouter/` models fall through to `createSavantCodeBackendModel` |
| Backend path routes openrouter to dead backend | `sdk/src/impl/model-provider/savant-backend.ts:48` — `baseUrl = inferenceBaseUrl ?? getWebsiteUrl()`; with no `INFERENCE_BASE_URL`, openrouter models hit the undeployed backend |
| Endpoint/auth already correct | OpenRouter quickstart (openrouter.ai/docs/quickstart): base `https://openrouter.ai/api/v1`, `POST /chat/completions`, `Authorization: Bearer <OPENROUTER_API_KEY>`, optional `HTTP-Referer`/`X-OpenRouter-Title` — all already implemented in `savant-backend.ts` + `openrouter-key-resolver.ts` |
| Key precedence exists | `OR_MASTER_KEY` > `OPENROUTER_API_KEY` > `INFERENCE_API_KEY` (`sdk/src/impl/openrouter-key-resolver.ts`) |
| Provider allowlist | `settings.ts:222-228` already includes `'openrouter'`; `ModelProvider` type includes it |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Boot default | `DEFAULT_SAVANT_CODE_MODEL_ID` → `'openrouter/free'`; `DEFAULT_SAVANT_CODE_MODEL_PROVIDER` → `'openrouter'` (`settings.ts:14-15`) |
| Direct OpenRouter routing | Add `isOpenRouterModel()` branch in `sdk/src/impl/model-provider.ts` → OpenAI-compatible model at `https://openrouter.ai/api/v1` with resolved key (`resolveOpenRouterApiKey()`); clear error: "OpenRouter API key not set. Set OPENROUTER_API_KEY or OR_MASTER_KEY." |
| `INFERENCE_BASE_URL` override preserved | Explicit `INFERENCE_BASE_URL` still wins when set (custom endpoints unchanged) |
| Provider setup default | `PROVIDER_SETUP_DEFAULT` (`provider-setup.ts:19`) → `'openrouter'` so `/provider` with no arg offers OpenRouter first |
| Ollama path | `ollama-onboarding.ts:171` sets provider preference to `'opencode-go'` — change to `'openrouter'` (or the active direct provider) |
| Docs | README BYOK section: default is `openrouter/free`; set `OPENROUTER_API_KEY` or `OR_MASTER_KEY`; no other config needed |

## AUDIT — double-audit evidence

- `settings.test.ts:114` asserts the opencode-go default — must be updated.
- Grep `isOpenRouterModel` in SDK: NO-MATCH — new branch required.
- `agents/savant/savant.ts:72` agent fallback is already `'openrouter/free'` — consistent with the new default.
- OpenRouter docs cited above confirm endpoint, auth, and optional headers
  match existing `savant-backend.ts` output (wiring verified, routing is the
  gap).

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Does `openrouter/free` work without a paid key? | CONFIRMED — free-tier model slug; rate-limited but free (per OpenRouter free-models FAQ; operator-confirmed endpoint) |
| Should OpenCode Go remain a provider? | CONFIRMED — kept as an explicit opt-in provider (`/provider opencode-go`); only the *default* changes |
| Persisted settings from prior runs | CONFIRMED — users who already picked a model keep it; only unset/fresh preferences adopt the new default |
| `OR_MASTER_KEY` path | CONFIRMED — resolver precedence already covers it; master-key exchange posts to `openrouter.ai/api/v1/keys` (correct per docs) |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance (same as
  FID-009); (2) citation drift — `savant-backend.ts:48` not :44.
- **GREEN:** metadata block brought to template contract; citation corrected.
- **AUDIT (fresh tool output):** `settings.ts:14-15` defaults are
  `'opencode-go/mimo-v2.5'` / `'opencode-go'`, materialized for fresh users at
  `settings.ts:21-22`. `grep -n isOpenRouterModel sdk/src/impl/model-provider.ts`
  → NO-MATCH (no OpenRouter branch). `savant-backend.ts:48` baseUrl fallback
  confirmed. Allowlist `settings.ts:222` includes `'openrouter'`;
  `PROVIDER_SETUP_DEFAULT = 'opencode-go'` at `provider-setup.ts:19`;
  `ollama-onboarding.ts:171` sets provider preference to `'opencode-go'`;
  `settings.test.ts:114` asserts the opencode-go default (must update).
  OpenRouter quickstart docs verified independently (endpoint/auth/headers
  already correct in `savant-backend.ts`).
- **CHANGE DELTA:** < 2% (metadata + one citation line).

### Missed Questions

1. Does the model picker list `openrouter/free` already? → Yes — OpenRouter
   models come from the live catalog (`openrouter-models/`); the default is
   the only change.
2. Should `OR_MASTER_KEY`-only users get an auto-created key? → Yes — the
   master-key exchange (`openrouter-key-resolver.ts`) already resolves a
   working key at request time; no extra work needed.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Boot defaults to openrouter/free (settings.ts DEFAULT_SAVANT_CODE_MODEL_ID/PROVIDER, provider-setup PROVIDER_SETUP_DEFAULT, ollama-onboarding); SDK isOpenRouterModel branch in model-provider.ts routes openrouter/ slugs to https://openrouter.ai/api/v1 with resolved key (full slug preserved); INFERENCE_BASE_URL override still wins.
- **Tests Added:** model-provider-free-mode.test.ts OpenRouter branch (full-slug check, key-required); settings.test.ts default assertions; ollama-onboarding.test.ts; provider-setup.test.ts default-gateway test.
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

The endpoint wiring can be perfect while the *routing* still fails — the gap
was model-class dispatch, not the HTTP layer. Boot defaults are product
decisions: pick the path a fresh user can actually complete (free OpenRouter)
over the operator's personal preference (OpenCode Go).
