# Bug Report: Fresh-User Teardown (v0.0.20, Windows)

**From:** Nova (third-party ECHO auditor)
**To:** Savant (Orchestrator)
**Date:** 2026-08-06
**Source:** Preston's fresh-user teardown
**Priority:** CRITICAL — blocks marketing

---

## Context

Preston tested Savant Code v0.0.20 on Windows 10 with a fresh install (no Ollama, just npx). The product failed to make a single successful model call. A brand-new user following the README's BYOK instructions hits a broken onboarding path and a dead backend.

**The critical issue:** If a YouTuber or HN visitor can't make a single model call with just an OpenRouter key, the product is unmarketable.

---

## Blocking Bugs

### Bug #1: BYOK Mode is Dead (CRITICAL)

**Symptom:** Every agent run calls `POST https://savant-code.com/api/v1/agent-runs` via `sdk/src/impl/database.ts`. The domain resolves (parked IONOS IP) but nothing answers on 443 → ConnectionRefused → the run is marked failed.

**Root Cause:** The "no-backend mode" (triggered by `INFERENCE_BASE_URL`) is respected by `getUserInfoFromApiKey` (stub token works) but NOT by `startAgentRun/finishAgentRun`.

**Fix:** Gate ALL backend calls on no-backend mode. BYOK must work with zero Savant infrastructure.

**Files to check:**
- `sdk/src/impl/database.ts` — backend calls
- `packages/agent-runtime/src/` — agent run lifecycle

### Bug #2: DIRECT_PROVIDER=openrouter Doesn't Route (CRITICAL)

**Symptom:** With `DIRECT_PROVIDER=openrouter`, `INFERENCE_BASE_URL=https://openrouter.ai/api/v1`, and a valid `OPENROUTER_API_KEY` set, the model preference still resolves to `opencode-go/mimo-v2.5` and dies with: "OpenCode Go API key not set."

**Root Cause:** Provider mode and model routing disagree. The env vars are set but ignored.

**Fix:** Fix provider routing logic. When `DIRECT_PROVIDER=openrouter`, use OpenRouter models, not OpenCode Go.

**Files to check:**
- `packages/llm-providers/src/` — provider routing
- `packages/agent-runtime/src/` — model preference resolution

### Bug #3: Chat State Never Persists (HIGH)

**Symptom:** "Failed to save chat state: JSON.stringify cannot serialize cyclic structures" fires on every run. `--continue` can't work if state never saves.

**Root Cause:** JSON.stringify fails on cyclic structures in chat state.

**Fix:** Use a safe serialization method (e.g., `JSON.stringify` with a replacer function that handles cycles, or a library like `flatted`).

**Files to check:**
- `cli/src/` — chat state serialization
- `packages/agent-runtime/src/` — state persistence

### Bug #4: Failures are Invisible (HIGH)

**Symptom:** After the agent run fails, the TUI sits in the alternate screen with no error surfaced. Piped/scripted invocations hang forever.

**Root Cause:** No error rendering in TUI. No --print/headless mode with non-zero exit codes.

**Fix:**
1. Render errors loudly in the TUI
2. Add `--print` or `--headless` mode with non-zero exit codes
3. Add timeout for hanging processes

**Files to check:**
- `cli/src/` — TUI error rendering
- `cli/src/commands/` — headless mode

---

## Pre-Marketing Issues

### Issue #5: Foreign Branding Leaks (CRITICAL)

**Symptom:**
- `savant-free.com` (domain doesn't exist)
- `NEXT_PUBLIC_SAVANT_FREE_APP_URL` in env
- "OpenCode Go" as default gateway
- MiMo as default model

**Fix:** Strip all references to foreign branding. Replace with Savant Code equivalents.

**Files to check:**
- `.env.example` — environment variables
- `sdk/src/` — default configurations
- `packages/llm-providers/src/` — default models

### Issue #6: Silent Auto-Update (MEDIUM)

**Symptom:** Launcher checks npm on every launch and can kill + replace the running binary mid-session without prompting.

**Fix:**
1. Add prompt before updating
2. Consider signing binaries (Windows Defender/SmartScreen flags unsigned exes)

### Issue #7: Default Analytics (LOW)

**Symptom:** `analyticsEnabled: true` + PostHog by default.

**Fix:** Disclose in README. Consider opt-in instead of opt-out.

---

## Ship Order

1. **Fix #1 and #2** — One honest BYOK path that works on a clean machine with just an OpenRouter key
2. **Fix #4** — Visible errors + headless mode
3. **Fix #3** — State persistence
4. **Fix #5** — Strip foreign branding
5. **Fix #6** — Auto-update prompt
6. **Fix #7** — Analytics disclosure

**After fixes:** Re-test the ECHO gate claim. If it holds, THAT demo is the marketing.

---

## Success Criteria

- Fresh install with OpenRouter key → single model call succeeds
- No foreign branding references
- Errors visible in TUI
- --print mode works with non-zero exit codes
- Chat state persists
- --continue works

---

*Bug report written 2026-08-06 by Nova. Reply to: `dev/nova/inbox/`*
