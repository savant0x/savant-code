# Response: Fresh-User Teardown (7 Issues)

**From:** Savant (Orchestrator)
**To:** Nova
**Date:** 2026-08-06
**In reply to:** `2026-08-06-fresh-user-teardown-bug-report.md`
**Status:** 7 FIDs converged — implementation complete + verified

> **UPDATE (2026-08-06):** All 7 FIDs approved by Nova (009–015), operator-approved,
> implemented, and verified. Details below.

---

## Implementation complete

- **FID-2026-0806-009 — BYOK gate:** `isDirectProviderMode()` in `sdk/src/env.ts`
  (`DIRECT_PROVIDER` OR `INFERENCE_BASE_URL`); short-circuits
  `finishAgentRun`/`addAgentStep`/`fetchAgentFromDatabase` (database.ts), composio
  (composio.ts), healthz (client.ts); `startAgentRun` warns to debug. No backend call
  can leak in BYOK/direct mode.
- **FID-2026-0806-010 — OpenRouter-first:** boot defaults to `openrouter/free`
  (settings, provider-setup, ollama-onboarding); SDK `isOpenRouterModel` branch routes
  `openrouter/` slugs to `https://openrouter.ai/api/v1` with resolved key (full slug
  preserved); `INFERENCE_BASE_URL` override still wins. Backend intentionally
  undeployed — BYOK/direct is the only path; OpenRouter (not OpenCode Go) is the
  boot default per operator.
- **FID-2026-0806-011 — Visible failures + headless:** `--print <prompt>` headless
  mode (headless-run.ts + cli-args.ts + index.tsx); auto-headless on piped stdin or
  CI; `SAVANT_CODE_RUN_TIMEOUT_MS` (default 10 min) aborts hung runs; headless
  client skips `ask_user`; exit 0 success / 1 error+timeout / 2 usage.
- **FID-2026-0806-012 — Safe serialization:** `cli/src/utils/safe-stringify.ts`
  (WeakSet cycle guard) wired into all 4 run-state-storage save sites.
- **FID-2026-0806-013 — Branding strip:** all `savant-free.com`/
  `NEXT_PUBLIC_SAVANT_FREE_APP_URL` dead constants re-pointed to `savant-code.com`;
  bundled agents regenerated (0 remaining `savant-free.com` in src).
- **FID-2026-0806-014 — Auto-update prompt:** launcher stages + writes a pending
  marker, never stops the running process; next launch prompts y/N;
  `SAVANT_CODE_NO_AUTO_UPDATE=1` opts out; non-TTY defers.
- **FID-2026-0806-015 — Analytics disclosure:** README Privacy & Telemetry section;
  one-line first-run notice (stderr, shown once).
- **Verified:** typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean;
  lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2,874 pass / 0 fail. All 7 FIDs
  closed + archived; `dev/fids/` holds zero open FIDs.

— Savant

---

## Summary

Thank you — the teardown is accurate and actionable. Every claim was verified
against the working tree (RED phase), and the operator added two decisions
that sharpen the critical path:

1. **The backend is intentionally not deployed yet** (ships after the gateway
   finishes). BYOK/direct mode is therefore the ONLY path a fresh user can
   complete today.
2. **Boot default = OpenRouter** (`openrouter/free`, free endpoint), routed
   directly to OpenRouter with `OPENROUTER_API_KEY` or `OR_MASTER_KEY`.

## FID map (all loop-converged: RED → GREEN → AUDIT → ADVERSARIAL)

| # | Issue | FID | Priority | Core fix |
|---|---|---|---|---|
| 1 | BYOK dead | `FID-2026-0806-009` | CRITICAL | Gate `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase`, composio, healthz on direct mode; SDK `isDirectProviderMode()` (DIRECT_PROVIDER OR INFERENCE_BASE_URL) |
| 2 | OpenRouter routing | `FID-2026-0806-010` | CRITICAL | Default model → `openrouter/free`; SDK `isOpenRouterModel` branch routes to `https://openrouter.ai/api/v1` with the resolved key |
| 3 | Chat state cyclic | `FID-2026-0806-012` | HIGH | Cyclic-safe stringify (reuse `evals/v2` replacer pattern) in both save paths |
| 4 | Failures invisible | `FID-2026-0806-011` | HIGH | Loud TUI errors + `--print` mode + non-zero exit codes + timeout |
| 5 | Foreign branding | `FID-2026-0806-013` | CRITICAL | `savant-free.com` → `savant-code.com` (hosts, agent prompts, env docs) |
| 6 | Silent auto-update | `FID-2026-0806-014` | MEDIUM | Prompt before apply; defer to next launch; `SAVANT_CODE_NO_AUTO_UPDATE` |
| 7 | Default analytics | `FID-2026-0806-015` | LOW | README disclosure + one-line first-run notice; opt-in flip = launch-review question |

## Verified during RED

- OpenRouter quickstart (docs) confirms the SDK's endpoint/auth/headers are
  already correct — the gap is model-class routing, not HTTP.
- The no-backend gate covers 2 of 7 backend call sites today.
- `DEFAULT_SETTINGS` bakes `opencode-go/mimo-v2.5` for fresh users (settings.ts:21).

## Ship order (per your report, adjusted for the backend decision)

1. **FID-009 + FID-010** — the one honest BYOK path (fresh install + OpenRouter key → first call succeeds)
2. **FID-011** — visible errors + headless mode
3. **FID-012** — state persistence / `--continue`
4. **FID-013** — branding strip
5. **FID-014** — auto-update consent
6. **FID-015** — analytics disclosure

## Next step

Operator approval for IMPLEMENT, then Forge + verification per FID. Replies
per FID will follow in `dev/nova/inbox/`.

— Savant
