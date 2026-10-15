# Nova Audit Response — FID-2026-0806-009…015 Fresh-User Teardown

**Date:** 2026-08-06
**From:** Nova — independent third-party ECHO auditor
**To:** Savant (Orchestrator)
**FIDs:** FID-2026-0806-009…015 (status: analyzed)
**Type:** Pre-implementation design audit — 7 FIDs

---

## Verdict: ALL 7 APPROVED

Every design correctly honors the operator's decisions:
1. Backend intentionally undeployed — BYOK/direct mode is the only path
2. Boot default = OpenRouter, not OpenCode Go

---

## Claim Verification

### FID-009 — BYOK Gate
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| `getInferenceBaseUrlFromEnv` at lines 8, 118, 346 | ✅ |
| Only 2 of 7 backend calls gated | ✅ (gap confirmed) |
| `finishAgentRun`, `addAgentStep`, `fetchAgentFromDatabase` ungated | ✅ |
| SDK has no `isDirectProviderMode` | ✅ (gap confirmed) |

**Design:** Gate detection lives once in SDK. Correct.

### FID-010 — OpenRouter-First
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| Default is `opencode-go/mimo-v2.5` | ✅ (line 14-15) |
| No OpenRouter dispatch branch | ✅ (gap confirmed) |
| `openrouter/free` is valid free-tier slug | ✅ (OpenRouter docs) |

**Design:** New `isOpenRouterModel` branch routes to `https://openrouter.ai/api/v1`. Correct.

### FID-011 — Visible Failures
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| Startup-only error handling at `index.tsx:423` | ✅ |
| No `--print`/`--headless` mode | ✅ (gap confirmed) |
| `RunState.output.type === 'error'` exists | ✅ |

**Design:** `--print <prompt>` non-interactive mode + non-zero exit codes. Correct.

### FID-012 — Safe Serialization
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| 4 plain `JSON.stringify` writes | ✅ (lines 225-226, 252-253) |
| WeakSet replacer precedent in `evals/v2/src/reports.ts:17` | ✅ |

**Design:** Cyclic-safe stringify with WeakSet replacer. Correct.

### FID-013 — Branding Strip
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| `savant-free.com` in hosts.ts, base-chat.ts, system-prompt.ts | ✅ |
| `NEXT_PUBLIC_SAVANT_FREE_APP_URL` in .env.example | ✅ |
| Internal identifiers stay (IS_SAVANT_FREE) | ✅ |

**Design:** User-facing strings only. Correct scope.

### FID-014 — Auto-Update Prompt
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| No consent step before `replaceFileWithRollback` | ✅ (gap confirmed) |
| Windows file-lock makes mid-session replace impossible | ✅ |

**Design:** Interactive y/N prompt + defer to next launch. Correct.

### FID-015 — Analytics Disclosure
**Status:** ✅ APPROVED

| Claim | Verified |
|-------|----------|
| `analyticsEnabled: true` in DEFAULT_SETTINGS | ✅ |
| `/telemetry` control surface exists | ✅ |
| README has no disclosure | ✅ (gap confirmed) |

**Design:** Disclosure + one-line first-run notice. Correct.

---

## Summary

| FID | Issue | Status | Notes |
|-----|-------|--------|-------|
| 009 | BYOK gate | ✅ Approved | 5 more call sites gated |
| 010 | OpenRouter-first | ✅ Approved | Default + routing fixed |
| 011 | Visible failures | ✅ Approved | --print mode + exit codes |
| 012 | Safe serialization | ✅ Approved | WeakSet replacer |
| 013 | Branding strip | ✅ Approved | User-facing only |
| 014 | Auto-update prompt | ✅ Approved | y/N + defer |
| 015 | Analytics disclosure | ✅ Approved | README + first-run |

**Verdict:** ALL 7 APPROVED. Ready for implementation.

---

*Audit response written 2026-08-06 by Nova.*
