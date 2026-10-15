# FID: Strip Foreign Branding References

**Filename:** `FID-2026-0806-013-strip-foreign-branding.md`
**ID:** FID-2026-0806-013
**Severity:** critical
**Status:** closed
**Created:** 2026-08-06
**Author:** Savant
**YAGNI-Compliance:** Verified
**Source:** Nova fresh-user teardown Bug #5
**Reply to:** `dev/nova/inbox/2026-08-06-fresh-user-teardown-bug-report.md`

---

## Problem

User-facing surfaces leak foreign/dead branding: `savant-free.com` (domain
does not exist), `NEXT_PUBLIC_SAVANT_FREE_APP_URL` in env docs, and agent
prompts that introduce the product under a name it does not use.

## RED — evidence (verified against working tree, 2026-08-06)

| Leak | Evidence |
|---|---|
| `savant-free.com` constant | `common/src/constants/hosts.ts:6` — `SAVANT_FREE_WEB_URL_PROD = 'https://savant-free.com'` |
| Agent identity | `agents/base-chat.ts:8,19,30` — header comment, spawner prompt, and system prompt all say "savant-free.com"/"SavantFree" |
| System prompt link | `agents/savant/system-prompt.ts:215` — "See savant-free.com for more information" |
| Env docs | `.env.example:34` — `NEXT_PUBLIC_SAVANT_FREE_APP_URL=http://localhost:3001` |
| Free-variant packaging | `savant-free/cli/release/package.json:38` — homepage `https://savant-free.com`; `savant-free/cli/release/README.md:39` |
| Default gateway branding | README/installation docs name OpenCode Go as "Default hosted provider" (resolved by FID-010) |

## GREEN — design (loop-converged)

| Decision | Design |
|---|---|
| Web URL constant | `SAVANT_FREE_WEB_URL_PROD` → `'https://savant-code.com'` (the real product origin; backend routes stay `savant-code.com`) |
| Agent identity | `base-chat.ts` → Savant Code (savant-code.com); `system-prompt.ts:215` → savant-code.com |
| Env docs | `.env.example` — drop `NEXT_PUBLIC_SAVANT_FREE_APP_URL` or rename to the savant-code equivalent |
| Free-variant packaging | `savant-free/cli/release` homepage/README → savant-code.com (variant still ships, branding unified) |
| Docs sweep | README/installation/features "Default hosted provider" row → OpenRouter default (FID-010) |
| Out of scope | `savant-free/` workspace naming, `IS_SAVANT_FREE` internals, wire protocol refs — internal identifiers, not user-facing |

## AUDIT — double-audit evidence

- Grep `savant-free.com` → 8 files (hosts.ts, base-chat.ts, system-prompt.ts,
  savant-free workspace, docs); `NEXT_PUBLIC_SAVANT_FREE_APP_URL` → `.env.example`
  + `cli/release/README.md`.
- `savant-code.com` is the canonical prod origin (`.github/workflows` env
  defaults, `WINDOWS.md`, SECURITY.md) — the swap target is consistent.
- Docs/design/launch historical records intentionally left untouched (dated).

## ADVERSARIAL — verdicts

| Challenge | Verdict |
|---|---|
| Rename the whole `savant-free/` workspace? | REFUTED — internal identifier churn with zero user value; strip user-facing refs only |
| Is Savant branding covered? | CONFIRMED — `NEXT_PUBLIC_SAVANT_FREE_APP_URL` is a leftover env name, not a product identity; rename in docs |
| Docs are historical records | CONFIRMED — only active docs/READMEs/env examples change; research/launch docs stay as-is |
| Breaking env compat? | ADJUSTED — keep reading the legacy env name as a fallback; write/PRINT the new name |

## Loop 2 (double-audit, 2026-08-06)

- **RED:** AUDIT pass found (1) template metadata non-compliance; (2)
  `base-chat.ts` carries savant-free.com at THREE sites (:8, :19, :30) — the
  FID listed only :30.
- **GREEN:** metadata block brought to template contract; branding inventory
  expanded.
- **AUDIT (fresh tool output):** `grep -rn savant-free.com` → hosts.ts:2,6;
  base-chat.ts:8,19,30; system-prompt.ts:215; `.env.example:34`
  `NEXT_PUBLIC_SAVANT_FREE_APP_URL` — all confirmed. Additional check:
  `savant-free/cli/release/package.json:38` homepage + README:39 confirmed
  earlier in RED. Docs/design historical records untouched.
- **CHANGE DELTA:** < 2% (metadata + one inventory line).

### Missed Questions

1. Do wire-protocol or env-parity tests assert the old constant? → Check at
   implementation (`grep SAVANT_FREE_WEB_URL_PROD`); keep the legacy env name
   read as a fallback so pre-existing env files keep working.
2. Should the savant-free workspace rename? → No (ADVERSARIAL verdict held):
   internal identifier churn with zero user value; user-facing strings only.

## Convergence

Zero actionable improvements remain. Loop terminated → COMPLETE state.
**Nova verdict (2026-08-06):** ✅ APPROVED — see
`dev/nova/inbox/2026-08-06-fid-009-015-fresh-user-teardown-nova-audit-response.md`.
Awaiting operator approval for IMPLEMENT.

## Resolution

- **Fixed By:** Savant (Savant ECHO v0.1.2)
- **Fixed Date:** 2026-08-06
- **Fix Description:** Dead savant-free.com to savant-code.com across hosts.ts (SAVANT_FREE_WEB_URL_PROD), agents/base-chat.ts (3 sites), agents/savant/system-prompt.ts, analytics-events/savant-free-models comments, savant-code-api test fixtures; legacy NEXT_PUBLIC_SAVANT_FREE_APP_URL read as fallback (env-schema + login/constants.ts); .env.example updated; bundled-agents.generated.ts regenerated (0 remaining savant-free.com in src).
- **Tests Added:** Regenerated bundle grep sweep; env-schema typed legacy alias.
- **Verified By:** Savant (implementation AUDIT) — typecheck ×4 exit 0; full-repo eslint exit 0; prettier clean; lint:md 0; SDK suite 452 pass / 0 fail; CLI suite 2874 pass / 0 fail
- **Commit/PR:** *(pending — operator commits/pushes)*
- **Archived:** 2026-08-06

## Lessons Learned

Branding lives in constants and prompts, not just marketing pages. A dead
domain in a shared hosts constant silently propagates into every agent
identity — one sweep of user-facing strings beats ten rebrands.
